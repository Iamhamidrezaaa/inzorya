import {
  CONTENT_CREATOR_TOOL_IDS,
  type ContentCreatorToolId,
} from "@/server/agent/content-creator/constants";
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

export function isContentCreatorToolId(
  toolId: string,
): toolId is ContentCreatorToolId {
  return (CONTENT_CREATOR_TOOL_IDS as readonly string[]).includes(toolId);
}

export function listContentCreatorTools(
  registry: ToolRegistry,
): ToolDefinition[] {
  return listAllowedReadTools(registry, CONTENT_CREATOR_TOOL_IDS);
}

export function buildContentCreatorLLMToolSpecs(
  registry: ToolRegistry,
): LLMToolSpec[] {
  return buildLLMToolSpecsForAllowlist(registry, CONTENT_CREATOR_TOOL_IDS);
}
