import type { AIProviderAdapter, ProviderGenerateRequest } from "@/server/ai/providers/types";
import { AIPlatformError } from "@/server/ai/errors";
import { getAIConfig, type AIProviderKey } from "@/server/ai/config";

abstract class StubProvider implements AIProviderAdapter {
  abstract readonly key: AIProviderKey;
  abstract readonly displayName: string;
  abstract envKeyPresent(): boolean;

  isAvailable() {
    const config = getAIConfig();
    if (config.forceMock) return false;
    return this.envKeyPresent();
  }

  async generate(_req: ProviderGenerateRequest): Promise<never> {
    throw new AIPlatformError(
      "PROVIDER_UNAVAILABLE",
      `${this.displayName} adapter is registered but live calls are disabled. Set AI_FORCE_MOCK=false and provide credentials when ready.`,
      { retryable: false, meta: { provider: this.key } },
    );
  }
}

export class OpenAIProvider extends StubProvider {
  readonly key = "openai" as const;
  readonly displayName = "OpenAI";
  envKeyPresent() {
    return Boolean(getAIConfig().openaiApiKey);
  }
}

export class GeminiProvider extends StubProvider {
  readonly key = "gemini" as const;
  readonly displayName = "Google Gemini";
  envKeyPresent() {
    return Boolean(getAIConfig().geminiApiKey);
  }
}

export class AnthropicProvider extends StubProvider {
  readonly key = "anthropic" as const;
  readonly displayName = "Anthropic Claude";
  envKeyPresent() {
    return Boolean(getAIConfig().anthropicApiKey);
  }
}

export class OpenRouterProvider extends StubProvider {
  readonly key = "openrouter" as const;
  readonly displayName = "OpenRouter";
  envKeyPresent() {
    return Boolean(getAIConfig().openRouterApiKey);
  }
}

export class LocalProvider extends StubProvider {
  readonly key = "local" as const;
  readonly displayName = "Local Models";
  envKeyPresent() {
    return process.env.AI_LOCAL_ENABLED === "true";
  }
}
