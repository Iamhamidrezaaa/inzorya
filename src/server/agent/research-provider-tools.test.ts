import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ToolRegistry,
  bootstrapAgentTools,
  createMemoryAgentRuntimeStore,
  executeTool,
  resetAgentBootstrap,
  runAgentExecution,
} from "@/server/agent";
import type { ToolContext } from "@/server/agent/types";
import {
  ResearchProviderError,
  resetResearchProviders,
  setCrawlProvider,
  setWebSearchProvider,
  type CrawlProvider,
  type WebSearchProvider,
} from "@/server/research";

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findFirst: vi.fn() },
    marketingStrategy: { findUnique: vi.fn() },
    businessProfile: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  brand: { findFirst: ReturnType<typeof vi.fn> };
  marketingStrategy: { findUnique: ReturnType<typeof vi.fn> };
  businessProfile: { findUnique: ReturnType<typeof vi.fn> };
};

function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    userId: "user_1",
    workspaceId: "ws_1",
    brandId: "brand_1",
    agentExecutionId: "exec_1",
    allowedPermissions: ["READ"],
    ...overrides,
  };
}

function mockSearch(
  opts: Partial<WebSearchProvider> & {
    configured?: boolean;
    searchImpl?: WebSearchProvider["search"];
  } = {},
): WebSearchProvider {
  return {
    id: "mock-tavily",
    isConfigured: () => opts.configured ?? true,
    search:
      opts.searchImpl ??
      (async () => [
        {
          title: "Example",
          url: "https://example.com/a",
          snippet: "snippet",
          source: "tavily",
        },
      ]),
  };
}

function mockCrawl(
  opts: Partial<CrawlProvider> & {
    configured?: boolean;
    crawlImpl?: CrawlProvider["crawl"];
  } = {},
): CrawlProvider {
  return {
    id: "mock-firecrawl",
    isConfigured: () => opts.configured ?? true,
    crawl:
      opts.crawlImpl ??
      (async ({ url }) => ({
        url,
        title: "Example Domain",
        content: "# Hello",
        metadata: { description: "desc" },
        source: "firecrawl",
      })),
  };
}

describe("EPIC AGENT-004 — research provider layer", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentBootstrap();
    resetResearchProviders();
    registry = bootstrapAgentTools(new ToolRegistry());
    db.brand.findFirst.mockResolvedValue({ id: "brand_1" });
  });

  afterEach(() => {
    resetResearchProviders();
  });

  describe("research.searchWeb", () => {
    it("returns normalized results for a valid query", async () => {
      setWebSearchProvider(mockSearch());
      const result = await executeTool(registry, {
        toolId: "research.searchWeb",
        input: { query: "luxury fruit marketing", limit: 3 },
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        available: true,
        query: "luxury fruit marketing",
        results: [
          {
            title: "Example",
            url: "https://example.com/a",
            source: "tavily",
          },
        ],
      });
    });

    it("missing API key", async () => {
      setWebSearchProvider(mockSearch({ configured: false }));
      const result = await executeTool(registry, {
        toolId: "research.searchWeb",
        input: { query: "x" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: false,
        reason: "WEB_SEARCH_PROVIDER_NOT_CONFIGURED",
        results: [],
      });
    });

    it("provider auth failure", async () => {
      setWebSearchProvider(
        mockSearch({
          searchImpl: async () => {
            throw new ResearchProviderError(
              "WEB_SEARCH_PROVIDER_AUTH_FAILED",
              "auth",
            );
          },
        }),
      );
      const result = await executeTool(registry, {
        toolId: "research.searchWeb",
        input: { query: "x" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: false,
        reason: "WEB_SEARCH_PROVIDER_AUTH_FAILED",
      });
    });

    it("rate limit", async () => {
      setWebSearchProvider(
        mockSearch({
          searchImpl: async () => {
            throw new ResearchProviderError(
              "WEB_SEARCH_PROVIDER_RATE_LIMITED",
              "rate",
            );
          },
        }),
      );
      const result = await executeTool(registry, {
        toolId: "research.searchWeb",
        input: { query: "x" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        reason: "WEB_SEARCH_PROVIDER_RATE_LIMITED",
      });
    });

    it("timeout", async () => {
      setWebSearchProvider(
        mockSearch({
          searchImpl: async () => {
            throw new ResearchProviderError(
              "WEB_SEARCH_PROVIDER_TIMEOUT",
              "timeout",
            );
          },
        }),
      );
      const result = await executeTool(registry, {
        toolId: "research.searchWeb",
        input: { query: "x" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        reason: "WEB_SEARCH_PROVIDER_TIMEOUT",
      });
    });

    it("malformed response", async () => {
      setWebSearchProvider(
        mockSearch({
          searchImpl: async () => {
            throw new ResearchProviderError(
              "WEB_SEARCH_PROVIDER_MALFORMED_RESPONSE",
              "bad",
            );
          },
        }),
      );
      const result = await executeTool(registry, {
        toolId: "research.searchWeb",
        input: { query: "x" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        reason: "WEB_SEARCH_PROVIDER_MALFORMED_RESPONSE",
      });
    });
  });

  describe("research.crawlUrl", () => {
    it("returns normalized crawl result", async () => {
      setCrawlProvider(mockCrawl());
      const result = await executeTool(registry, {
        toolId: "research.crawlUrl",
        input: { url: "https://example.com" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: true,
        url: "https://example.com",
        title: "Example Domain",
        source: "firecrawl",
      });
    });

    it("missing API key", async () => {
      setCrawlProvider(mockCrawl({ configured: false }));
      const result = await executeTool(registry, {
        toolId: "research.crawlUrl",
        input: { url: "https://example.com" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: false,
        reason: "CRAWL_PROVIDER_NOT_CONFIGURED",
      });
    });

    it("provider failure / timeout / malformed", async () => {
      for (const code of [
        "CRAWL_PROVIDER_REQUEST_FAILED",
        "CRAWL_PROVIDER_TIMEOUT",
        "CRAWL_PROVIDER_MALFORMED_RESPONSE",
      ] as const) {
        setCrawlProvider(
          mockCrawl({
            crawlImpl: async () => {
              throw new ResearchProviderError(code, code);
            },
          }),
        );
        const result = await executeTool(registry, {
          toolId: "research.crawlUrl",
          input: { url: "https://example.com" },
          context: ctx(),
        });
        expect(result.data).toMatchObject({ available: false, reason: code });
      }
    });

    it("invalid URL rejected", async () => {
      const result = await executeTool(registry, {
        toolId: "research.crawlUrl",
        input: { url: "ftp://x" },
        context: ctx(),
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_INPUT");
    });
  });

  describe("research.searchCompetitors", () => {
    it("stored + web research", async () => {
      db.marketingStrategy.findUnique.mockResolvedValue({
        competitors: [
          {
            name: "Rival Fruits",
            website: "https://rival.example",
            instagram: null,
            notes: null,
          },
        ],
      });
      db.businessProfile.findUnique.mockResolvedValue({
        competitors: null,
        industry: "food",
        businessSummary: null,
      });
      setWebSearchProvider(
        mockSearch({
          searchImpl: async () => [
            {
              title: "Rival Fruits site",
              url: "https://rival.example/about",
              snippet: "about",
              source: "tavily",
            },
          ],
        }),
      );

      const result = await executeTool(registry, {
        toolId: "research.searchCompetitors",
        input: {},
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: true,
        webResearch: { available: true },
        competitors: [
          {
            name: "Rival Fruits",
            stored: true,
            webFindings: [{ title: "Rival Fruits site", source: "tavily" }],
          },
        ],
      });
    });

    it("no competitors", async () => {
      db.marketingStrategy.findUnique.mockResolvedValue({ competitors: [] });
      db.businessProfile.findUnique.mockResolvedValue({
        competitors: null,
        industry: null,
        businessSummary: null,
      });
      setWebSearchProvider(mockSearch({ configured: false }));
      const result = await executeTool(registry, {
        toolId: "research.searchCompetitors",
        input: {},
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: false,
        reason: "NO_STORED_COMPETITORS_AND_NO_RESEARCH_PROVIDER",
      });
    });

    it("search failure surfaces safe reason", async () => {
      db.marketingStrategy.findUnique.mockResolvedValue({
        competitors: [
          {
            name: "Rival",
            website: null,
            instagram: null,
            notes: null,
          },
        ],
      });
      db.businessProfile.findUnique.mockResolvedValue({
        competitors: null,
        industry: null,
        businessSummary: null,
      });
      setWebSearchProvider(
        mockSearch({
          searchImpl: async () => {
            throw new ResearchProviderError(
              "WEB_SEARCH_PROVIDER_AUTH_FAILED",
              "auth",
            );
          },
        }),
      );
      const result = await executeTool(registry, {
        toolId: "research.searchCompetitors",
        input: {},
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: true,
        webResearch: {
          available: false,
          reason: "WEB_SEARCH_PROVIDER_AUTH_FAILED",
        },
      });
    });

    it("scope protection", async () => {
      const result = await executeTool(registry, {
        toolId: "research.searchCompetitors",
        input: { brandId: "other" },
        context: ctx(),
      });
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });
  });

  describe("research.findTrendingTopics", () => {
    it("returns normalized web_search_signal results", async () => {
      setWebSearchProvider(
        mockSearch({
          searchImpl: async (input) => {
            expect(input.topic).toBe("news");
            expect(input.startDate).toBe("2026-01-01");
            return [
              {
                title: "Fruit trends 2026",
                url: "https://news.example/fruit",
                snippet: "rising interest",
                source: "tavily",
                publishedAt: "2026-06-01",
              },
            ];
          },
        }),
      );
      const result = await executeTool(registry, {
        toolId: "research.findTrendingTopics",
        input: {
          topic: "exotic fruit",
          industry: "food",
          location: "Iran",
          from: "2026-01-01",
          limit: 5,
        },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: true,
        signalKind: "research_signal",
        signals: [
          {
            title: "Fruit trends 2026",
            signalKind: "web_search_signal",
            source: "tavily",
          },
        ],
      });
      expect(JSON.stringify(result.data)).not.toMatch(
        /"viralScore"|"trendScore"|"engagement":/,
      );
    });

    it("provider not configured", async () => {
      setWebSearchProvider(mockSearch({ configured: false }));
      const result = await executeTool(registry, {
        toolId: "research.findTrendingTopics",
        input: { topic: "x" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: false,
        reason: "TREND_RESEARCH_PROVIDER_NOT_CONFIGURED",
        signals: [],
      });
    });

    it("no results", async () => {
      setWebSearchProvider(
        mockSearch({
          searchImpl: async () => [],
        }),
      );
      const result = await executeTool(registry, {
        toolId: "research.findTrendingTopics",
        input: { topic: "zzzz-none" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: true,
        signals: [],
      });
    });

    it("provider failure", async () => {
      setWebSearchProvider(
        mockSearch({
          searchImpl: async () => {
            throw new ResearchProviderError(
              "WEB_SEARCH_PROVIDER_TIMEOUT",
              "t",
            );
          },
        }),
      );
      const result = await executeTool(registry, {
        toolId: "research.findTrendingTopics",
        input: { topic: "x" },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: false,
        reason: "WEB_SEARCH_PROVIDER_TIMEOUT",
      });
    });
  });

  it("logs research tool execution", async () => {
    setWebSearchProvider(mockSearch());
    const store = createMemoryAgentRuntimeStore();
    const outcome = await runAgentExecution({
      agentId: "system.test",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      input: {
        toolCalls: [
          { toolId: "research.searchWeb", input: { query: "test" } },
        ],
      },
      toolRegistry: registry,
      store,
    });
    expect(outcome.status).toBe("COMPLETED");
    const logs = store.toolExecutions.get(outcome.executionId) ?? [];
    expect(logs[0]?.toolId).toBe("research.searchWeb");
  });
});
