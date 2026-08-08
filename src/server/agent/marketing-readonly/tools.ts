import { z } from "zod";
import type { LLMToolSpec } from "@/server/agent/llm/types";
import {
  MARKETING_READONLY_TOOL_IDS,
  type MarketingReadonlyToolId,
} from "@/server/agent/marketing-readonly/constants";
import type { ToolRegistry } from "@/server/agent/tool-registry";
import type { ToolDefinition, ToolPermission } from "@/server/agent/types";

/** OpenAI function names allow [a-zA-Z0-9_-] only — map tool ids. */
export function toolIdToFunctionName(toolId: string): string {
  return toolId.replace(/\./g, "__");
}

export function functionNameToToolId(name: string): string {
  return name.replace(/__/g, ".");
}

export function isMarketingReadonlyToolId(
  toolId: string,
): toolId is MarketingReadonlyToolId {
  return (MARKETING_READONLY_TOOL_IDS as readonly string[]).includes(toolId);
}

export function listMarketingReadonlyTools(
  registry: ToolRegistry,
): ToolDefinition[] {
  return MARKETING_READONLY_TOOL_IDS.map((id) => registry.getTool(id)).filter(
    (t): t is ToolDefinition =>
      Boolean(t) && t!.enabled && t!.permission === "READ",
  );
}

export function buildLLMToolSpecs(registry: ToolRegistry): LLMToolSpec[] {
  return listMarketingReadonlyTools(registry).map((tool) => {
    let parameters: Record<string, unknown> = {
      type: "object",
      properties: {},
      additionalProperties: true,
    };
    try {
      const schema = z.toJSONSchema(tool.inputSchema) as Record<
        string,
        unknown
      >;
      delete schema.$schema;
      parameters = schema;
    } catch {
      // Keep loose object schema if conversion fails.
    }
    return {
      name: toolIdToFunctionName(tool.id),
      description: `${tool.name}: ${tool.description}`,
      parameters,
    };
  });
}

export const READONLY_ALLOWED_PERMISSIONS: ToolPermission[] = ["READ"];

export function sanitizeToolPayload(
  value: unknown,
  maxChars: number,
): unknown {
  try {
    const json = JSON.stringify(value);
    if (json.length <= maxChars) {
      return JSON.parse(json) as unknown;
    }
    return {
      truncated: true,
      preview: json.slice(0, maxChars),
    };
  } catch {
    return { truncated: true, preview: String(value).slice(0, maxChars) };
  }
}
