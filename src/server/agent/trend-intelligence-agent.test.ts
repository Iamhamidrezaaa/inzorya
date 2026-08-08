import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  FakeLLMProvider,
  ToolRegistry,
  bootstrapAgentTools,
  createMemoryAgentRuntimeStore,
  parseTrendIntelligence,
  resetAgentBootstrap,
  resetAgentLLMProvider,
  runTrendIntelligenceAgent,
  setAgentLLMProvider,
  toolIdToFunctionName,
} from "@/server/agent";
import type { ToolDefinition } from "@/server/agent/types";

const webSearchState = {
  configured: false,
  results: [] as Array<{
    title: string;
    url: string;
    snippet: string | null;
    source: string;
    publishedAt: string | null;
  }>,
  fail: false,
};

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findFirst: vi.fn() },
    businessProfile: { findUnique: vi.fn() },
    businessBrain: { findFirst: vi.fn() },
    marketingStrategy: { findUnique: vi.fn() },
    contentItem: { count: vi.fn(), findMany: vi.fn() },
    analyticsSnapshot: { findFirst: vi.fn() },
    contentMetric: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/server/services/opportunity-matching", () => ({
  getMatchingDashboard: vi.fn(async () => ({ upcoming: [] })),
}));

vi.mock("@/server/services/calendar", () => ({
  searchCalendarEvents: vi.fn(async () => ({
    total: 1,
    offset: 0,
    limit: 10,
    events: [
      {
        id: "evt_1",
        title: "National Food Day",
        startDate: "2026-08-15",
        endDate: "2026-08-15",
      },
    ],
  })),
}));

vi.mock("@/server/services/knowledge-graph", () => ({
  searchKnowledgeNodes: vi.fn(async () => []),
}));

vi.mock("@/server/research/registry", () => ({
  getWebSearchProvider: () => ({
    id: "mock-tavily",
    isConfigured: () => webSearchState.configured,
    async search() {
      if (webSearchState.fail) {
        const { ResearchProviderError } = await import("@/server/research");
        throw new ResearchProviderError(
          "WEB_SEARCH_PROVIDER_REQUEST_FAILED",
          "mock provider failed",
        );
      }
      return webSearchState.results;
    },
  }),
  getCrawlProvider: () => ({
    id: "mock-firecrawl",
    isConfigured: () => false,
    crawl: async () => ({
      url: "",
      title: null,
      content: null,
      metadata: null,
      source: "mock",
    }),
  }),
}));

import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  brand: { findFirst: ReturnType<typeof vi.fn> };
  businessProfile: { findUnique: ReturnType<typeof vi.fn> };
  businessBrain: { findFirst: ReturnType<typeof vi.fn> };
  marketingStrategy: { findUnique: ReturnType<typeof vi.fn> };
  contentItem: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  contentMetric: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makePublishTool(): ToolDefinition {
  return {
    id: "content.publish",
    name: "Publish",
    description: "Should never be callable by trend.intelligence",
    version: "1.0.0",
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ ok: z.boolean() }),
    permission: "PUBLISH",
    enabled: true,
    async execute() {
      return { ok: true };
    },
  };
}

function brandRow() {
  return {
    id: "brand_1",
    name: "Capital Fruit",
    slug: "capital-fruit",
    description: "luxury fruit brand",
    website: null,
    industry: "food",
    brandVoice: "friendly",
    targetAudience: "food lovers in Berlin",
  };
}

function intelligenceJson(payload: Record<string, unknown>) {
  return JSON.stringify(payload);
}

describe("EPIC AGENT-007 — trend.intelligence", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentBootstrap();
    resetAgentLLMProvider();
    webSearchState.configured = false;
    webSearchState.results = [];
    webSearchState.fail = false;
    registry = bootstrapAgentTools(new ToolRegistry());
    db.brand.findFirst.mockResolvedValue({ id: "brand_1" });
    db.businessProfile.findUnique.mockResolvedValue(null);
    db.businessBrain.findFirst.mockResolvedValue(null);
    db.marketingStrategy.findUnique.mockResolvedValue(null);
    db.contentItem.count.mockResolvedValue(0);
    db.contentItem.findMany.mockResolvedValue([]);
    db.contentMetric.count.mockResolvedValue(0);
    db.contentMetric.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    resetAgentLLMProvider();
  });

  it("test 1: industry trends select research tools", async () => {
    webSearchState.configured = true;
    webSearchState.results = [
      {
        title: "Restaurant TikTok menus rise",
        url: "https://a.example/1",
        snippet: "Short-form food menus",
        source: "tavily",
        publishedAt: "2026-08-01",
      },
    ];

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.findTrendingTopics"),
              arguments: { topic: "restaurant", industry: "food" },
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query: "چه چیزهایی الان در حوزه رستوران ترند شده؟",
            scope: { industry: "restaurant", period: "current" },
            trends: [
              {
                topic: "Short-form restaurant menus",
                classification: "signal",
                relevance: "medium",
                summary: "Public web signal about short-form food menus.",
                whyRelevant: "Restaurant industry topic",
                evidence: [
                  {
                    title: "Restaurant TikTok menus rise",
                    url: "https://a.example/1",
                    source: "tavily",
                    publishedAt: "2026-08-01",
                  },
                ],
                observedSignals: ["Restaurant TikTok menus rise"],
                facts: ["One web research signal was returned for restaurant menus."],
                inferences: [],
                unknowns: ["Not enough independent sources to call this a trend."],
              },
            ],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "چه چیزهایی الان در حوزه رستوران ترند شده؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.toolResults.map((t) => t.tool)).toContain(
      "research.findTrendingTopics",
    );
    expect(result.toolResults[0]?.success).toBe(true);
    expect(result.intelligence.trends[0]?.classification).toBe("signal");
  });

  it("test 2: brand-specific request uses brand context", async () => {
    db.brand.findFirst
      .mockResolvedValueOnce({ id: "brand_1" })
      .mockResolvedValueOnce(brandRow());

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("brand.getContext"),
              arguments: {},
            },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.findTrendingTopics"),
              arguments: { topic: "fruit", industry: "food", location: "Berlin" },
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query: "برای برند من ترندهای مهم این هفته را پیدا کن.",
            scope: {
              industry: "food",
              location: "Berlin",
              period: "this week",
            },
            trends: [],
            limitations: [
              "Web research was considered after brand context (food / Berlin).",
            ],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "برای برند من ترندهای مهم این هفته را پیدا کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults.map((t) => t.tool)).toEqual([
      "brand.getContext",
      "research.findTrendingTopics",
    ]);
    expect(result.intelligence.scope.industry).toBe("food");
    expect(result.intelligence.scope.location).toBe("Berlin");
  });

  it("test 3: multiple related signals grouped into one pattern", async () => {
    webSearchState.configured = true;
    webSearchState.results = [
      {
        title: "Plant-based desserts surge",
        url: "https://a.example/1",
        snippet: "Dessert demand",
        source: "tavily",
        publishedAt: "2026-08-02",
      },
      {
        title: "Vegan pastry menus expand",
        url: "https://b.example/2",
        snippet: "Bakeries expand",
        source: "tavily",
        publishedAt: "2026-08-03",
      },
    ];

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.searchWeb"),
              arguments: { query: "plant based desserts trends" },
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query: "plant based desserts",
            scope: { industry: "food", period: "current" },
            trends: [
              {
                topic: "Plant-based desserts",
                classification: "emerging_pattern",
                relevance: "high",
                summary:
                  "Related signals from independent URLs suggest growing attention to plant-based desserts.",
                whyRelevant: "Aligned with food brand",
                evidence: [
                  {
                    title: "Plant-based desserts surge",
                    url: "https://a.example/1",
                    source: "tavily",
                  },
                  {
                    title: "Vegan pastry menus expand",
                    url: "https://b.example/2",
                    source: "tavily",
                  },
                ],
                observedSignals: [
                  "Plant-based desserts surge",
                  "Vegan pastry menus expand",
                ],
                facts: [
                  "Two related web signals from different URLs were returned.",
                ],
                inferences: [
                  "Signals may indicate an emerging pattern around plant-based desserts.",
                ],
                unknowns: ["Social engagement volume is unknown."],
              },
            ],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "ترند دسرهای گیاهی",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.intelligence.trends).toHaveLength(1);
    expect(result.intelligence.trends[0]?.classification).toBe(
      "emerging_pattern",
    );
    expect(result.intelligence.trends[0]?.evidence.length).toBeGreaterThan(1);
  });

  it("test 4: single weak signal is not auto-classified as trend", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.searchWeb"),
              arguments: { query: "one article" },
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query: "weak signal",
            scope: {},
            trends: [
              {
                topic: "Isolated article mention",
                classification: "insufficient_evidence",
                relevance: "low",
                summary:
                  "Insufficient evidence to classify this as a trend.",
                whyRelevant: "Only one weak signal",
                evidence: [
                  { title: "One page", url: "https://same.example/x" },
                ],
                observedSignals: ["One page"],
                facts: ["Only one web result was available."],
                inferences: [],
                unknowns: [
                  "Insufficient evidence to classify this as a trend.",
                ],
              },
            ],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "آیا این یک ترند است؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.intelligence.trends[0]?.classification).toBe(
      "insufficient_evidence",
    );
    expect(result.intelligence.trends[0]?.classification).not.toBe("trend");
  });

  it("test 5: competitor activity distinguished from market trend", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.searchCompetitors"),
              arguments: { query: "competitor fruit boxes" },
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query: "رقبا",
            scope: { industry: "food" },
            trends: [
              {
                topic: "Competitor X gift-box campaign",
                classification: "signal",
                relevance: "medium",
                summary:
                  "Observable competitor activity — not evidence of a broader market trend.",
                whyRelevant: "Same category as brand",
                evidence: [
                  {
                    title: "Competitor X launches gift boxes",
                    url: "https://comp.example/1",
                    source: "competitor",
                  },
                ],
                observedSignals: ["Competitor X launches gift boxes"],
                facts: ["Competitor X is doing a gift-box campaign."],
                inferences: [],
                unknowns: [
                  "No multi-source evidence that gift boxes are a market-wide trend.",
                ],
              },
            ],
            limitations: [
              "Competitor activity is not the same as a market trend.",
            ],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "رقبا چه می‌کنند؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.tool).toBe("research.searchCompetitors");
    expect(result.intelligence.trends[0]?.classification).not.toBe("trend");
    expect(result.intelligence.limitations.join(" ")).toMatch(/competitor/i);
  });

  it("test 6: calendar relevance can be included as context", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("calendar.getEvents"),
              arguments: { horizonDays: 30 },
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query: "رویدادها",
            scope: { period: "next 30 days" },
            trends: [
              {
                topic: "National Food Day proximity",
                classification: "signal",
                relevance: "medium",
                summary:
                  "An upcoming marketing event may be contributing to relevance of food topics.",
                whyRelevant: "Seasonal calendar context for food brand",
                evidence: [],
                observedSignals: ["National Food Day upcoming"],
                facts: ["Calendar lists National Food Day soon."],
                inferences: [
                  "Upcoming event may increase topical relevance.",
                ],
                unknowns: [
                  "External web confirmation of rising attention was not gathered.",
                ],
              },
            ],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "رویدادهای نزدیک مرتبط با ترندها؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.tool).toBe("calendar.getEvents");
    expect(result.intelligence.trends[0]?.summary).toMatch(/event/i);
  });

  it("test 7: analytics unavailable is reported explicitly", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("analytics.getPerformance"),
              arguments: {},
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query: "عملکرد تاریخی",
            scope: {},
            trends: [],
            limitations: [
              "Historical Instagram/performance analytics are not connected (available:false). No fabricated historical performance was used.",
            ],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "آیا این ترند با عملکرد گذشته برند همخوان است؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.tool).toBe("analytics.getPerformance");
    const data = result.toolResults[0]?.data as
      | { available?: boolean }
      | undefined;
    expect(data?.available).toBe(false);
    expect(result.intelligence.limitations.join(" ")).toMatch(
      /available:false|not connected|analytics/i,
    );
  });

  it("test 8: provider unavailable — no hallucinated research", async () => {
    webSearchState.configured = false;

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.findTrendingTopics"),
              arguments: { topic: "fashion" },
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query: "فشن",
            scope: { industry: "fashion" },
            trends: [],
            limitations: [
              "Web research is currently unavailable (TREND_RESEARCH_PROVIDER_NOT_CONFIGURED). No external trends were invented.",
            ],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "الان چه موضوعاتی در حوزه فشن در حال رشد هستند؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    const data = result.toolResults[0]?.data as
      | { available?: boolean; reason?: string }
      | undefined;
    expect(data?.available).toBe(false);
    expect(result.intelligence.trends).toHaveLength(0);
    expect(result.intelligence.limitations.join(" ")).toMatch(/unavailable|NOT_CONFIGURED/i);
  });

  it("test 9: refuses guaranteed viral claims", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: intelligenceJson({
            query: "این ترند حتما وایرال میشه؟",
            scope: {},
            trends: [],
            limitations: [
              "This agent never guarantees virality or performance. Available evidence is insufficient for any viral prediction.",
            ],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "این ترند حتما وایرال میشه؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.intelligence.trends).toHaveLength(0);
    expect(result.intelligence.limitations.join(" ").toLowerCase()).toMatch(
      /viral|virality|performance/,
    );
    expect(result.response.toLowerCase()).not.toMatch(
      /guaranteed to go viral|definitely viral|will get \d+ views/,
    );
  });

  it("test 10: refuses publishing — READ-only", async () => {
    registry.registerTool(makePublishTool());

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("content.publish"),
              arguments: { id: "x" },
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query: "publish",
            scope: {},
            trends: [],
            limitations: [
              "trend.intelligence is READ-only and cannot publish or execute actions.",
            ],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "این پست را منتشر کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.success).toBe(false);
    expect(result.toolResults[0]?.error?.code).toBe("PERMISSION_DENIED");
    expect(result.intelligence.limitations.join(" ")).toMatch(/READ-only|cannot publish/i);
  });

  it("multi-tool synthesis: brand + research + calendar", async () => {
    db.brand.findFirst
      .mockResolvedValueOnce({ id: "brand_1" })
      .mockResolvedValueOnce(brandRow());
    webSearchState.configured = true;
    webSearchState.results = [
      {
        title: "Seasonal fruit boxes",
        url: "https://news.example/fruit",
        snippet: "Gift fruit boxes rising",
        source: "tavily",
        publishedAt: "2026-08-01",
      },
      {
        title: "Berlin food gifting",
        url: "https://other.example/berlin",
        snippet: "Local gifting interest",
        source: "tavily",
        publishedAt: "2026-08-02",
      },
    ];

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            { name: toolIdToFunctionName("brand.getContext"), arguments: {} },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.findTrendingTopics"),
              arguments: { topic: "fruit gifting", industry: "food", location: "Berlin" },
            },
            {
              name: toolIdToFunctionName("calendar.getEvents"),
              arguments: { horizonDays: 30 },
            },
          ],
        },
        {
          type: "message",
          content: intelligenceJson({
            query:
              "ترندهای مرتبط با کسب‌وکار من در برلین را بررسی کن.",
            scope: {
              industry: "food",
              location: "Berlin",
              period: "current",
            },
            trends: [
              {
                topic: "Seasonal fruit gifting",
                classification: "emerging_pattern",
                relevance: "high",
                summary:
                  "Independent web signals plus an upcoming food calendar event support relevance for a Berlin fruit brand.",
                whyRelevant:
                  "Brand industry is food; audience mentions Berlin; calendar has National Food Day.",
                evidence: [
                  {
                    title: "Seasonal fruit boxes",
                    url: "https://news.example/fruit",
                    source: "tavily",
                    publishedAt: "2026-08-01",
                  },
                  {
                    title: "Berlin food gifting",
                    url: "https://other.example/berlin",
                    source: "tavily",
                    publishedAt: "2026-08-02",
                  },
                ],
                observedSignals: [
                  "Seasonal fruit boxes",
                  "Berlin food gifting",
                  "National Food Day upcoming",
                ],
                facts: [
                  "Two independent URLs mention fruit/food gifting.",
                  "Calendar includes National Food Day soon.",
                ],
                inferences: [
                  "Upcoming event may contribute to topical relevance.",
                ],
                unknowns: [
                  "No connected social analytics to confirm historical brand fit.",
                ],
              },
            ],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runTrendIntelligenceAgent({
      message: "ترندهای مرتبط با کسب‌وکار من در برلین را بررسی کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.toolResults.map((t) => t.tool)).toEqual([
      "brand.getContext",
      "research.findTrendingTopics",
      "calendar.getEvents",
    ]);
    expect(result.intelligence.trends[0]?.classification).toBe(
      "emerging_pattern",
    );
    expect(result.intelligence.trends[0]?.relevance).toBe("high");
    expect(result.intelligence.trends[0]?.facts.length).toBeGreaterThan(0);
  });

  it("parseTrendIntelligence rejects non-JSON without fabricating trends", () => {
    const parsed = parseTrendIntelligence("just prose", "q");
    expect(parsed.trends).toEqual([]);
    expect(parsed.limitations.length).toBeGreaterThan(0);
  });

  it("requires authenticated scope", async () => {
    await expect(
      runTrendIntelligenceAgent({
        message: "hi",
        userId: "",
        workspaceId: "ws_1",
        brandId: "brand_1",
        toolRegistry: registry,
        store: createMemoryAgentRuntimeStore(),
      }),
    ).rejects.toMatchObject({ code: "SCOPE_VIOLATION" });
  });
});
