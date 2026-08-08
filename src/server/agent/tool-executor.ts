import { AgentError, toPublicToolError } from "@/server/agent/errors";
import { hasToolPermission } from "@/server/agent/permissions";
import { toolFailure, toolSuccess } from "@/server/agent/results";
import type { ToolRegistry } from "@/server/agent/tool-registry";
import type {
  StructuredToolResult,
  ToolContext,
} from "@/server/agent/types";

export type ExecuteToolOptions = {
  toolId: string;
  input: unknown;
  context: ToolContext;
};

/**
 * Validates input/output, enforces permissions and enabled state,
 * and returns a structured result (never raw exceptions).
 */
export async function executeTool(
  registry: ToolRegistry,
  options: ExecuteToolOptions,
): Promise<StructuredToolResult> {
  const { toolId, input, context } = options;
  const started = Date.now();

  const tool = registry.getTool(toolId);
  if (!tool) {
    return toolFailure(toolId, {
      code: "TOOL_NOT_FOUND",
      message: `Unknown tool: ${toolId}`,
    });
  }

  if (!tool.enabled) {
    return toolFailure(toolId, {
      code: "TOOL_DISABLED",
      message: `Tool is disabled: ${toolId}`,
    });
  }

  if (!hasToolPermission(context.allowedPermissions, tool.permission)) {
    return toolFailure(toolId, {
      code: "PERMISSION_DENIED",
      message: `Permission ${tool.permission} is not granted for tool ${toolId}`,
    });
  }

  // Soft scope check: tool context must carry all scope ids.
  if (!context.userId || !context.workspaceId || !context.brandId) {
    return toolFailure(toolId, {
      code: "SCOPE_VIOLATION",
      message: "Tool execution requires userId, workspaceId, and brandId.",
    });
  }

  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    return toolFailure(
      toolId,
      {
        code: "INVALID_INPUT",
        message: "Tool input failed validation.",
      },
      { issues: parsed.error.issues.map((i) => i.message) },
    );
  }

  try {
    const raw = await tool.execute(parsed.data, context);
    const out = tool.outputSchema.safeParse(raw);
    if (!out.success) {
      return toolFailure(
        toolId,
        {
          code: "INVALID_OUTPUT",
          message: "Tool output failed validation.",
        },
        { durationMs: Date.now() - started },
      );
    }
    return toolSuccess(toolId, out.data, {
      durationMs: Date.now() - started,
    });
  } catch (err) {
    if (err instanceof AgentError && err.code === "SCOPE_VIOLATION") {
      return toolFailure(toolId, toPublicToolError(err), {
        durationMs: Date.now() - started,
      });
    }
    return toolFailure(toolId, toPublicToolError(err), {
      durationMs: Date.now() - started,
    });
  }
}
