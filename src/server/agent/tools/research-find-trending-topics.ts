import { z } from "zod";
import { ResearchProviderError } from "@/server/research";
import { getWebSearchProvider } from "@/server/research/registry";
import type { ToolDefinition } from "@/server/agent/types";
import { clampLimit } from "@/server/agent/tools/scope";

const inputSchema = z.object({
  topic: z.string().min(1),
  industry: z.string().optional(),
  location: z.string().optional(),
  from: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  topic: z.string(),
  signalKind: z.enum(["research_signal", "verified_social_trend", "none"]),
  note: z.string(),
  signals: z.array(
    z.object({
      title: z.string(),
      url: z.string().nullable(),
      snippet: z.string().nullable().optional(),
      source: z.string(),
      publishedAt: z.string().nullable(),
      relevance: z.string().nullable(),
      signalKind: z.literal("web_search_signal"),
    }),
  ),
});

function buildTrendQuery(input: {
  topic: string;
  industry?: string;
  location?: string;
}): string {
  const parts = [input.topic.trim(), "trends", "news"];
  if (input.industry?.trim()) parts.push(input.industry.trim());
  if (input.location?.trim()) parts.push(input.location.trim());
  return parts.join(" ").slice(0, 400);
}

export const researchFindTrendingTopicsTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "research.findTrendingTopics",
  name: "Find Trending Topics",
  description:
    "Collect current public web research signals via Tavily. Does not invent viral scores.",
  version: "1.1.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input) {
    const limit = clampLimit(input.limit, 8, 10);
    const provider = getWebSearchProvider();

    if (!provider.isConfigured()) {
      return {
        available: false,
        reason: "TREND_RESEARCH_PROVIDER_NOT_CONFIGURED",
        topic: input.topic,
        signalKind: "none",
        note: "Web search provider is not configured. No trend signals collected.",
        signals: [],
      };
    }

    const query = buildTrendQuery(input);
    const startDate =
      input.from && /^\d{4}-\d{2}-\d{2}/.test(input.from)
        ? input.from.slice(0, 10)
        : undefined;

    try {
      const results = await provider.search({
        query,
        limit,
        searchDepth: "basic",
        topic: "news",
        startDate,
      });

      if (results.length === 0) {
        return {
          available: true,
          topic: input.topic,
          signalKind: "research_signal",
          note: "No matching public web search signals were returned. These are research signals only — not verified social trends.",
          signals: [],
        };
      }

      return {
        available: true,
        topic: input.topic,
        signalKind: "research_signal",
        note: "Signals are public web search results (web_search_signal). Not verified social trends. No viral/engagement scores are inferred.",
        signals: results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source: r.source,
          publishedAt: r.publishedAt ?? null,
          relevance: null,
          signalKind: "web_search_signal" as const,
        })),
      };
    } catch (err) {
      const reason =
        err instanceof ResearchProviderError
          ? err.code
            : "WEB_SEARCH_PROVIDER_REQUEST_FAILED";
      return {
        available: false,
        reason,
        topic: input.topic,
        signalKind: "none",
        note: "Trend research provider request failed.",
        signals: [],
      };
    }
  },
};
