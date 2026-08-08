export type AgentErrorCode =
  | "TOOL_NOT_FOUND"
  | "TOOL_DISABLED"
  | "TOOL_ALREADY_REGISTERED"
  | "INVALID_INPUT"
  | "INVALID_OUTPUT"
  | "PERMISSION_DENIED"
  | "AGENT_NOT_FOUND"
  | "AGENT_ALREADY_REGISTERED"
  | "EXECUTION_FAILED"
  | "SCOPE_VIOLATION"
  | "INTERNAL";

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: AgentErrorCode,
    message: string,
    opts?: { meta?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.meta = opts?.meta;
    if (opts?.cause) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

export function toPublicToolError(err: unknown): {
  code: string;
  message: string;
} {
  if (err instanceof AgentError) {
    return { code: err.code, message: err.message };
  }
  return {
    code: "INTERNAL",
    message: "Tool execution failed.",
  };
}
