import {
  MARKETING_READONLY_AGENT_ID,
  MARKETING_READONLY_SYSTEM_PROMPT,
  MARKETING_READONLY_TOOL_IDS,
  MAX_TOOL_CALL_ROUNDS,
} from "@/server/agent/marketing-readonly/constants";
import {
  runReadonlyToolCallingAgent,
  type RunReadonlyToolCallingResult,
} from "@/server/agent/loop";
import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";

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

export type RunMarketingReadonlyResult = RunReadonlyToolCallingResult;

/**
 * Bounded LLM ↔ Tool loop for marketing.readonly.
 * All data access goes through ToolExecutor with READ-only permissions.
 */
export async function runMarketingReadonlyAgent(
  input: RunMarketingReadonlyInput,
): Promise<RunMarketingReadonlyResult> {
  return runReadonlyToolCallingAgent({
    agentId: MARKETING_READONLY_AGENT_ID,
    systemPrompt: MARKETING_READONLY_SYSTEM_PROMPT,
    allowedToolIds: MARKETING_READONLY_TOOL_IDS,
    message: input.message,
    userId: input.userId,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    llm: input.llm,
    toolRegistry: input.toolRegistry,
    store: input.store,
    maxRounds: input.maxRounds ?? MAX_TOOL_CALL_ROUNDS,
  });
}

export { createMemoryAgentRuntimeStore } from "@/server/agent/runtime";
