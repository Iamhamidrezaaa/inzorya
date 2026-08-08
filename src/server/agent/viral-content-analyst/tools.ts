import {
  VIRAL_CONTENT_ANALYST_TOOL_IDS,
  type ViralContentAnalystToolId,
} from "@/server/agent/viral-content-analyst/constants";
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

export function isViralContentAnalystToolId(
  toolId: string,
): toolId is ViralContentAnalystToolId {
  return (VIRAL_CONTENT_ANALYST_TOOL_IDS as readonly string[]).includes(toolId);
}

export function listViralContentAnalystTools(
  registry: ToolRegistry,
): ToolDefinition[] {
  return listAllowedReadTools(registry, VIRAL_CONTENT_ANALYST_TOOL_IDS);
}

export function buildViralContentAnalystLLMToolSpecs(
  registry: ToolRegistry,
): LLMToolSpec[] {
  return buildLLMToolSpecsForAllowlist(
    registry,
    VIRAL_CONTENT_ANALYST_TOOL_IDS,
  );
}
