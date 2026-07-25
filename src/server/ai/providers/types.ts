import type { AIProviderKey, OutputFormat } from "@/server/ai/config";

export type ChatMessage = {
  role: "system" | "developer" | "user" | "assistant";
  content: string;
};

export type ProviderGenerateRequest = {
  modelKey: string;
  messages: ChatMessage[];
  outputFormat?: OutputFormat;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type ProviderGenerateResult = {
  content: string;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  raw?: unknown;
};

export type StreamChunk = {
  type: "token" | "partial" | "done" | "error";
  text?: string;
  error?: string;
};

export interface AIProviderAdapter {
  readonly key: AIProviderKey;
  readonly displayName: string;
  isAvailable(): boolean;
  generate(req: ProviderGenerateRequest): Promise<ProviderGenerateResult>;
  stream?(
    req: ProviderGenerateRequest,
  ): AsyncGenerator<StreamChunk, void, unknown>;
}
