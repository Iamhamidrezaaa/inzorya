import { AgentError } from "@/server/agent/errors";
import { executeTool as runTool } from "@/server/agent/tool-executor";
import type {
  StructuredToolResult,
  ToolContext,
  ToolDefinition,
} from "@/server/agent/types";

/**
 * Central Tool Registry. Tools are uniquely identified by `id`
 * (e.g. system.echo, calendar.getEvents).
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<any, any>>();

  registerTool(tool: ToolDefinition<any, any>): void {
    if (this.tools.has(tool.id)) {
      throw new AgentError(
        "TOOL_ALREADY_REGISTERED",
        `Tool already registered: ${tool.id}`,
        { meta: { toolId: tool.id } },
      );
    }
    this.tools.set(tool.id, tool);
  }

  getTool(toolId: string): ToolDefinition<any, any> | undefined {
    return this.tools.get(toolId);
  }

  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  listTools(): ToolDefinition<any, any>[] {
    return Array.from(this.tools.values());
  }

  async executeTool(
    toolId: string,
    input: unknown,
    context: ToolContext,
  ): Promise<StructuredToolResult> {
    return runTool(this, { toolId, input, context });
  }

  /** Clear all tools — primarily for isolated tests. */
  clear(): void {
    this.tools.clear();
  }
}

/** Process-wide default registry (bootstrapped once). */
let defaultRegistry: ToolRegistry | null = null;

export function getDefaultToolRegistry(): ToolRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolRegistry();
  }
  return defaultRegistry;
}

/** Reset default registry — tests only. */
export function resetDefaultToolRegistry(): void {
  defaultRegistry = new ToolRegistry();
}
