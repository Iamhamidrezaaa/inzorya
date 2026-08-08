import {
  TREND_INTELLIGENCE_TOOL_IDS,
  type TrendIntelligenceToolId,
} from "@/server/agent/trend-intelligence/constants";
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

export function isTrendIntelligenceToolId(
  toolId: string,
): toolId is TrendIntelligenceToolId {
  return (TREND_INTELLIGENCE_TOOL_IDS as readonly string[]).includes(toolId);
}

export function listTrendIntelligenceTools(
  registry: ToolRegistry,
): ToolDefinition[] {
  return listAllowedReadTools(registry, TREND_INTELLIGENCE_TOOL_IDS);
}

export function buildTrendIntelligenceLLMToolSpecs(
  registry: ToolRegistry,
): LLMToolSpec[] {
  return buildLLMToolSpecsForAllowlist(registry, TREND_INTELLIGENCE_TOOL_IDS);
}
