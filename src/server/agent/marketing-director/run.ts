import { AgentError } from "@/server/agent/errors";
import { loadAgentContext } from "@/server/agent/context";
import {
  getAgentLLMProvider,
  LLMProviderError,
  type LLMMessage,
  type LLMProvider,
  type LLMToolSpec,
  type LLMUsage,
} from "@/server/agent/llm";
import {
  DIRECTOR_ALLOWED_SPECIALISTS,
  MARKETING_DIRECTOR_AGENT_ID,
  MAX_SPECIALIST_CALLS,
  SPECIALIST_CATALOG,
  invokeNameToSpecialistId,
  specialistIdToInvokeName,
  type DirectorSpecialistId,
} from "@/server/agent/a2a/specialists";
import { invokeSpecialistAgent } from "@/server/agent/a2a/invoke";
import type { CompactHandoff } from "@/server/agent/a2a/handoffs";
import { sanitizeToolPayload } from "@/server/agent/loop";
import {
  MARKETING_DIRECTOR_SYSTEM_PROMPT,
} from "@/server/agent/marketing-director/constants";
import {
  parseDirectorFinal,
  type DirectorFinalResult,
  type DirectorStepState,
} from "@/server/agent/marketing-director/output";
import {
  prismaAgentRuntimeStore,
  type AgentRuntimeStore,
} from "@/server/agent/runtime";
import { bootstrapAgentTools } from "@/server/agent/bootstrap";
import {
  getDefaultToolRegistry,
  type ToolRegistry,
} from "@/server/agent/tool-registry";
import type { Prisma } from "@prisma/client";

export type RunMarketingDirectorInput = {
  message: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  llm?: LLMProvider;
  /** LLM used only for Director planning; specialists use specialistLlm or mocks. */
  specialistLlm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  maxSpecialistCalls?: number;
};

export type RunMarketingDirectorResult = {
  success: boolean;
  response: string;
  executionId: string;
  status: "COMPLETED" | "FAILED";
  intent: DirectorFinalResult["intent"];
  constraints: Record<string, unknown>;
  steps: DirectorStepState[];
  specialistCalls: number;
  final: DirectorFinalResult;
  usage?: LLMUsage;
  model?: string;
  provider?: string;
  error?: { code: string; message: string };
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function buildInvokeToolSpecs(): LLMToolSpec[] {
  return SPECIALIST_CATALOG.map((s) => ({
    name: specialistIdToInvokeName(s.id),
    description: `Invoke specialist ${s.id}. ${s.description}`,
    parameters: {
      type: "object",
      properties: {
        message: { type: "string" },
        purpose: { type: "string" },
        constraints: { type: "object", additionalProperties: true },
        handoff: { type: "object", additionalProperties: true },
        blueprint: { type: "object", additionalProperties: true },
        blueprintItem: { type: "object", additionalProperties: true },
        blueprintItemId: { type: "string" },
        period: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
          },
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  }));
}

/**
 * Marketing Director — bounded orchestration over allowlisted specialists.
 */
export async function runMarketingDirectorAgent(
  input: RunMarketingDirectorInput,
): Promise<RunMarketingDirectorResult> {
  if (!input.userId || !input.workspaceId || !input.brandId) {
    throw new AgentError(
      "SCOPE_VIOLATION",
      "Agent execution requires userId, workspaceId, and brandId.",
    );
  }

  const message = input.message?.trim();
  if (!message) {
    throw new AgentError("INVALID_INPUT", "Message is required.");
  }

  const llm = input.llm ?? getAgentLLMProvider();
  if (!llm.isConfigured()) {
    throw new AgentError("EXECUTION_FAILED", "LLM provider is not configured.", {
      meta: { code: "LLM_NOT_CONFIGURED" },
    });
  }

  const registry =
    input.toolRegistry ?? bootstrapAgentTools(getDefaultToolRegistry());
  const store = input.store ?? prismaAgentRuntimeStore;
  const maxCalls = input.maxSpecialistCalls ?? MAX_SPECIALIST_CALLS;

  const execution = await store.createExecution({
    agentId: MARKETING_DIRECTOR_AGENT_ID,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    input: asJson({ message, role: "director" }),
    status: "PENDING",
  });

  await store.updateExecution(execution.id, {
    status: "RUNNING",
    startedAt: new Date(),
  });

  const agentContext = await loadAgentContext({
    userId: input.userId,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    includeRelevantContext: false,
  });

  const toolSpecs = buildInvokeToolSpecs();
  const messages: LLMMessage[] = [
    { role: "system", content: MARKETING_DIRECTOR_SYSTEM_PROMPT },
    {
      role: "system",
      content: `Execution scope (authoritative):\n${JSON.stringify({
        userId: agentContext.user.id,
        workspaceId: agentContext.workspace.id,
        brandId: agentContext.brand.id,
      })}`,
    },
    {
      role: "system",
      content: `Allowlist: ${DIRECTOR_ALLOWED_SPECIALISTS.join(", ")}. Max specialist calls: ${maxCalls}. Do not invoke marketing.director.`,
    },
    { role: "user", content: message },
  ];

  const steps: DirectorStepState[] = [];
  const handoffs: CompactHandoff[] = [];
  let constraints: Record<string, unknown> = {};
  let specialistCalls = 0;
  let usage: LLMUsage | undefined;
  let model: string | undefined;
  let provider: string | undefined;
  let rounds = 0;

  try {
    while (rounds < maxCalls + 2) {
      rounds += 1;
      let llmResult;
      try {
        llmResult = await llm.chat({
          model: process.env.OPENAI_AGENT_MODEL || "gpt-4o-mini",
          messages,
          tools: toolSpecs,
          temperature: 0.2,
        });
      } catch (err) {
        const code =
          err instanceof LLMProviderError ? err.code : "LLM_REQUEST_FAILED";
        const msg =
          err instanceof LLMProviderError
            ? err.message
            : "LLM request failed.";
        await store.updateExecution(execution.id, {
          status: "FAILED",
          completedAt: new Date(),
          errorCode: code,
          errorMessage: msg,
          result: asJson({ steps, specialistCalls }),
        });
        return {
          success: false,
          response:
            "I could not complete the request because the language model is unavailable.",
          executionId: execution.id,
          status: "FAILED",
          intent: "UNKNOWN",
          constraints,
          steps,
          specialistCalls,
          final: parseDirectorFinal("", message),
          error: { code, message: msg },
        };
      }

      model = llmResult.model;
      provider = llmResult.provider;
      if (llmResult.usage) {
        usage = {
          promptTokens:
            (usage?.promptTokens || 0) + (llmResult.usage.promptTokens || 0),
          completionTokens:
            (usage?.completionTokens || 0) +
            (llmResult.usage.completionTokens || 0),
          totalTokens:
            (usage?.totalTokens || 0) + (llmResult.usage.totalTokens || 0),
        };
      }

      if (!llmResult.toolCalls.length) {
        const final = parseDirectorFinal(
          llmResult.content || "",
          "I completed the request with the available specialist results.",
        );
        if (Object.keys(final.constraints).length) {
          constraints = { ...constraints, ...final.constraints };
        }

        await store.updateExecution(execution.id, {
          status: "COMPLETED",
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
          result: asJson({
            response: final.response,
            intent: final.intent,
            constraints,
            steps,
            specialistCalls,
            handoffs: handoffs.map((h) => sanitizeToolPayload(h, 2_000)),
            final,
            usage,
            model,
            provider,
          }),
        });

        return {
          success: true,
          response: final.response,
          executionId: execution.id,
          status: "COMPLETED",
          intent: final.intent,
          constraints,
          steps,
          specialistCalls,
          final,
          usage,
          model,
          provider,
        };
      }

      messages.push({
        role: "assistant",
        content: llmResult.content,
        toolCalls: llmResult.toolCalls,
      });

      for (const call of llmResult.toolCalls) {
        const specialistId = invokeNameToSpecialistId(call.name);

        if (!specialistId) {
          messages.push({
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: JSON.stringify({
              success: false,
              error: {
                code: "PERMISSION_DENIED",
                message: `Unknown or disallowed specialist invoke: ${call.name}`,
              },
            }),
          });
          continue;
        }

        if (specialistCalls >= maxCalls) {
          messages.push({
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: JSON.stringify({
              success: false,
              error: {
                code: "MAX_SPECIALIST_CALLS",
                message: `Maximum specialist calls (${maxCalls}) reached.`,
              },
            }),
          });
          continue;
        }

        const args = {
          ...(call.arguments || {}),
          // Auto-attach latest relevant handoff if creator needs blueprint
          handoff:
            (call.arguments?.handoff as Record<string, unknown> | undefined) ||
            (specialistId === "content.creator"
              ? (handoffs.find((h) => h.blueprint || h.blueprintItem) as
                  | Record<string, unknown>
                  | undefined)
              : handoffs.length
                ? (sanitizeToolPayload(
                    handoffs[handoffs.length - 1],
                    2_000,
                  ) as Record<string, unknown>)
                : {}),
          constraints: {
            ...constraints,
            ...((call.arguments?.constraints as Record<string, unknown>) ||
              {}),
          },
          blueprint:
            call.arguments?.blueprint ||
            handoffs.find((h) => h.blueprint)?.blueprint,
          blueprintItem:
            call.arguments?.blueprintItem ||
            handoffs.find((h) => h.blueprintItem)?.blueprintItem,
        };

        if (
          args.constraints &&
          typeof args.constraints === "object" &&
          Object.keys(args.constraints as object).length
        ) {
          constraints = {
            ...constraints,
            ...(args.constraints as Record<string, unknown>),
          };
        }

        const step: DirectorStepState = {
          agent: specialistId,
          purpose: String(call.arguments?.purpose || ""),
          status: "running",
          input: sanitizeToolPayload(args, 2_000),
        };
        steps.push(step);
        specialistCalls += 1;

        try {
          const outcome = await invokeSpecialistAgent({
            agentId: specialistId,
            rawArgs: args,
            userId: input.userId,
            workspaceId: input.workspaceId,
            brandId: input.brandId,
            parentExecutionId: execution.id,
            depth: 0,
            llm: input.specialistLlm,
            toolRegistry: registry,
            store,
            directorConstraints: constraints,
          });

          step.status = outcome.result.success ? "completed" : "failed";
          step.executionId = outcome.result.executionId;
          step.output = sanitizeToolPayload(outcome.handoff, 3_000);
          step.limitations = outcome.handoff.limitations || [];
          handoffs.push(outcome.handoff);

          if (outcome.handoff.constraints) {
            constraints = {
              ...constraints,
              ...outcome.handoff.constraints,
            };
          }

          messages.push({
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: JSON.stringify({
              success: outcome.result.success,
              agentId: specialistId as DirectorSpecialistId,
              executionId: outcome.result.executionId,
              handoff: sanitizeToolPayload(outcome.handoff, 3_000),
              error: outcome.result.error,
            }),
          });
        } catch (err) {
          const code = err instanceof AgentError ? err.code : "EXECUTION_FAILED";
          const msg =
            err instanceof AgentError
              ? err.message
              : "Specialist invocation failed.";
          step.status = "failed";
          step.limitations = [msg];
          messages.push({
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: JSON.stringify({
              success: false,
              error: { code, message: msg },
            }),
          });
        }
      }
    }

    const response =
      "I reached the orchestration limit before finishing a complete answer. Please narrow the request or try again.";
    await store.updateExecution(execution.id, {
      status: "FAILED",
      completedAt: new Date(),
      errorCode: "MAX_SPECIALIST_CALLS",
      errorMessage: response,
      result: asJson({ response, steps, specialistCalls, constraints }),
    });
    return {
      success: false,
      response,
      executionId: execution.id,
      status: "FAILED",
      intent: "UNKNOWN",
      constraints,
      steps,
      specialistCalls,
      final: parseDirectorFinal("", message),
      usage,
      model,
      provider,
      error: { code: "MAX_SPECIALIST_CALLS", message: response },
    };
  } catch (err) {
    const messageText =
      err instanceof AgentError ? err.message : "Director execution failed.";
    const code = err instanceof AgentError ? err.code : "INTERNAL";
    await store.updateExecution(execution.id, {
      status: "FAILED",
      completedAt: new Date(),
      errorCode: code,
      errorMessage: messageText,
      result: asJson({ steps, specialistCalls }),
    });
    throw err instanceof AgentError
      ? err
      : new AgentError("EXECUTION_FAILED", messageText, { cause: err });
  }
}
