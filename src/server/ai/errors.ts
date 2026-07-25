export type AIErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "SCHEMA_MISMATCH"
  | "RATE_LIMIT"
  | "AUTHENTICATION"
  | "RETRY_EXHAUSTED"
  | "GUARDRAIL_BLOCKED"
  | "TASK_NOT_FOUND"
  | "MODEL_NOT_FOUND"
  | "CANCELLED"
  | "INTERNAL";

export class AIPlatformError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: AIErrorCode,
    message: string,
    opts?: { retryable?: boolean; meta?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message);
    this.name = "AIPlatformError";
    this.code = code;
    this.retryable = opts?.retryable ?? false;
    this.meta = opts?.meta;
    if (opts?.cause) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}
