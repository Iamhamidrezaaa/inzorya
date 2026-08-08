import {
  mapHttpToSearchError,
} from "@/server/research/errors";
import {
  MAX_SEARCH_RESULTS,
  RESEARCH_TIMEOUT_MS,
  ResearchProviderError,
  type WebSearchInput,
  type WebSearchProvider,
  type WebSearchResultItem,
} from "@/server/research/types";
import { isTimeoutError } from "@/server/research/http";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

function normalizeDepth(raw?: string): "basic" | "advanced" | "fast" | "ultra-fast" {
  const v = (raw || "basic").toLowerCase();
  if (v === "advanced" || v === "fast" || v === "ultra-fast" || v === "basic") {
    return v;
  }
  return "basic";
}

export class TavilyWebSearchProvider implements WebSearchProvider {
  readonly id = "tavily";

  constructor(private readonly apiKey: string | undefined = process.env.TAVILY_API_KEY) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey?.trim());
  }

  async search(input: WebSearchInput): Promise<WebSearchResultItem[]> {
    if (!this.isConfigured()) {
      throw new ResearchProviderError(
        "WEB_SEARCH_PROVIDER_NOT_CONFIGURED",
        "Tavily API key is not configured.",
      );
    }

    const limit = Math.min(
      Math.max(1, input.limit ?? 5),
      MAX_SEARCH_RESULTS,
    );

    const body: Record<string, unknown> = {
      api_key: this.apiKey,
      query: input.query.slice(0, 400),
      max_results: limit,
      search_depth: normalizeDepth(input.searchDepth),
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    };
    if (input.topic) body.topic = input.topic;
    if (input.startDate && /^\d{4}-\d{2}-\d{2}/.test(input.startDate)) {
      body.start_date = input.startDate.slice(0, 10);
    }

    let response: Response;
    try {
      response = await fetch(TAVILY_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (isTimeoutError(err)) {
        throw mapHttpToSearchError(null, "abort");
      }
      throw mapHttpToSearchError(null, "network");
    }

    if (!response.ok) {
      throw mapHttpToSearchError(response.status, "http");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw mapHttpToSearchError(null, "parse");
    }

    const results = (payload as { results?: unknown })?.results;
    if (!Array.isArray(results)) {
      throw mapHttpToSearchError(null, "parse");
    }

    return results.slice(0, limit).map((raw) => {
      const row = raw as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title : "";
      const url = typeof row.url === "string" ? row.url : "";
      const snippet =
        typeof row.content === "string"
          ? row.content.slice(0, 1200)
          : null;
      const publishedAt =
        typeof row.published_date === "string" ? row.published_date : null;
      return {
        title: title || url || "Untitled",
        url,
        snippet,
        source: "tavily",
        publishedAt,
      };
    }).filter((r) => r.url);
  }
}
