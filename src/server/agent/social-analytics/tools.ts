import {
  SOCIAL_ANALYTICS_TOOL_IDS,
  type SocialAnalyticsToolId,
} from "@/server/agent/social-analytics/constants";
import {
  toolIdToFunctionName,
  functionNameToToolId,
  listAllowedReadTools,
  buildLLMToolSpecsForAllowlist,
} from "@/server/agent/loop";
import type { ToolRegistry } from "@/server/agent/tool-registry";
import type { ToolDefinition } from "@/server/agent/types";
import type { LLMToolSpec } from "@/server/agent/llm/types";

export { toolIdToFunctionName, functionNameToToolId };

export function isSocialAnalyticsToolId(
  toolId: string,
): toolId is SocialAnalyticsToolId {
  return (SOCIAL_ANALYTICS_TOOL_IDS as readonly string[]).includes(toolId);
}

export function listSocialAnalyticsTools(
  registry: ToolRegistry,
): ToolDefinition[] {
  return listAllowedReadTools(registry, SOCIAL_ANALYTICS_TOOL_IDS);
}

export function buildSocialAnalyticsLLMToolSpecs(
  registry: ToolRegistry,
): LLMToolSpec[] {
  return buildLLMToolSpecsForAllowlist(registry, SOCIAL_ANALYTICS_TOOL_IDS);
}
