import {
  CONTENT_STRATEGIST_TOOL_IDS,
  type ContentStrategistToolId,
} from "@/server/agent/content-strategist/constants";
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

export function isContentStrategistToolId(
  toolId: string,
): toolId is ContentStrategistToolId {
  return (CONTENT_STRATEGIST_TOOL_IDS as readonly string[]).includes(toolId);
}

export function listContentStrategistTools(
  registry: ToolRegistry,
): ToolDefinition[] {
  return listAllowedReadTools(registry, CONTENT_STRATEGIST_TOOL_IDS);
}

export function buildContentStrategistLLMToolSpecs(
  registry: ToolRegistry,
): LLMToolSpec[] {
  return buildLLMToolSpecsForAllowlist(registry, CONTENT_STRATEGIST_TOOL_IDS);
}
