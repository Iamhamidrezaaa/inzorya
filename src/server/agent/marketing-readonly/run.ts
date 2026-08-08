import { AgentError } from "@/server/agent/errors";
import { loadAgentContext } from "@/server/agent/context";
import {
  getAgentLLMProvider,
  LLMProviderError,
  type LLMMessage,
  type LLMProvider,
  type LLMUsage,
} from "@/server/agent/llm";
import {
  MARKETING_READONLY_AGENT_ID,
  MARKETING_READONLY_SYSTEM_PROMPT,
  MAX_TOOL_CALL_ROUNDS,
  MAX_TOOL_RESULT_CHARS,
} from "@/server/agent/marketing-readonly/constants";
import {
  READONLY_ALLOWED_PERMISSIONS,
  buildLLMToolSpecs,
  functionNameToToolId,
  isMarketingReadonlyToolId,
  listMarketingReadonlyTools,
  sanitizeToolPayload,
} from "@/server/agent/marketing-readonly/tools";
import {
  createMemoryAgentRuntimeStore,
  prismaAgentRuntimeStore,
  type AgentRuntimeStore,
} from "@/server/agent/runtime";
import { bootstrapAgentTools } from "@/server/agent/bootstrap";
import { executeTool } from "@/server/agent/tool-executor";
import {
  getDefaultToolRegistry,
  type ToolRegistry,
} from "@/server/agent/tool-registry";
import type { StructuredToolResult } from "@/server/agent/types";
import type { Prisma } from "@prisma/client";

export type RunMarketingReadonlyInput = {
  message: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  maxRounds?: number;
};

export type RunMarketingReadonlyResult = {
  success: boolean;
  response: string;
  executionId: string;
  status: "COMPLETED" | "FAILED";
  toolResults: StructuredToolResult[];
  rounds: number;
  usage?: LLMUsage;
  model?: string;
  provider?: string;
  error?: { code: string; message: string };
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * Bounded LLM ↔ Tool loop for marketing.readonly.
 * All data access goes through ToolExecutor with READ-only permissions.
 */
export async function runMarketingReadonlyAgent(
  input: RunMarketingReadonlyInput,
): Promise<RunMarketingReadonlyResult> {
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
    throw new AgentError(
      "EXECUTION_FAILED",
      "LLM provider is not configured.",
      { meta: { code: "LLM_NOT_CONFIGURED" } },
    );
  }

  const registry =
    input.toolRegistry ?? bootstrapAgentTools(getDefaultToolRegistry());
  const store = input.store ?? prismaAgentRuntimeStore;
  const maxRounds = input.maxRounds ?? MAX_TOOL_CALL_ROUNDS;

  // Runtime enforcement: only READ tools on the allowlist.
  const allowedTools = listMarketingReadonlyTools(registry);
  if (allowedTools.length === 0) {
    throw new AgentError(
      "EXECUTION_FAILED",
      "No read-only marketing tools are registered.",
    );
  }

  const execution = await store.createExecution({
    agentId: MARKETING_READONLY_AGENT_ID,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    input: asJson({ message }),
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

  const toolSpecs = buildLLMToolSpecs(registry);
  const messages: LLMMessage[] = [
    { role: "system", content: MARKETING_READONLY_SYSTEM_PROMPT },
    {
      role: "system",
      content: `Execution scope (authoritative — do not invent IDs):\n${JSON.stringify(
        {
          userId: agentContext.user.id,
          workspaceId: agentContext.workspace.id,
          brandId: agentContext.brand.id,
        },
      )}`,
    },
    { role: "user", content: message },
  ];

  const toolResults: StructuredToolResult[] = [];
  let rounds = 0;
  let usage: LLMUsage | undefined;
  let model: string | undefined;
  let provider: string | undefined;
  let sequence = 0;

  try {
    while (rounds < maxRounds) {
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
          result: asJson({ toolResults, rounds }),
        });
        return {
          success: false,
          response:
            "I could not complete the analysis because the language model is unavailable.",
          executionId: execution.id,
          status: "FAILED",
          toolResults,
          rounds,
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
        const response =
          llmResult.content?.trim() ||
          "I could not produce an answer from the available evidence.";
        await store.updateExecution(execution.id, {
          status: "COMPLETED",
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
          result: asJson({
            response,
            toolResults,
            rounds,
            usage,
            model,
            provider,
          }),
        });
        return {
          success: true,
          response,
          executionId: execution.id,
          status: "COMPLETED",
          toolResults,
          rounds,
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
        const toolId = functionNameToToolId(call.name);
        sequence += 1;
        const startedAt = new Date();
        const toolRow = await store.createToolExecution({
          agentExecutionId: execution.id,
          toolId,
          sequence,
          input: asJson(sanitizeToolPayload(call.arguments, 2_000)),
          status: "RUNNING",
          startedAt,
        });

        let result: StructuredToolResult;

        if (!isMarketingReadonlyToolId(toolId)) {
          result = {
            tool: toolId,
            success: false,
            error: {
              code: "PERMISSION_DENIED",
              message: `Tool ${toolId} is not allowed for marketing.readonly.`,
            },
          };
        } else {
          result = await executeTool(registry, {
            toolId,
            input: call.arguments,
            context: {
              userId: input.userId,
              workspaceId: input.workspaceId,
              brandId: input.brandId,
              agentExecutionId: execution.id,
              allowedPermissions: READONLY_ALLOWED_PERMISSIONS,
            },
          });
        }

        toolResults.push(result);
        const completedAt = new Date();
        await store.completeToolExecution(toolRow.id, {
          status: result.success ? "COMPLETED" : "FAILED",
          output: asJson(
            sanitizeToolPayload(result, MAX_TOOL_RESULT_CHARS),
          ),
          errorCode: result.error?.code ?? null,
          errorMessage: result.error?.message ?? null,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          completedAt,
        });

        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify(
            sanitizeToolPayload(result, MAX_TOOL_RESULT_CHARS),
          ),
        });
      }
    }

    const response =
      "I reached the maximum number of tool-calling rounds before finishing a complete analysis. Please narrow the question or try again.";
    await store.updateExecution(execution.id, {
      status: "FAILED",
      completedAt: new Date(),
      errorCode: "MAX_TOOL_ROUNDS",
      errorMessage: response,
      result: asJson({ response, toolResults, rounds, usage, model, provider }),
    });
    return {
      success: false,
      response,
      executionId: execution.id,
      status: "FAILED",
      toolResults,
      rounds,
      usage,
      model,
      provider,
      error: { code: "MAX_TOOL_ROUNDS", message: response },
    };
  } catch (err) {
    const messageText =
      err instanceof AgentError ? err.message : "Agent execution failed.";
    const code = err instanceof AgentError ? err.code : "INTERNAL";
    await store.updateExecution(execution.id, {
      status: "FAILED",
      completedAt: new Date(),
      errorCode: code,
      errorMessage: messageText,
      result: asJson({ toolResults, rounds }),
    });
    throw err instanceof AgentError
      ? err
      : new AgentError("EXECUTION_FAILED", messageText, { cause: err });
  }
}

export { createMemoryAgentRuntimeStore };
