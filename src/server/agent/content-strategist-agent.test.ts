import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  FakeLLMProvider,
  ToolRegistry,
  bootstrapAgentTools,
  countFormats,
  createMemoryAgentRuntimeStore,
  parseContentBlueprint,
  resetAgentBootstrap,
  resetAgentLLMProvider,
  runContentStrategistAgent,
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
};

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findFirst: vi.fn() },
    businessProfile: { findUnique: vi.fn() },
    businessBrain: { findFirst: vi.fn() },
    marketingStrategy: { findUnique: vi.fn() },
    contentItem: { count: vi.fn(), findMany: vi.fn() },
    analyticsSnapshot: { findFirst: vi.fn() },
    contentMetric: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    socialPublication: { findMany: vi.fn() },
    contentLearning: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/server/services/opportunity-matching", () => ({
  getMatchingDashboard: vi.fn(async () => ({
    upcoming: [
      {
        id: "opp_1",
        name: "World Burger Day",
        date: "2026-08-20",
        score: 0.9,
        confidence: "high",
      },
    ],
  })),
}));

vi.mock("@/server/services/calendar", () => ({
  searchCalendarEvents: vi.fn(async () => ({
    total: 1,
    offset: 0,
    limit: 10,
    events: [
      {
        id: "evt_1",
        key: "world_burger_day",
        name: "World Burger Day",
        title: "World Burger Day",
        date: "2026-08-20",
        category: "Food",
        geography: { countries: [], region: null },
        industries: ["food", "restaurant"],
        tags: ["burger"],
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
  analyticsSnapshot: { findFirst: ReturnType<typeof vi.fn> };
  contentMetric: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  socialPublication: { findMany: ReturnType<typeof vi.fn> };
};

function makePublishTool(): ToolDefinition {
  return {
    id: "content.publish",
    name: "Publish",
    description: "Should never be callable by content.strategist",
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
    description: "luxury fruit / restaurant brand",
    website: null,
    industry: "food",
    brandVoice: "friendly",
    targetAudience: "food lovers",
  };
}

function blueprintJson(payload: Record<string, unknown>) {
  return JSON.stringify(payload);
}

function planItem(
  overrides: Record<string, unknown> & {
    id: string;
    format: string;
    topic: string;
  },
) {
  return {
    channel: "INSTAGRAM",
    objective: "Engagement",
    angle: "Strategic angle only — not final copy",
    whyNow: "Aligned with request",
    evidence: [{ type: "user", summary: "User request" }],
    reasoning: { facts: [], inferences: [], unknowns: [] },
    ...overrides,
  };
}

describe("EPIC AGENT-009 — content.strategist", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentBootstrap();
    resetAgentLLMProvider();
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
    db.contentMetric.findFirst.mockResolvedValue(null);
    db.contentMetric.findMany.mockResolvedValue([]);
    db.socialPublication.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    resetAgentLLMProvider();
  });

  it("test 1: AI-led Instagram week plan gathers brand/strategy/calendar", async () => {
    db.brand.findFirst
      .mockResolvedValueOnce({ id: "brand_1" })
      .mockResolvedValueOnce(brandRow());

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            { name: toolIdToFunctionName("brand.getContext"), arguments: {} },
            { name: toolIdToFunctionName("brand.getStrategy"), arguments: {} },
            {
              name: toolIdToFunctionName("calendar.getEvents"),
              arguments: { limit: 10 },
            },
          ],
        },
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "برای هفته آینده اینستاگرامم برنامه بده.",
              mode: "ai_led",
              dateRange: { from: "2026-08-10", to: "2026-08-16" },
              channels: ["INSTAGRAM"],
              constraints: {},
            },
            strategy: {
              primaryObjective: "Engagement",
              secondaryObjectives: ["Awareness"],
              summary:
                "AI-led Instagram mix for next week based on brand and calendar.",
            },
            contentPlan: [
              planItem({
                id: "p1",
                format: "Reel",
                topic: "Product freshness",
                date: "2026-08-11",
              }),
              planItem({
                id: "p2",
                format: "Carousel",
                topic: "How to choose fruit",
                date: "2026-08-13",
                objective: "Education",
              }),
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { Reel: 1, Carousel: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Reel", "Carousel"],
            },
            limitations: [
              "No date range supplied originally; interpreted next calendar week.",
              "Format mix is strategy-based rather than performance-derived.",
            ],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "برای هفته آینده اینستاگرامم برنامه بده.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.blueprint.request.mode).toBe("ai_led");
    expect(result.toolResults.map((t) => t.tool)).toEqual([
      "brand.getContext",
      "brand.getStrategy",
      "calendar.getEvents",
    ]);
    expect(result.blueprint.contentPlan.length).toBeGreaterThan(0);
  });

  it("test 2: exact format constraint — 3 Reel + 2 Carousel", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            { name: toolIdToFunctionName("brand.getContext"), arguments: {} },
          ],
        },
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "هفته بعد ۳ ریلز و ۲ کاروسل می‌خوام.",
              mode: "user_constrained",
              dateRange: { from: "2026-08-10", to: "2026-08-16" },
              channels: ["INSTAGRAM"],
              constraints: { Reel: 3, Carousel: 2 },
            },
            strategy: {
              primaryObjective: "Engagement",
              secondaryObjectives: [],
              summary: "Respects exact user format counts.",
            },
            contentPlan: [
              planItem({ id: "r1", format: "Reel", topic: "T1" }),
              planItem({ id: "r2", format: "Reel", topic: "T2" }),
              planItem({ id: "r3", format: "Reel", topic: "T3" }),
              planItem({ id: "c1", format: "Carousel", topic: "T4" }),
              planItem({ id: "c2", format: "Carousel", topic: "T5" }),
            ],
            coverage: {
              requestedCount: { Reel: 3, Carousel: 2 },
              plannedCount: { Reel: 3, Carousel: 2 },
              channels: ["INSTAGRAM"],
              formats: ["Reel", "Carousel"],
            },
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "هفته بعد ۳ ریلز و ۲ کاروسل می‌خوام.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    const counts = countFormats(result.blueprint.contentPlan);
    expect(counts.Reel).toBe(3);
    expect(counts.Carousel).toBe(2);
    expect(result.blueprint.request.mode).toBe("user_constrained");
    expect(result.blueprint.coverage.plannedCount).toMatchObject({
      Reel: 3,
      Carousel: 2,
    });
  });

  it("test 3: topic constraint incorporates summer promotion", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "این هفته درباره تخفیف تابستانی محتوا می‌خوام.",
              mode: "topic_specific",
              dateRange: {},
              channels: ["INSTAGRAM"],
              constraints: { topic: "summer discount" },
            },
            strategy: {
              primaryObjective: "Sales",
              secondaryObjectives: ["Awareness"],
              summary: "Summer promotion topic locked by user.",
            },
            contentPlan: [
              planItem({
                id: "s1",
                format: "Reel",
                topic: "تخفیف تابستانی — product highlight",
                objective: "Sales",
                evidence: [
                  {
                    type: "user",
                    summary: "User required summer discount topic",
                  },
                ],
              }),
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { Reel: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Reel"],
            },
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "این هفته درباره تخفیف تابستانی محتوا می‌خوام.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.blueprint.request.mode).toBe("topic_specific");
    expect(
      result.blueprint.contentPlan.some((p) =>
        /تخفیف تابستانی|summer/i.test(p.topic),
      ),
    ).toBe(true);
  });

  it("test 4: hybrid — 2 Reels locked, rest AI-optimized", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "دو ریلز می‌خوام، بقیه رو خودت بچین.",
              mode: "hybrid",
              dateRange: {},
              channels: ["INSTAGRAM"],
              constraints: { Reel: 2, rest: "ai" },
            },
            strategy: {
              primaryObjective: "Engagement",
              secondaryObjectives: ["Awareness"],
              summary: "2 Reels locked; remaining mix AI-led.",
            },
            contentPlan: [
              planItem({ id: "r1", format: "Reel", topic: "Locked A" }),
              planItem({ id: "r2", format: "Reel", topic: "Locked B" }),
              planItem({ id: "c1", format: "Carousel", topic: "AI pick" }),
              planItem({ id: "s1", format: "Story", topic: "AI pick 2" }),
            ],
            coverage: {
              requestedCount: { Reel: 2 },
              plannedCount: { Reel: 2, Carousel: 1, Story: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Reel", "Carousel", "Story"],
            },
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "دو ریلز می‌خوام، بقیه رو خودت بچین.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.blueprint.request.mode).toBe("hybrid");
    expect(countFormats(result.blueprint.contentPlan).Reel).toBe(2);
    expect(result.blueprint.contentPlan.length).toBeGreaterThan(2);
  });

  it("test 5: calendar opportunity influences plan", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("calendar.getEvents"),
              arguments: { limit: 10 },
            },
            {
              name: toolIdToFunctionName("opportunity.getRelevant"),
              arguments: { horizonDays: 30 },
            },
          ],
        },
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "برای روز جهانی برگر یک ایده مناسب بده.",
              mode: "topic_specific",
              dateRange: {},
              channels: ["INSTAGRAM"],
              constraints: { event: "World Burger Day" },
            },
            strategy: {
              primaryObjective: "Awareness",
              secondaryObjectives: ["Engagement"],
              summary: "Calendar-informed sequence around World Burger Day.",
            },
            contentPlan: [
              planItem({
                id: "b1",
                format: "Reel",
                topic: "World Burger Day — kitchen authenticity",
                date: "2026-08-18",
                whyNow: "Event is approaching with preparation window",
                evidence: [
                  {
                    type: "calendar",
                    reference: "evt_1",
                    summary: "World Burger Day on 2026-08-20",
                  },
                  {
                    type: "opportunity",
                    reference: "opp_1",
                    summary: "High-confidence matching opportunity",
                  },
                ],
                reasoning: {
                  facts: ["World Burger Day is upcoming on the calendar."],
                  inferences: [
                    "Relevant to restaurant/food brand product offering.",
                  ],
                  unknowns: [
                    "No historical performance for this event format.",
                  ],
                },
              }),
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { Reel: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Reel"],
            },
            limitations: [
              "No campaign/task/schedule was created — blueprint only.",
            ],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "برای روز جهانی برگر یک ایده مناسب بده.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults.map((t) => t.tool)).toEqual([
      "calendar.getEvents",
      "opportunity.getRelevant",
    ]);
    expect(result.blueprint.contentPlan[0]?.topic).toMatch(/Burger/i);
    expect(
      result.blueprint.contentPlan[0]?.evidence.some(
        (e) => e.type === "calendar" || e.type === "opportunity",
      ),
    ).toBe(true);
  });

  it("test 6: trend signal influences strategic angle", async () => {
    webSearchState.configured = true;
    webSearchState.results = [
      {
        title: "Behind-the-scenes kitchen Reels rising",
        url: "https://ex.example/1",
        snippet: "BTS food content",
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
          content: blueprintJson({
            request: {
              original: "از ترندها برای برنامه استفاده کن",
              mode: "ai_led",
              dateRange: {},
              channels: ["INSTAGRAM"],
              constraints: {},
            },
            strategy: {
              primaryObjective: "Engagement",
              secondaryObjectives: [],
              summary: "Trend-informed authenticity angle.",
            },
            contentPlan: [
              planItem({
                id: "t1",
                format: "Reel",
                topic: "Kitchen authenticity",
                angle:
                  "Use short-form behind-the-scenes to communicate kitchen authenticity",
                evidence: [
                  {
                    type: "trend",
                    reference: "https://ex.example/1",
                    summary:
                      "Research signal: BTS kitchen Reels appearing frequently",
                  },
                ],
                reasoning: {
                  facts: [
                    "Public research signals mention BTS kitchen content.",
                  ],
                  inferences: [
                    "This pattern could communicate kitchen authenticity for this brand.",
                  ],
                  unknowns: [],
                },
              }),
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { Reel: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Reel"],
            },
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "از ترندها برای برنامه استفاده کن",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.tool).toBe("research.findTrendingTopics");
    expect(result.blueprint.contentPlan[0]?.angle).toMatch(/authenticity/i);
    expect(
      result.blueprint.contentPlan[0]?.evidence.some((e) => e.type === "trend"),
    ).toBe(true);
  });

  it("test 7: viral pattern transferred structurally, not copied", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.searchWeb"),
              arguments: { query: "food reel patterns" },
            },
          ],
        },
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "الگوی موفق را اعمال کن",
              mode: "ai_led",
              dateRange: {},
              channels: ["INSTAGRAM"],
              constraints: {},
            },
            strategy: {
              primaryObjective: "Engagement",
              secondaryObjectives: [],
              summary: "Structural pattern transfer only.",
            },
            contentPlan: [
              planItem({
                id: "v1",
                format: "Reel",
                topic: "Product demonstration",
                angle:
                  "Use a result-first structure for the product demonstration",
                evidence: [
                  {
                    type: "pattern",
                    summary: "Observed pattern: result-first opening",
                  },
                ],
                reasoning: {
                  facts: ["Pattern observed across research examples."],
                  inferences: [
                    "Result-first structure may transfer to product demos.",
                  ],
                  unknowns: [],
                },
              }),
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { Reel: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Reel"],
            },
            limitations: [
              "No final hook/caption/script generated — pattern transfer only.",
            ],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "الگوی موفق را اعمال کن",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.blueprint.contentPlan[0]?.angle).toMatch(/result-first/i);
    expect(result.response).not.toMatch(/در این ریلز اول دوربین/);
    expect(result.blueprint.limitations.join(" ")).toMatch(
      /pattern transfer|No final hook/i,
    );
  });

  it("test 8: historical performance available influences format", async () => {
    db.contentItem.findMany.mockResolvedValue([{ id: "c1" }]);
    db.contentMetric.count.mockResolvedValue(1);
    db.contentMetric.findMany.mockResolvedValue([
      {
        externalId: "c1",
        title: "Reel win",
        platform: "INSTAGRAM",
        contentType: "REEL",
        publishedAt: new Date("2026-01-01"),
        engagement: 200,
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
              name: toolIdToFunctionName("analytics.compareContentTypes"),
              arguments: {},
            },
            {
              name: toolIdToFunctionName("analytics.getTopContent"),
              arguments: { limit: 5 },
            },
          ],
        },
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "بر اساس عملکرد قبلی برنامه بده",
              mode: "ai_led",
              dateRange: {},
              channels: ["INSTAGRAM"],
              constraints: {},
            },
            strategy: {
              primaryObjective: "Reach",
              secondaryObjectives: ["Engagement"],
              summary: "Performance-backed preference for Reels.",
            },
            contentPlan: [
              planItem({
                id: "perf1",
                format: "Reel",
                topic: "High-reach product moment",
                objective: "Reach",
                evidence: [
                  {
                    type: "performance",
                    reference: "c1",
                    summary: "Reels historically outperform on reach",
                  },
                ],
                reasoning: {
                  facts: ["Linked content metrics show strong Reel reach."],
                  inferences: [
                    "Format selection is performance-backed for Reach.",
                  ],
                  unknowns: [],
                },
              }),
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { Reel: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Reel"],
            },
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "بر اساس عملکرد قبلی برنامه بده",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults.map((t) => t.tool)).toContain(
      "analytics.getTopContent",
    );
    expect(
      result.blueprint.contentPlan[0]?.evidence.some(
        (e) => e.type === "performance",
      ),
    ).toBe(true);
    expect(result.blueprint.contentPlan[0]?.format).toBe("Reel");
  });

  it("test 9: historical performance unavailable — explicit limitation", async () => {
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
          content: blueprintJson({
            request: {
              original: "برنامه بده",
              mode: "ai_led",
              dateRange: {},
              channels: ["INSTAGRAM"],
              constraints: {},
            },
            strategy: {
              primaryObjective: "Awareness",
              secondaryObjectives: [],
              summary: "Strategy-based mix without performance data.",
            },
            contentPlan: [
              planItem({
                id: "np1",
                format: "Carousel",
                topic: "Brand story",
                reasoning: {
                  facts: ["Analytics Tool returned available:false."],
                  inferences: [
                    "Format mix is strategic rather than performance-derived.",
                  ],
                  unknowns: [
                    "Whether this format will outperform brand average is unknown.",
                  ],
                },
              }),
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { Carousel: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Carousel"],
            },
            limitations: [
              "Historical performance unavailable (available:false). Mix is strategy-based, not performance-derived.",
            ],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "برنامه بده",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(
      (result.toolResults[0]?.data as { available?: boolean })?.available,
    ).toBe(false);
    expect(result.blueprint.limitations.join(" ")).toMatch(
      /strategy-based|available:false|unavailable/i,
    );
  });

  it("test 10: recent history influences diversity", async () => {
    db.contentItem.count.mockResolvedValue(2);
    db.contentItem.findMany.mockResolvedValue([
      {
        id: "old1",
        title: "Unboxing again",
        format: "REEL",
        platform: "INSTAGRAM",
        status: "PUBLISHED",
        publishedAt: new Date("2026-08-01"),
        scheduledAt: null,
        caption: null,
        campaign: null,
        pillar: null,
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
          ],
        },
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "تنوع بده",
              mode: "ai_led",
              dateRange: {},
              channels: ["INSTAGRAM"],
              constraints: {},
            },
            strategy: {
              primaryObjective: "Engagement",
              secondaryObjectives: [],
              summary: "Avoid repeating recent unboxing Reels.",
            },
            contentPlan: [
              planItem({
                id: "d1",
                format: "Carousel",
                topic: "Seasonal pairing guide",
                whyNow: "Recent history already covered unboxing Reels",
                evidence: [
                  {
                    type: "brand",
                    reference: "old1",
                    summary: "Recent content: unboxing Reel",
                  },
                ],
              }),
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { Carousel: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Carousel"],
            },
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "تنوع بده",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.tool).toBe("content.getHistory");
    expect(result.blueprint.contentPlan[0]?.format).not.toBe("Reel");
    expect(result.blueprint.contentPlan[0]?.topic).not.toMatch(/unboxing/i);
  });

  it("test 11: unsupported constraint reported in limitations", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "روی تلگرام ۵ پست VR می‌خوام",
              mode: "user_constrained",
              dateRange: {},
              channels: [],
              constraints: { channel: "TELEGRAM", format: "VR" },
            },
            strategy: {
              primaryObjective: "Awareness",
              secondaryObjectives: [],
              summary: "Could not fulfill unsupported channel/format.",
            },
            contentPlan: [],
            coverage: {
              requestedCount: { VR: 5 },
              plannedCount: {},
              channels: [],
              formats: [],
            },
            limitations: [
              "Unsupported channel/format combination (TELEGRAM + VR). No invented plan was created for unsupported behavior.",
            ],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "روی تلگرام ۵ پست VR می‌خوام",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.blueprint.contentPlan).toHaveLength(0);
    expect(result.blueprint.limitations.join(" ")).toMatch(/Unsupported/i);
  });

  it("test 12: refuses final caption generation", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: blueprintJson({
            request: {
              original: "کپشن نهایی بنویس",
              mode: "ai_led",
              dateRange: {},
              channels: ["INSTAGRAM"],
              constraints: {},
            },
            strategy: {
              primaryObjective: "Engagement",
              secondaryObjectives: [],
              summary: "Blueprint only — no final caption.",
            },
            contentPlan: [
              planItem({
                id: "cap1",
                format: "Reel",
                topic: "Product highlight",
                angle: "Result-first product demonstration",
              }),
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { Reel: 1 },
              channels: ["INSTAGRAM"],
              formats: ["Reel"],
            },
            limitations: [
              "content.strategist does not generate final captions, scripts, hooks, or hashtags.",
            ],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
      message: "کپشن نهایی بنویس",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.blueprint.limitations.join(" ")).toMatch(
      /does not generate|captions/i,
    );
    expect(result.response).not.toMatch(/#فروش|#تابستان|در این ریلز اول/);
  });

  it("test 13: refuses publishing", async () => {
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
          content: blueprintJson({
            request: {
              original: "منتشر کن",
              mode: "ai_led",
              dateRange: {},
              channels: [],
              constraints: {},
            },
            strategy: {
              primaryObjective: "Awareness",
              secondaryObjectives: [],
              summary: "Cannot publish.",
            },
            contentPlan: [],
            coverage: {
              requestedCount: {},
              plannedCount: {},
              channels: [],
              formats: [],
            },
            limitations: [
              "content.strategist is READ-only and cannot publish or schedule.",
            ],
          }),
        },
      ]),
    );

    const result = await runContentStrategistAgent({
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

  it("parseContentBlueprint rejects non-JSON without fabricating plan", () => {
    const parsed = parseContentBlueprint("just text", "q");
    expect(parsed.contentPlan).toEqual([]);
    expect(parsed.limitations.join(" ")).toMatch(/No fabricated|persisted/i);
  });

  it("requires authenticated scope", async () => {
    await expect(
      runContentStrategistAgent({
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
