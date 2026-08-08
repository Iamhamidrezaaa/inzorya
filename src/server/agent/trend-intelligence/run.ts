import {
  TREND_INTELLIGENCE_AGENT_ID,
  TREND_INTELLIGENCE_SYSTEM_PROMPT,
  TREND_INTELLIGENCE_TOOL_IDS,
  MAX_TOOL_CALL_ROUNDS,
} from "@/server/agent/trend-intelligence/constants";
import {
  parseTrendIntelligence,
  type TrendIntelligenceResult,
} from "@/server/agent/trend-intelligence/output";
import {
  runReadonlyToolCallingAgent,
  type RunReadonlyToolCallingResult,
} from "@/server/agent/loop";
import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";

export type RunTrendIntelligenceInput = {
  message: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  maxRounds?: number;
};

export type RunTrendIntelligenceResult = RunReadonlyToolCallingResult & {
  intelligence: TrendIntelligenceResult;
};

/**
 * Trend Intelligence specialist — READ-only research → structured intelligence.
 * Uses the shared Agent Runtime tool-calling loop (no second architecture).
 */
export async function runTrendIntelligenceAgent(
  input: RunTrendIntelligenceInput,
): Promise<RunTrendIntelligenceResult> {
  const result = await runReadonlyToolCallingAgent({
    agentId: TREND_INTELLIGENCE_AGENT_ID,
    systemPrompt: TREND_INTELLIGENCE_SYSTEM_PROMPT,
    allowedToolIds: TREND_INTELLIGENCE_TOOL_IDS,
    message: input.message,
    userId: input.userId,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    llm: input.llm,
    toolRegistry: input.toolRegistry,
    store: input.store,
    maxRounds: input.maxRounds ?? MAX_TOOL_CALL_ROUNDS,
    temperature: 0.2,
    extraSystemMessages: [
      "Output requirement: return ONLY the Trend Intelligence JSON object described in the system prompt. No prose outside JSON.",
    ],
  });

  const intelligence = parseTrendIntelligence(result.response, input.message);

  return {
    ...result,
    intelligence,
  };
}
