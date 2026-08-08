import {
  SOCIAL_ANALYTICS_AGENT_ID,
  SOCIAL_ANALYTICS_SYSTEM_PROMPT,
  SOCIAL_ANALYTICS_TOOL_IDS,
  MAX_TOOL_CALL_ROUNDS,
} from "@/server/agent/social-analytics/constants";
import {
  parseSocialAnalyticsIntelligence,
  type SocialAnalyticsIntelligence,
} from "@/server/agent/social-analytics/output";
import { getSocialAnalyticsProvider } from "@/server/agent/social-analytics/provider";
import {
  runReadonlyToolCallingAgent,
  type RunReadonlyToolCallingResult,
} from "@/server/agent/loop";
import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";

export type RunSocialAnalyticsInput = {
  message: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  maxRounds?: number;
};

export type RunSocialAnalyticsResult = RunReadonlyToolCallingResult & {
  intelligence: SocialAnalyticsIntelligence;
};

/**
 * Social Analytics — READ-only interpretation of real Tool-backed metrics.
 * No direct Prisma / social API access. Generation of insights is LLM output only.
 */
export async function runSocialAnalyticsAgent(
  input: RunSocialAnalyticsInput,
): Promise<RunSocialAnalyticsResult> {
  const provider = getSocialAnalyticsProvider();

  const result = await runReadonlyToolCallingAgent({
    agentId: SOCIAL_ANALYTICS_AGENT_ID,
    systemPrompt: SOCIAL_ANALYTICS_SYSTEM_PROMPT,
    allowedToolIds: SOCIAL_ANALYTICS_TOOL_IDS,
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
      `Analytics provider abstraction: ${provider.id} (tool-backed ContentMetric / snapshots). Never invent connected platforms or metrics.`,
      "Output requirement: return ONLY the Social Analytics JSON object. No content generation. No performance prediction. No publishing.",
    ],
  });

  const intelligence = parseSocialAnalyticsIntelligence(
    result.response,
    input.message,
  );

  return {
    ...result,
    intelligence,
  };
}
