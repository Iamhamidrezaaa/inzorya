import type { AIProviderAdapter } from "@/server/ai/providers/types";
import { MockAIProvider } from "@/server/ai/providers/mock";
import {
  AnthropicProvider,
  GeminiProvider,
  LocalProvider,
  OpenAIProvider,
  OpenRouterProvider,
} from "@/server/ai/providers/stubs";
import type { AIProviderKey } from "@/server/ai/config";

const adapters: AIProviderAdapter[] = [
  new MockAIProvider(),
  new OpenAIProvider(),
  new AnthropicProvider(),
  new GeminiProvider(),
  new OpenRouterProvider(),
  new LocalProvider(),
];

export function listProviderAdapters(): AIProviderAdapter[] {
  return adapters;
}

export function getProviderAdapter(key: AIProviderKey): AIProviderAdapter | undefined {
  return adapters.find((a) => a.key === key);
}
