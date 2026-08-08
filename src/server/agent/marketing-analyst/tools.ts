import {
  MARKETING_ANALYST_TOOL_IDS,
  type MarketingAnalystToolId,
} from "@/server/agent/marketing-analyst/constants";
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

export function isMarketingAnalystToolId(
  toolId: string,
): toolId is MarketingAnalystToolId {
  return (MARKETING_ANALYST_TOOL_IDS as readonly string[]).includes(toolId);
}

export function listMarketingAnalystTools(
  registry: ToolRegistry,
): ToolDefinition[] {
  return listAllowedReadTools(registry, MARKETING_ANALYST_TOOL_IDS);
}

export function buildMarketingAnalystLLMToolSpecs(
  registry: ToolRegistry,
): LLMToolSpec[] {
  return buildLLMToolSpecsForAllowlist(registry, MARKETING_ANALYST_TOOL_IDS);
}
