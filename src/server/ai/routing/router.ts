import { prisma } from "@/lib/db";
import type { AIProviderKey, RoutePreference } from "@/server/ai/config";
import { getAIConfig } from "@/server/ai/config";
import { getProviderAdapter } from "@/server/ai/providers/registry";
import { AIPlatformError } from "@/server/ai/errors";

export type ModelCapabilities = {
  vision?: boolean;
  json?: boolean;
  streaming?: boolean;
  tools?: boolean;
};

export async function ensureAICatalog() {
  const providers: {
    key: AIProviderKey;
    name: string;
    priority: number;
  }[] = [
    { key: "mock", name: "Mock Provider", priority: 0 },
    { key: "openai", name: "OpenAI", priority: 10 },
    { key: "anthropic", name: "Anthropic", priority: 20 },
    { key: "gemini", name: "Google Gemini", priority: 30 },
    { key: "openrouter", name: "OpenRouter", priority: 40 },
    { key: "local", name: "Local Models", priority: 90 },
  ];

  for (const p of providers) {
    await prisma.aIProvider.upsert({
      where: { key: p.key },
      create: { key: p.key, name: p.name, priority: p.priority, status: "ACTIVE" },
      update: { name: p.name, priority: p.priority },
    });
  }

  const byKey = Object.fromEntries(
    (await prisma.aIProvider.findMany()).map((p) => [p.key, p.id]),
  );

  const models = [
    {
      key: "mock-general",
      provider: "mock",
      displayName: "Mock General",
      contextLength: 128000,
      supportsVision: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsTools: true,
      capabilities: ["general", "json", "vision", "tools"],
      inputPricePer1M: 0,
      outputPricePer1M: 0,
    },
    {
      key: "openai-gpt-4o-mini",
      provider: "openai",
      displayName: "GPT-4o mini",
      contextLength: 128000,
      supportsVision: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsTools: true,
      capabilities: ["general", "json", "vision", "tools", "fast"],
      inputPricePer1M: 0.15,
      outputPricePer1M: 0.6,
    },
    {
      key: "anthropic-claude-sonnet",
      provider: "anthropic",
      displayName: "Claude Sonnet",
      contextLength: 200000,
      supportsVision: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsTools: true,
      capabilities: ["general", "json", "vision", "tools", "quality"],
      inputPricePer1M: 3,
      outputPricePer1M: 15,
    },
    {
      key: "gemini-flash",
      provider: "gemini",
      displayName: "Gemini Flash",
      contextLength: 1000000,
      supportsVision: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsTools: false,
      capabilities: ["general", "json", "vision", "fast"],
      inputPricePer1M: 0.1,
      outputPricePer1M: 0.4,
    },
    {
      key: "openrouter-auto",
      provider: "openrouter",
      displayName: "OpenRouter Auto",
      contextLength: 128000,
      supportsVision: true,
      supportsJson: true,
      supportsStreaming: true,
      supportsTools: true,
      capabilities: ["general", "json", "tools"],
      inputPricePer1M: 0.5,
      outputPricePer1M: 1.5,
    },
    {
      key: "local-default",
      provider: "local",
      displayName: "Local Default",
      contextLength: 8192,
      supportsVision: false,
      supportsJson: true,
      supportsStreaming: true,
      supportsTools: false,
      capabilities: ["general", "json"],
      inputPricePer1M: 0,
      outputPricePer1M: 0,
    },
  ] as const;

  for (const m of models) {
    await prisma.aIModel.upsert({
      where: { key: m.key },
      create: {
        key: m.key,
        displayName: m.displayName,
        providerId: byKey[m.provider]!,
        contextLength: m.contextLength,
        supportsVision: m.supportsVision,
        supportsJson: m.supportsJson,
        supportsStreaming: m.supportsStreaming,
        supportsTools: m.supportsTools,
        capabilities: [...m.capabilities],
        inputPricePer1M: m.inputPricePer1M,
        outputPricePer1M: m.outputPricePer1M,
        status: "ACTIVE",
      },
      update: {
        displayName: m.displayName,
        capabilities: [...m.capabilities],
        inputPricePer1M: m.inputPricePer1M,
        outputPricePer1M: m.outputPricePer1M,
      },
    });
  }
}

export async function routeModel(input: {
  taskType?: string;
  required?: ModelCapabilities;
  preference?: RoutePreference;
  preferredModelKey?: string | null;
}) {
  await ensureAICatalog();
  const config = getAIConfig();
  const preference = input.preference || config.defaultRoutePreference;

  if (input.preferredModelKey && !config.forceMock) {
    const preferred = await prisma.aIModel.findUnique({
      where: { key: input.preferredModelKey },
      include: { provider: true },
    });
    if (preferred && preferred.status === "ACTIVE") {
      const adapter = getProviderAdapter(preferred.provider.key as AIProviderKey);
      if (adapter?.isAvailable()) {
        return { model: preferred, provider: preferred.provider, adapter };
      }
    }
  }

  const models = await prisma.aIModel.findMany({
    where: { status: "ACTIVE", provider: { status: "ACTIVE" } },
    include: { provider: true },
  });

  let candidates = models.filter((m) => {
    const adapter = getProviderAdapter(m.provider.key as AIProviderKey);
    if (!adapter?.isAvailable()) return false;
    if (input.required?.vision && !m.supportsVision) return false;
    if (input.required?.json && !m.supportsJson) return false;
    if (input.required?.streaming && !m.supportsStreaming) return false;
    if (input.required?.tools && !m.supportsTools) return false;
    return true;
  });

  if (config.forceMock) {
    candidates = candidates.filter((m) => m.provider.key === "mock");
  }

  if (candidates.length === 0) {
    // Fallback to mock always
    const mock = models.find((m) => m.key === "mock-general");
    if (!mock) {
      throw new AIPlatformError("MODEL_NOT_FOUND", "No models available", {
        retryable: false,
      });
    }
    const adapter = getProviderAdapter("mock")!;
    return { model: mock, provider: mock.provider, adapter };
  }

  candidates.sort((a, b) => {
    const pa = config.providerPriority.indexOf(a.provider.key as AIProviderKey);
    const pb = config.providerPriority.indexOf(b.provider.key as AIProviderKey);
    const priorityA = pa === -1 ? 999 : pa;
    const priorityB = pb === -1 ? 999 : pb;
    if (preference === "cost") {
      return (a.inputPricePer1M || 0) - (b.inputPricePer1M || 0);
    }
    if (preference === "latency") {
      const fastA = a.capabilities.includes("fast") ? 0 : 1;
      const fastB = b.capabilities.includes("fast") ? 0 : 1;
      return fastA - fastB || priorityA - priorityB;
    }
    if (preference === "quality") {
      const qA = a.capabilities.includes("quality") ? 0 : 1;
      const qB = b.capabilities.includes("quality") ? 0 : 1;
      return qA - qB || priorityA - priorityB;
    }
    return priorityA - priorityB || a.provider.priority - b.provider.priority;
  });

  const selected = candidates[0]!;
  const adapter = getProviderAdapter(selected.provider.key as AIProviderKey)!;
  return { model: selected, provider: selected.provider, adapter };
}
