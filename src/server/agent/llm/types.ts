export type LLMRole = "system" | "user" | "assistant" | "tool";

export type LLMToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type LLMMessage = {
  role: LLMRole;
  content: string | null;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
  name?: string;
};

export type LLMToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LLMChatRequest = {
  model: string;
  messages: LLMMessage[];
  tools?: LLMToolSpec[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type LLMUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type LLMChatResult = {
  content: string | null;
  toolCalls: LLMToolCall[];
  finishReason?: string;
  usage?: LLMUsage;
  model: string;
  provider: string;
};

export type LLMProviderErrorCode =
  | "LLM_NOT_CONFIGURED"
  | "LLM_AUTH_FAILED"
  | "LLM_RATE_LIMITED"
  | "LLM_TIMEOUT"
  | "LLM_INVALID_RESPONSE"
  | "LLM_REQUEST_FAILED";

export class LLMProviderError extends Error {
  readonly code: LLMProviderErrorCode;

  constructor(code: LLMProviderErrorCode, message: string) {
    super(message);
    this.name = "LLMProviderError";
    this.code = code;
  }
}

/** Chat + tool-calling interface used by Agent loops (not one-shot AI tasks). */
export interface LLMProvider {
  readonly id: string;
  isConfigured(): boolean;
  chat(req: LLMChatRequest): Promise<LLMChatResult>;
}
