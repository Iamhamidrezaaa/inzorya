export type AIProviderKey =
  | "openai"
  | "gemini"
  | "anthropic"
  | "openrouter"
  | "local"
  | "mock";

export type OutputFormat = "json" | "markdown" | "text";

export type RoutePreference = "cost" | "latency" | "quality" | "balanced";

export function getAIConfig() {
  const priority = (process.env.AI_PROVIDER_PRIORITY || "mock,openai,anthropic,gemini,openrouter,local")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as AIProviderKey[];

  return {
    enabled: process.env.AI_PLATFORM_ENABLED !== "false",
    forceMock: process.env.AI_FORCE_MOCK !== "false",
    providerPriority: priority,
    defaultRoutePreference: (process.env.AI_ROUTE_PREFERENCE ||
      "balanced") as RoutePreference,
    defaultTimeoutMs: Number(process.env.AI_DEFAULT_TIMEOUT_MS || 30_000),
    maxRetries: Number(process.env.AI_MAX_RETRIES || 2),
    dailyCostLimitUsd: Number(process.env.AI_DAILY_COST_LIMIT_USD || 50),
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    geminiApiKey: process.env.GOOGLE_AI_API_KEY || "",
    openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  };
}
