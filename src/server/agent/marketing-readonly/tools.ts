import {
  MARKETING_READONLY_TOOL_IDS,
  type MarketingReadonlyToolId,
} from "@/server/agent/marketing-readonly/constants";
import {
  toolIdToFunctionName,
  functionNameToToolId,
  READONLY_ALLOWED_PERMISSIONS,
  listAllowedReadTools,
  buildLLMToolSpecsForAllowlist,
  sanitizeToolPayload,
} from "@/server/agent/loop";
import type { ToolRegistry } from "@/server/agent/tool-registry";
import type { ToolDefinition } from "@/server/agent/types";
import type { LLMToolSpec } from "@/server/agent/llm/types";

export {
  toolIdToFunctionName,
  functionNameToToolId,
  READONLY_ALLOWED_PERMISSIONS,
  sanitizeToolPayload,
};

export function isMarketingReadonlyToolId(
  toolId: string,
): toolId is MarketingReadonlyToolId {
  return (MARKETING_READONLY_TOOL_IDS as readonly string[]).includes(toolId);
}

export function listMarketingReadonlyTools(
  registry: ToolRegistry,
): ToolDefinition[] {
  return listAllowedReadTools(registry, MARKETING_READONLY_TOOL_IDS);
}

export function buildLLMToolSpecs(registry: ToolRegistry): LLMToolSpec[] {
  return buildLLMToolSpecsForAllowlist(registry, MARKETING_READONLY_TOOL_IDS);
}
