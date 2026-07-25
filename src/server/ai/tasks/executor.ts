import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAIConfig } from "@/server/ai/config";
import { AIPlatformError } from "@/server/ai/errors";
import { composeContext, type ContextProviderKey } from "@/server/ai/context/engine";
import {
  checkRateLimitHook,
  sanitizeInput,
  validateOutput,
} from "@/server/ai/guardrails";
import {
  estimateCostUsd,
  recordAIError,
  recordCost,
  recordUsage,
} from "@/server/ai/observability/metrics";
import {
  getActivePrompt,
  renderPromptTemplate,
} from "@/server/ai/prompts/repository";
import { routeModel } from "@/server/ai/routing/router";
import { ensureAITasks, getTaskDefinition } from "@/server/ai/tasks/registry";
import { ensureAICatalog } from "@/server/ai/routing/router";
import { ensurePrompts } from "@/server/ai/prompts/repository";
import { writeMemory } from "@/server/ai/memory/store";

export type RunTaskInput = {
  workspaceId: string;
  brandId?: string | null;
  taskKey: string;
  input: Record<string, unknown>;
  userId?: string | null;
  preference?: "cost" | "latency" | "quality" | "balanced";
  stream?: boolean;
  /** Override task-default context providers (e.g. user toggles). */
  contextProviders?: ContextProviderKey[];
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function bootstrapAIPlatform(workspaceId?: string | null) {
  await ensureAICatalog();
  await ensureAITasks();
  await ensurePrompts(workspaceId || null);
}

export async function runAITask(input: RunTaskInput) {
  const config = getAIConfig();
  if (!config.enabled) {
    throw new AIPlatformError("INTERNAL", "AI platform disabled", {
      retryable: false,
    });
  }

  await bootstrapAIPlatform(input.workspaceId);
  const def = getTaskDefinition(input.taskKey);
  const task = await prisma.aITask.findUnique({ where: { key: input.taskKey } });
  if (!task || !def) {
    throw new AIPlatformError("TASK_NOT_FOUND", `Unknown task: ${input.taskKey}`, {
      retryable: false,
    });
  }

  const rate = checkRateLimitHook(input.workspaceId);
  if (!rate.ok) {
    throw new AIPlatformError("RATE_LIMIT", rate.reasons.join("; "), {
      retryable: true,
    });
  }

  const textInput = String(
    input.input.text ||
      input.input.question ||
      input.input.brief ||
      JSON.stringify(input.input),
  );
  const guard = sanitizeInput(textInput);
  if (!guard.ok && guard.reasons.includes("Empty input") === false) {
    // Soft-block only hard violations; empty handled by schema later
    if (guard.reasons.some((r) => r.includes("exceeds") || r.includes("Suspicious"))) {
      throw new AIPlatformError("GUARDRAIL_BLOCKED", guard.reasons.join("; "), {
        retryable: false,
      });
    }
  }

  const contextProviders = (
    input.contextProviders?.length
      ? input.contextProviders
      : def.contextProviders || []
  ) as ContextProviderKey[];
  let contextSnapshotId: string | null = null;
  let contextPayload: Record<string, unknown> = {};
  if (input.brandId && contextProviders.length) {
    const composed = await composeContext({
      brandId: input.brandId,
      providers: contextProviders,
      taskKey: input.taskKey,
    });
    contextSnapshotId = composed.snapshot.id;
    contextPayload = composed.payload;
  }

  const prompt = await getActivePrompt(def.promptKey, input.workspaceId);
  const systemPrompt = prompt?.version?.systemPrompt || "You are a helpful assistant.";
  const developerPrompt = prompt?.version?.developerPrompt || "";

  const routed = await routeModel({
    taskType: task.category,
    required: {
      json: task.outputFormat === "json",
      streaming: Boolean(input.stream),
    },
    preference: input.preference,
    preferredModelKey: task.defaultModelKey,
  });

  const execution = await prisma.aITaskExecution.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId || null,
      taskId: task.id,
      modelId: routed.model.id,
      status: "RUNNING",
      input: asJson(input.input),
      contextSnapshotId,
      providerKey: routed.provider.key,
      modelKey: routed.model.key,
      startedAt: new Date(),
      retryCount: 0,
    },
  });

  const maxRetries = task.maxRetries ?? config.maxRetries;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      const started = Date.now();
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...(developerPrompt
          ? [{ role: "developer" as const, content: developerPrompt }]
          : []),
        {
          role: "user" as const,
          content: renderPromptTemplate(
            "Task: {{task}}\nInput: {{input}}\nContext: {{context}}",
            {
              task: task.key,
              input: JSON.stringify({
                ...input.input,
                text: guard.maskedInput || textInput,
              }),
              context: JSON.stringify(contextPayload),
            },
          ),
        },
      ];

      const result = await routed.adapter.generate({
        modelKey: routed.model.key,
        messages,
        outputFormat: (task.outputFormat as "json" | "markdown" | "text") || "json",
      });

      const outputCheck = validateOutput(
        result.content,
        (task.outputFormat as "json" | "markdown" | "text") || "json",
        def.requiredOutputKeys,
      );
      if (!outputCheck.ok) {
        throw new AIPlatformError(
          "SCHEMA_MISMATCH",
          outputCheck.reasons.join("; "),
          { retryable: true },
        );
      }

      let parsed: unknown = result.content;
      if (task.outputFormat === "json") {
        parsed = JSON.parse(result.content);
      }

      const latencyMs = Date.now() - started;
      const promptTokens = result.promptTokens || 0;
      const completionTokens = result.completionTokens || 0;
      const estimatedCost = estimateCostUsd({
        inputPricePer1M: routed.model.inputPricePer1M,
        outputPricePer1M: routed.model.outputPricePer1M,
        promptTokens,
        completionTokens,
      });

      const completed = await prisma.aITaskExecution.update({
        where: { id: execution.id },
        data: {
          status: "COMPLETED",
          output: asJson(parsed),
          latencyMs,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          estimatedCostUsd: estimatedCost,
          retryCount: attempt,
          finishedAt: new Date(),
        },
      });

      await recordUsage({
        workspaceId: input.workspaceId,
        providerKey: routed.provider.key,
        modelKey: routed.model.key,
        taskKey: task.key,
        success: true,
        latencyMs,
        tokens: promptTokens + completionTokens,
        retries: attempt,
      });
      await recordCost({
        workspaceId: input.workspaceId,
        executionId: completed.id,
        providerKey: routed.provider.key,
        modelKey: routed.model.key,
        estimatedUsd: estimatedCost,
        promptTokens,
        completionTokens,
      });

      if (input.brandId) {
        await writeMemory({
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          scope: "SESSION",
          subjectId: completed.id,
          key: `task:${task.key}`,
          content: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
          meta: { provider: routed.provider.key, model: routed.model.key },
        });
      }

      return {
        execution: completed,
        output: parsed,
        modelKey: routed.model.key,
        providerKey: routed.provider.key,
        latencyMs,
        estimatedCostUsd: estimatedCost,
        contextSnapshotId,
        piiHits: guard.piiHits || [],
      };
    } catch (error) {
      lastError = error;
      attempt += 1;
      const platformError =
        error instanceof AIPlatformError
          ? error
          : new AIPlatformError("INVALID_RESPONSE", String(error), {
              retryable: true,
            });

      if (!platformError.retryable || attempt > maxRetries) {
        await prisma.aITaskExecution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            retryCount: attempt - 1,
            errorCode: platformError.code,
            errorMessage: platformError.message,
            finishedAt: new Date(),
          },
        });
        await recordUsage({
          workspaceId: input.workspaceId,
          providerKey: routed.provider.key,
          modelKey: routed.model.key,
          taskKey: task.key,
          success: false,
          latencyMs: 0,
          tokens: 0,
          retries: attempt - 1,
        });
        await recordAIError({
          workspaceId: input.workspaceId,
          executionId: execution.id,
          code: platformError.code,
          message: platformError.message,
          providerKey: routed.provider.key,
          modelKey: routed.model.key,
          taskKey: task.key,
          meta: platformError.meta,
        });
        throw platformError;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new AIPlatformError("RETRY_EXHAUSTED", "Retries exhausted", {
        retryable: false,
      });
}
