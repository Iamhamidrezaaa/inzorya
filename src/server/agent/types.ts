import type { z } from "zod";

/** Tool-level permission foundation (not full RBAC). */
export type ToolPermission = "READ" | "WRITE" | "EXECUTE" | "PUBLISH";

export type AgentDefinition = {
  id: string;
  name: string;
  version: string;
  description: string;
};

export type AgentExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** Controlled context passed into every Tool — never unrestricted app access. */
export type ToolContext = {
  userId: string;
  workspaceId: string;
  brandId: string;
  agentExecutionId: string;
  /** Permissions granted for this agent execution. */
  allowedPermissions: ToolPermission[];
};

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
  id: string;
  name: string;
  description: string;
  version: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  permission: ToolPermission;
  enabled: boolean;
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
};

export type ToolErrorPayload = {
  code: string;
  message: string;
};

export type StructuredToolResult<T = unknown> = {
  tool: string;
  success: boolean;
  data?: T;
  error?: ToolErrorPayload;
  metadata?: Record<string, unknown>;
};

/** Information available to an Agent — separate from Tools (actions). */
export type AgentContext = {
  user: { id: string };
  workspace: { id: string };
  brand: { id: string };
  relevantContext: Record<string, unknown> | null;
};

export type ToolCallRequest = {
  toolId: string;
  input: unknown;
};

export type AgentExecutionInput = {
  /** Optional predefined tool sequence. */
  toolCalls?: ToolCallRequest[];
  /** Convenience for system.test agent (maps to system.echo). */
  message?: string;
  [key: string]: unknown;
};

export type AgentExecutionResult = {
  executionId: string;
  agentId: string;
  status: AgentExecutionStatus;
  toolResults: StructuredToolResult[];
  result?: Record<string, unknown>;
  error?: ToolErrorPayload;
};
