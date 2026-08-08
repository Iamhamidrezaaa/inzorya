import type {
  StructuredToolResult,
  ToolErrorPayload,
} from "@/server/agent/types";

export function toolSuccess<T>(
  toolId: string,
  data: T,
  metadata?: Record<string, unknown>,
): StructuredToolResult<T> {
  return {
    tool: toolId,
    success: true,
    data,
    metadata,
  };
}

export function toolFailure(
  toolId: string,
  error: ToolErrorPayload,
  metadata?: Record<string, unknown>,
): StructuredToolResult {
  return {
    tool: toolId,
    success: false,
    error,
    metadata,
  };
}
