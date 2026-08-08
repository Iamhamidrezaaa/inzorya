import { OpenAILLMProvider } from "@/server/agent/llm/openai";
import type { LLMProvider } from "@/server/agent/llm/types";

let override: LLMProvider | null = null;
let defaultProvider: LLMProvider | null = null;

export function getAgentLLMProvider(): LLMProvider {
  if (override) return override;
  if (!defaultProvider) {
    defaultProvider = new OpenAILLMProvider();
  }
  return defaultProvider;
}

/** Tests / debug only. */
export function setAgentLLMProvider(provider: LLMProvider | null): void {
  override = provider;
}

export function resetAgentLLMProvider(): void {
  override = null;
  defaultProvider = null;
}

export type {
  LLMChatRequest,
  LLMChatResult,
  LLMMessage,
  LLMProvider,
  LLMToolCall,
  LLMToolSpec,
  LLMUsage,
} from "@/server/agent/llm/types";
export { LLMProviderError } from "@/server/agent/llm/types";
export { OpenAILLMProvider } from "@/server/agent/llm/openai";
export { FakeLLMProvider, type FakeLLMStep } from "@/server/agent/llm/fake";
