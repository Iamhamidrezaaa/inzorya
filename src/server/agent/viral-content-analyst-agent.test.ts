import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  FakeLLMProvider,
  ToolRegistry,
  bootstrapAgentTools,
  createMemoryAgentRuntimeStore,
  parseViralContentAnalysis,
  resetAgentBootstrap,
  resetAgentLLMProvider,
  runViralContentAnalystAgent,
  setAgentLLMProvider,
  toolIdToFunctionName,
} from "@/server/agent";
import type { ToolDefinition } from "@/server/agent/types";

const crawlState = {
  configured: false,
  result: {
    url: "https://example.com/post",
    title: "How we grew engagement",
    content:
      "Why do fruit boxes sell out? Here is the before/after. Comment your city.",
    metadata: { description: "result-first food video" } as Record<
      string,
      unknown
    > | null,
    source: "mock-firecrawl",
  },
};

const webSearchState = {
  configured: false,
  results: [] as Array<{
    title: string;
    url: string;
    snippet: string | null;
    source: string;
    publishedAt: string | null;
  }>,
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
    total: 0,
    offset: 0,
    limit: 10,
    events: [],
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
      return webSearchState.results;
    },
  }),
  getCrawlProvider: () => ({
    id: "mock-firecrawl",
    isConfigured: () => crawlState.configured,
    async crawl({ url }: { url: string }) {
      return { ...crawlState.result, url };
    },
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
  analyticsSnapshot: { findFirst: ReturnType<typeof vi.fn> };
  contentMetric: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makePublishTool(): ToolDefinition {
  return {
    id: "content.publish",
    name: "Publish",
    description: "Should never be callable by viral.content.analyst",
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
    targetAudience: "food lovers",
  };
}

function analysisJson(payload: Record<string, unknown>) {
  return JSON.stringify(payload);
}

describe("EPIC AGENT-008 — viral.content.analyst", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentBootstrap();
    resetAgentLLMProvider();
    crawlState.configured = false;
    webSearchState.configured = false;
    webSearchState.results = [];
    registry = bootstrapAgentTools(new ToolRegistry());
    db.brand.findFirst.mockResolvedValue({ id: "brand_1" });
    db.businessProfile.findUnique.mockResolvedValue(null);
    db.businessBrain.findFirst.mockResolvedValue(null);
    db.marketingStrategy.findUnique.mockResolvedValue(null);
    db.contentItem.count.mockResolvedValue(0);
    db.contentItem.findMany.mockResolvedValue([]);
    db.analyticsSnapshot.findFirst.mockResolvedValue(null);
    db.contentMetric.count.mockResolvedValue(0);
    db.contentMetric.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    resetAgentLLMProvider();
  });

  it("test 1: specific URL analysis uses research.crawlUrl", async () => {
    crawlState.configured = true;

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.crawlUrl"),
              arguments: { url: "https://example.com/post" },
            },
          ],
        },
        {
          type: "message",
          content: analysisJson({
            query: "این محتوا رو تحلیل کن.",
            analysisScope: { channel: "web" },
            contentAnalyzed: [
              {
                id: "url-1",
                title: "How we grew engagement",
                url: "https://example.com/post",
                source: "crawl",
                performance: { available: false, metrics: {} },
                observations: {
                  hook: "question",
                  structure: ["Hook", "Payoff", "CTA"],
                  format: "article",
                  topic: "fruit box sellouts",
                  cta: "comment",
                },
                inferences: [
                  "A curiosity gap may contribute to attention.",
                ],
              },
            ],
            patterns: [],
            brandFit: [],
            limitations: [
              "No actual performance metrics for this URL.",
            ],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "این محتوا رو تحلیل کن: https://example.com/post",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.toolResults.map((t) => t.tool)).toContain("research.crawlUrl");
    expect(result.toolResults[0]?.success).toBe(true);
    expect(result.analysis.contentAnalyzed[0]?.performance.available).toBe(
      false,
    );
    expect(result.analysis.contentAnalyzed[0]?.observations.hook).toBe(
      "question",
    );
  });

  it("test 2: industry content research uses search tools", async () => {
    webSearchState.configured = true;
    webSearchState.results = [
      {
        title: "Food Reels that convert",
        url: "https://a.example/1",
        snippet: "Result-first openings",
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
              name: toolIdToFunctionName("research.searchWeb"),
              arguments: { query: "successful food reels patterns" },
            },
            {
              name: toolIdToFunctionName("research.findTrendingTopics"),
              arguments: { topic: "food content", industry: "food" },
            },
          ],
        },
        {
          type: "message",
          content: analysisJson({
            query: "محتواهای موفق این حوزه رو بررسی کن.",
            analysisScope: { industry: "food", period: "current" },
            contentAnalyzed: [
              {
                id: "ext-1",
                title: "Food Reels that convert",
                url: "https://a.example/1",
                source: "research",
                performance: { available: false },
                observations: {
                  format: "Reel",
                  topic: "food conversion",
                  hook: "result-first",
                },
                inferences: [
                  "Result-first openings may drive attention in food Reels.",
                ],
              },
            ],
            patterns: [],
            brandFit: [],
            limitations: ["Research signals are not verified performance."],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "محتواهای موفق این حوزه رو بررسی کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    const tools = result.toolResults.map((t) => t.tool);
    expect(tools).toContain("research.searchWeb");
    expect(tools).toContain("research.findTrendingTopics");
  });

  it("test 3: own content analysis uses history + top content", async () => {
    db.contentItem.count.mockResolvedValue(2);
    db.contentItem.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Box unboxing",
        type: "REEL",
        status: "PUBLISHED",
        createdAt: new Date("2026-01-01"),
      },
    ]);

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("content.getHistory"),
              arguments: { limit: 10 },
            },
            {
              name: toolIdToFunctionName("analytics.getTopContent"),
              arguments: { limit: 5 },
            },
          ],
        },
        {
          type: "message",
          content: analysisJson({
            query: "بهترین محتواهای قبلی من رو تحلیل کن.",
            analysisScope: { brand: "Capital Fruit", channel: "own" },
            contentAnalyzed: [
              {
                id: "c1",
                title: "Box unboxing",
                source: "own",
                performance: { available: false },
                observations: { format: "Reel", topic: "unboxing" },
                inferences: [],
              },
            ],
            patterns: [],
            brandFit: [],
            limitations: ["Top analytics unavailable for ranking."],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "بهترین محتواهای قبلی من رو تحلیل کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults.map((t) => t.tool)).toEqual([
      "content.getHistory",
      "analytics.getTopContent",
    ]);
  });

  it("test 4: real performance metrics are represented", async () => {
    db.contentItem.findMany.mockResolvedValue([{ id: "c1" }]);
    db.contentMetric.count.mockResolvedValue(1);
    db.contentMetric.findMany.mockResolvedValue([
      {
        externalId: "c1",
        title: "Reel A",
        platform: "INSTAGRAM",
        contentType: "REEL",
        publishedAt: new Date("2026-01-01"),
        engagement: 140,
        reach: 14000,
        impressions: 16000,
        likes: 100,
        comments: 20,
        shares: 10,
        saves: 10,
      },
    ]);

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("analytics.getTopContent"),
              arguments: { limit: 5 },
            },
          ],
        },
        {
          type: "message",
          content: analysisJson({
            query: "عملکرد واقعی",
            analysisScope: { brand: "Capital Fruit", channel: "INSTAGRAM" },
            contentAnalyzed: [
              {
                id: "c1",
                title: "Reel A",
                source: "own",
                performance: {
                  available: true,
                  metrics: {
                    reach: 14000,
                    engagement: 140,
                    likes: 100,
                    comments: 20,
                  },
                },
                observations: { format: "Reel", topic: "product" },
                inferences: [],
              },
            ],
            patterns: [],
            brandFit: [],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "بهترین محتواهای من از نظر عملکرد؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    const toolData = result.toolResults[0]?.data as
      | { available?: boolean; items?: Array<{ metrics?: unknown }> }
      | undefined;
    expect(toolData?.available).toBe(true);
    expect(result.analysis.contentAnalyzed[0]?.performance.available).toBe(
      true,
    );
    expect(
      result.analysis.contentAnalyzed[0]?.performance.metrics?.reach,
    ).toBe(14000);
  });

  it("test 5: no performance data → available false", async () => {
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
          content: analysisJson({
            query: "performance",
            analysisScope: {},
            contentAnalyzed: [
              {
                id: "unknown",
                performance: { available: false, metrics: {} },
                observations: {},
                inferences: [],
              },
            ],
            patterns: [],
            brandFit: [],
            limitations: [
              "performanceAvailable=false: social analytics are not connected.",
            ],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "عملکرد محتواهای من چطور است؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(
      (result.toolResults[0]?.data as { available?: boolean })?.available,
    ).toBe(false);
    expect(result.analysis.contentAnalyzed[0]?.performance.available).toBe(
      false,
    );
    expect(result.analysis.limitations.join(" ")).toMatch(
      /performanceAvailable=false|not connected/i,
    );
  });

  it("test 6: multiple content items extract common patterns", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.searchWeb"),
              arguments: { query: "food before after" },
            },
          ],
        },
        {
          type: "message",
          content: analysisJson({
            query: "مقایسه",
            analysisScope: { industry: "food" },
            contentAnalyzed: [
              {
                id: "a",
                title: "A",
                url: "https://a.example",
                performance: { available: false },
                observations: {
                  hook: "result-first",
                  format: "Reel",
                  valueMechanism: ["utility"],
                },
                inferences: [],
              },
              {
                id: "b",
                title: "B",
                url: "https://b.example",
                performance: { available: false },
                observations: {
                  hook: "result-first",
                  format: "Reel",
                  valueMechanism: ["utility"],
                },
                inferences: [],
              },
              {
                id: "c",
                title: "C",
                url: "https://c.example",
                performance: { available: false },
                observations: {
                  hook: "result-first",
                  emotionalMechanism: ["identification"],
                },
                inferences: [],
              },
            ],
            patterns: [
              {
                pattern: "Result-first opening on short-form food Reels",
                evidence: ["a", "b", "c"],
                confidence: "medium",
                transferability: "high",
                why: "Appears across three independent examples.",
              },
            ],
            brandFit: [],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "Why did these three pieces outperform the others?",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.analysis.contentAnalyzed.length).toBe(3);
    expect(result.analysis.patterns[0]?.evidence.length).toBe(3);
    expect(result.analysis.patterns[0]?.pattern).toMatch(/Result-first/i);
  });

  it("test 7: single content item does not claim universal pattern", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: analysisJson({
            query: "single",
            analysisScope: {},
            contentAnalyzed: [
              {
                id: "only-1",
                title: "One piece",
                performance: { available: false },
                observations: { hook: "question" },
                inferences: ["Curiosity may help."],
              },
            ],
            patterns: [
              {
                pattern: "Question-led opening (single example only)",
                evidence: ["only-1"],
                confidence: "low",
                transferability: "medium",
                why: "Only one example — not a universal pattern.",
                whatNotToCopy: "Do not treat this as market-wide.",
              },
            ],
            brandFit: [],
            limitations: [
              "Single content item — pattern is not claimed as universal.",
            ],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "این یکی را تحلیل کن",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.analysis.contentAnalyzed).toHaveLength(1);
    expect(result.analysis.patterns[0]?.confidence).toBe("low");
    expect(result.analysis.limitations.join(" ")).toMatch(/universal|Single/i);
  });

  it("test 8: brand fit considers brand context", async () => {
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
          type: "message",
          content: analysisJson({
            query: "brand fit",
            analysisScope: {
              brand: "Capital Fruit",
              industry: "food",
            },
            contentAnalyzed: [],
            patterns: [
              {
                pattern: "Before/after transformation format",
                evidence: [],
                confidence: "medium",
                transferability: "high",
                why: "Visible product transformation fits fruit gift boxes.",
              },
            ],
            brandFit: [
              {
                pattern: "Before/after transformation format",
                relevance: "high",
                why: "Brand sells visibly transformative fruit products.",
              },
            ],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "این الگو برای برند من مناسب است؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.tool).toBe("brand.getContext");
    expect(result.analysis.brandFit[0]?.relevance).toBe("high");
    expect(result.analysis.analysisScope.brand).toBe("Capital Fruit");
  });

  it("test 9: weak evidence → low confidence", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: analysisJson({
            query: "weak",
            analysisScope: {},
            contentAnalyzed: [
              {
                id: "weak-1",
                performance: { available: false },
                observations: { topic: "unclear snippet" },
                inferences: ["Possibly useful — weak evidence."],
              },
            ],
            patterns: [
              {
                pattern: "Unclear utility framing",
                evidence: ["weak-1"],
                confidence: "low",
                transferability: "low",
                why: "Evidence is thin and single-source.",
              },
            ],
            brandFit: [],
            limitations: ["Weak evidence — low confidence only."],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "آیا این یک الگوی قوی است؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.analysis.patterns[0]?.confidence).toBe("low");
  });

  it("test 10: refuses guaranteed viral prediction", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: analysisJson({
            query: "این محتوا حتما وایرال میشه؟",
            analysisScope: {},
            contentAnalyzed: [],
            patterns: [],
            brandFit: [],
            limitations: [
              "This agent never guarantees virality or predicted views. No viral score is produced.",
            ],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "این محتوا حتما وایرال میشه؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.analysis.limitations.join(" ").toLowerCase()).toMatch(
      /virality|viral score|guarantees/,
    );
    expect(JSON.stringify(result.analysis)).not.toMatch(
      /viralScore|predictedViews|will go viral/i,
    );
  });

  it("test 11: refuses script/caption generation", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: analysisJson({
            query: "یک اسکریپت بنویس",
            analysisScope: {},
            contentAnalyzed: [],
            patterns: [
              {
                pattern: "Result-first opening",
                evidence: [],
                confidence: "medium",
                transferability: "medium",
                why: "Structural pattern only — no script generated.",
              },
            ],
            brandFit: [],
            limitations: [
              "viral.content.analyst does not generate scripts, captions, hooks, or hashtags.",
            ],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "برای این ترند یک اسکریپت و کپشن بنویس",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.analysis.limitations.join(" ")).toMatch(
      /does not generate|scripts|captions/i,
    );
    expect(result.response).not.toMatch(/Hook:\s*Hey guys|Caption:\s*#/);
  });

  it("test 12: refuses publishing", async () => {
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
          content: analysisJson({
            query: "publish",
            analysisScope: {},
            contentAnalyzed: [],
            patterns: [],
            brandFit: [],
            limitations: [
              "viral.content.analyst is READ-only and cannot publish.",
            ],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "این پست را منتشر کن",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.success).toBe(false);
    expect(result.toolResults[0]?.error?.code).toBe("PERMISSION_DENIED");
  });

  it("multi-content verification: own history + analytics + brand fit", async () => {
    db.brand.findFirst
      .mockResolvedValueOnce({ id: "brand_1" })
      .mockResolvedValueOnce(brandRow());
    db.contentItem.count.mockResolvedValue(2);
    db.contentItem.findMany
      .mockResolvedValueOnce([
        {
          id: "c1",
          title: "Unboxing A",
          type: "REEL",
          status: "PUBLISHED",
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "c2",
          title: "Unboxing B",
          type: "REEL",
          status: "PUBLISHED",
          createdAt: new Date("2026-01-02"),
        },
      ])
      .mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    db.contentMetric.count.mockResolvedValue(2);
    db.contentMetric.findMany.mockResolvedValue([
      {
        externalId: "c1",
        title: "Unboxing A",
        platform: "INSTAGRAM",
        contentType: "REEL",
        publishedAt: new Date("2026-01-01"),
        engagement: 200,
        reach: 9000,
        impressions: 10000,
        likes: 150,
        comments: 30,
        shares: 10,
        saves: 10,
      },
      {
        externalId: "c2",
        title: "Unboxing B",
        platform: "INSTAGRAM",
        contentType: "REEL",
        publishedAt: new Date("2026-01-02"),
        engagement: 180,
        reach: 8000,
        impressions: 9000,
        likes: 140,
        comments: 25,
        shares: 8,
        saves: 7,
      },
    ]);

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            { name: toolIdToFunctionName("brand.getContext"), arguments: {} },
            {
              name: toolIdToFunctionName("content.getHistory"),
              arguments: { limit: 10 },
            },
            {
              name: toolIdToFunctionName("analytics.getTopContent"),
              arguments: { limit: 5 },
            },
          ],
        },
        {
          type: "message",
          content: analysisJson({
            query: "تحلیل چند محتوا",
            analysisScope: {
              brand: "Capital Fruit",
              industry: "food",
              channel: "INSTAGRAM",
            },
            contentAnalyzed: [
              {
                id: "c1",
                title: "Unboxing A",
                source: "own",
                performance: {
                  available: true,
                  metrics: { reach: 9000, engagement: 200 },
                },
                observations: {
                  hook: "result-first",
                  format: "Reel",
                  valueMechanism: ["utility", "novelty"],
                },
                inferences: [
                  "Strong engagement may relate to product reveal pacing.",
                ],
              },
              {
                id: "c2",
                title: "Unboxing B",
                source: "own",
                performance: {
                  available: true,
                  metrics: { reach: 8000, engagement: 180 },
                },
                observations: {
                  hook: "result-first",
                  format: "Reel",
                  valueMechanism: ["utility"],
                },
                inferences: [],
              },
            ],
            patterns: [
              {
                pattern: "Result-first unboxing Reels",
                evidence: ["c1", "c2"],
                confidence: "medium",
                transferability: "high",
                why: "Both high-performing own Reels share result-first openings.",
                whatNotToCopy:
                  "Do not copy another creator's personality or celebrity framing.",
              },
            ],
            brandFit: [
              {
                pattern: "Result-first unboxing Reels",
                relevance: "high",
                why: "Luxury fruit boxes are visually transformative.",
              },
            ],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runViralContentAnalystAgent({
      message: "بهترین محتواهای قبلی من رو تحلیل کن و الگوها را استخراج کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.toolResults.map((t) => t.tool)).toEqual([
      "brand.getContext",
      "content.getHistory",
      "analytics.getTopContent",
    ]);
    expect(result.analysis.contentAnalyzed).toHaveLength(2);
    expect(result.analysis.patterns[0]?.evidence).toEqual(["c1", "c2"]);
    expect(result.analysis.brandFit[0]?.relevance).toBe("high");
  });

  it("parseViralContentAnalysis rejects non-JSON without fabricating", () => {
    const parsed = parseViralContentAnalysis("prose only", "q");
    expect(parsed.contentAnalyzed).toEqual([]);
    expect(parsed.patterns).toEqual([]);
    expect(parsed.limitations.length).toBeGreaterThan(0);
  });

  it("requires authenticated scope", async () => {
    await expect(
      runViralContentAnalystAgent({
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
