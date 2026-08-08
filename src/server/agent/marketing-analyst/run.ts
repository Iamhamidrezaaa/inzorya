import {
  MARKETING_ANALYST_AGENT_ID,
  MARKETING_ANALYST_SYSTEM_PROMPT,
  MARKETING_ANALYST_TOOL_IDS,
  MAX_TOOL_CALL_ROUNDS,
} from "@/server/agent/marketing-analyst/constants";
import {
  parseMarketingAnalysis,
  type MarketingAnalysis,
} from "@/server/agent/marketing-analyst/output";
import {
  runReadonlyToolCallingAgent,
  type RunReadonlyToolCallingResult,
} from "@/server/agent/loop";
import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";

export type RunMarketingAnalystInput = {
  message: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  maxRounds?: number;
};

export type RunMarketingAnalystResult = RunReadonlyToolCallingResult & {
  analysis: MarketingAnalysis;
};

/**
 * Marketing Analyst — READ-only business/marketing intelligence via Tools.
 * No Agent-to-Agent. No Prisma. No mutation. No predictions.
 */
export async function runMarketingAnalystAgent(
  input: RunMarketingAnalystInput,
): Promise<RunMarketingAnalystResult> {
  const result = await runReadonlyToolCallingAgent({
    agentId: MARKETING_ANALYST_AGENT_ID,
    systemPrompt: MARKETING_ANALYST_SYSTEM_PROMPT,
    allowedToolIds: MARKETING_ANALYST_TOOL_IDS,
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
      "Use existing READ Tools only. Never invent metrics. Never claim causality. Never mutate strategy/content/calendar/publishing.",
      "Output requirement: return ONLY the Marketing Analysis JSON object.",
      "If LinkedIn analytics capability is unavailable, report capability_not_available — do not invent LinkedIn metrics.",
      "Meta/TikTok unavailable; Pinterest removed.",
    ],
  });

  const analysis = parseMarketingAnalysis(result.response, input.message);

  return {
    ...result,
    analysis,
  };
}
