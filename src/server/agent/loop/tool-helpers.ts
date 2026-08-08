import { z } from "zod";
import type { LLMToolSpec } from "@/server/agent/llm/types";
import type { ToolRegistry } from "@/server/agent/tool-registry";
import type { ToolDefinition, ToolPermission } from "@/server/agent/types";

/** OpenAI function names allow [a-zA-Z0-9_-] only — map tool ids. */
export function toolIdToFunctionName(toolId: string): string {
  return toolId.replace(/\./g, "__");
}

export function functionNameToToolId(name: string): string {
  return name.replace(/__/g, ".");
}

export const READONLY_ALLOWED_PERMISSIONS: ToolPermission[] = ["READ"];

export function listAllowedReadTools(
  registry: ToolRegistry,
  allowedToolIds: readonly string[],
): ToolDefinition[] {
  return allowedToolIds
    .map((id) => registry.getTool(id))
    .filter(
      (t): t is ToolDefinition =>
        Boolean(t) && t!.enabled && t!.permission === "READ",
    );
}

export function buildLLMToolSpecsForAllowlist(
  registry: ToolRegistry,
  allowedToolIds: readonly string[],
): LLMToolSpec[] {
  return listAllowedReadTools(registry, allowedToolIds).map((tool) => {
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
