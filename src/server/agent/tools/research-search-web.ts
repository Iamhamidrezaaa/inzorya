import { z } from "zod";
import { ResearchProviderError } from "@/server/research";
import { getWebSearchProvider } from "@/server/research/registry";
import type { ToolDefinition } from "@/server/agent/types";
import { clampLimit } from "@/server/agent/tools/scope";

const inputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
  searchDepth: z.string().optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  query: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string().nullable(),
      source: z.string().nullable(),
    }),
  ),
});

export const researchSearchWebTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "research.searchWeb",
  name: "Web Search",
  description:
    "Provider-agnostic web search for Agents (Tavily when configured).",
  version: "1.1.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input) {
    const limit = clampLimit(input.limit, 5, 10);
    const provider = getWebSearchProvider();

    if (!provider.isConfigured()) {
      return {
        available: false,
        reason: "WEB_SEARCH_PROVIDER_NOT_CONFIGURED",
        query: input.query,
        results: [],
      };
    }

    try {
      const results = await provider.search({
        query: input.query,
        limit,
        searchDepth: input.searchDepth,
      });
      return {
        available: true,
        query: input.query,
        results: results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source: r.source,
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
        query: input.query,
        results: [],
      };
    }
  },
};
