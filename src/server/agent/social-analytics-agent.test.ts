import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  FakeLLMProvider,
  ToolRegistry,
  bootstrapAgentTools,
  createMemoryAgentRuntimeStore,
  parseSocialAnalyticsIntelligence,
  resetAgentBootstrap,
  resetAgentLLMProvider,
  resetSocialAnalyticsProvider,
  runSocialAnalyticsAgent,
  setAgentLLMProvider,
  statusFromToolAvailability,
  toolIdToFunctionName,
} from "@/server/agent";
import type { ToolDefinition } from "@/server/agent/types";

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
    id: "mock",
    isConfigured: () => false,
    search: async () => [],
  }),
  getCrawlProvider: () => ({
    id: "mock",
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
    description: "Should never be callable by social.analytics",
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

function intelJson(payload: Record<string, unknown>) {
  return JSON.stringify(payload);
}

function mockConnectedMetrics() {
  db.analyticsSnapshot.findFirst.mockResolvedValue(null);
  db.contentItem.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
  db.contentMetric.count.mockResolvedValue(2);
  db.contentMetric.findMany.mockResolvedValue([
    {
      externalId: "c1",
      title: "Demo Reel",
      platform: "INSTAGRAM",
      contentType: "REEL",
      publishedAt: new Date("2026-08-01"),
      engagement: 200,
      reach: 14000,
      impressions: 16000,
      likes: 120,
      comments: 30,
      shares: 20,
      saves: 30,
      ctr: 0.02,
    },
    {
      externalId: "c2",
      title: "Edu Carousel",
      platform: "INSTAGRAM",
      contentType: "CAROUSEL",
      publishedAt: new Date("2026-08-05"),
      engagement: 80,
      reach: 5000,
      impressions: 7000,
      likes: 40,
      comments: 10,
      shares: 5,
      saves: 25,
      ctr: 0.01,
    },
  ]);
}

describe("EPIC AGENT-011 — social.analytics", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentBootstrap();
    resetAgentLLMProvider();
    resetSocialAnalyticsProvider();
    registry = bootstrapAgentTools(new ToolRegistry());
    db.brand.findFirst.mockResolvedValue({ id: "brand_1" });
    db.contentItem.count.mockResolvedValue(0);
    db.contentItem.findMany.mockResolvedValue([]);
    db.analyticsSnapshot.findFirst.mockResolvedValue(null);
    db.contentMetric.count.mockResolvedValue(0);
    db.contentMetric.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    resetAgentLLMProvider();
    resetSocialAnalyticsProvider();
  });

  it("test 1: account performance summarizes real metrics", async () => {
    mockConnectedMetrics();

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("analytics.getPerformance"),
              arguments: {
                channel: "INSTAGRAM",
                from: "2026-08-01",
                to: "2026-08-31",
              },
            },
          ],
        },
        {
          type: "message",
          content: intelJson({
            query: "پیج من این ماه چطور عمل کرده؟",
            platforms: [
              { platform: "instagram", status: "connected", limitations: [] },
            ],
            period: { from: "2026-08-01", to: "2026-08-31" },
            overview: {
              available: true,
              summary:
                "در این دوره، محتواهای دمو محصول Reach قوی‌تری نسبت به کاروسل آموزشی داشتند.",
              metrics: { reach: 19000, engagement: 280, contentCount: 2 },
            },
            performance: { trend: "stable_to_strong_on_reels", changes: [] },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [
              {
                insight: "2 content items had linked metrics in this period.",
                evidence: ["analytics.getPerformance"],
                confidence: "high",
                type: "fact",
              },
            ],
            areasToInvestigate: [],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "پیج من این ماه چطور عمل کرده؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.toolResults[0]?.tool).toBe("analytics.getPerformance");
    expect(
      (result.toolResults[0]?.data as { available?: boolean })?.available,
    ).toBe(true);
    expect(result.intelligence.overview.available).toBe(true);
    expect(result.intelligence.overview.summary).toBeTruthy();
  });

  it("test 2: top content ranking uses actual relevant metrics", async () => {
    mockConnectedMetrics();

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
          content: intelJson({
            query: "بهترین محتواهای من کدام بودند؟",
            platforms: [
              { platform: "instagram", status: "connected", limitations: [] },
            ],
            period: {},
            overview: { available: true, metrics: {} },
            performance: { changes: [] },
            topContent: [
              {
                contentId: "c1",
                title: "Demo Reel",
                platform: "INSTAGRAM",
                format: "REEL",
                metrics: { reach: 14000, engagement: 200 },
                whyItRanks: "Highest engagement then reach in connected dataset",
                rankingMetric: "engagement_then_reach",
              },
            ],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "بهترین محتواهای من کدام بودند؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.tool).toBe("analytics.getTopContent");
    expect(result.intelligence.topContent[0]?.rankingMetric).toBe(
      "engagement_then_reach",
    );
    expect(result.intelligence.topContent[0]?.metrics.reach).toBe(14000);
  });

  it("test 3: format comparison includes sample size + limitations", async () => {
    mockConnectedMetrics();

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("analytics.compareContentTypes"),
              arguments: {},
            },
          ],
        },
        {
          type: "message",
          content: intelJson({
            query: "Reel بهتر جواب داده یا Carousel؟",
            platforms: [
              { platform: "instagram", status: "connected", limitations: [] },
            ],
            period: {},
            overview: { available: true, metrics: {} },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [
              {
                format: "REEL",
                sampleSize: 1,
                metrics: { reach: 14000, avgEngagement: 200 },
                observation:
                  "In this connected dataset, Reels generated higher median reach than Carousels.",
                limitations: ["Limited sample."],
              },
              {
                format: "CAROUSEL",
                sampleSize: 1,
                metrics: { reach: 5000, avgEngagement: 80 },
                observation: "Lower reach in this small sample.",
                limitations: ["Limited sample."],
              },
            ],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: ["Do not conclude Reels are always better."],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "Reel بهتر جواب داده یا Carousel؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.intelligence.formatAnalysis[0]?.sampleSize).toBeDefined();
    expect(
      result.intelligence.formatAnalysis.some((f) =>
        f.limitations.some((l) => /Limited sample/i.test(l)),
      ),
    ).toBe(true);
  });

  it("test 4: topic comparison uses structured metadata", async () => {
    mockConnectedMetrics();
    db.contentItem.count.mockResolvedValue(2);
    db.contentItem.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Demo Reel",
        format: "REEL",
        platform: "INSTAGRAM",
        status: "PUBLISHED",
        publishedAt: new Date("2026-08-01"),
        scheduledAt: null,
        body: null,
        campaign: null,
        pillar: { id: "p1", name: "Product Demo" },
      },
      {
        id: "c2",
        title: "Edu Carousel",
        format: "CAROUSEL",
        platform: "INSTAGRAM",
        status: "PUBLISHED",
        publishedAt: new Date("2026-08-05"),
        scheduledAt: null,
        body: null,
        campaign: null,
        pillar: { id: "p2", name: "Education" },
      },
    ]);

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("content.getHistory"),
              arguments: { limit: 20 },
            },
            {
              name: toolIdToFunctionName("analytics.getTopContent"),
              arguments: { limit: 10 },
            },
          ],
        },
        {
          type: "message",
          content: intelJson({
            query: "چه موضوعاتی بهتر عمل کرده‌اند؟",
            platforms: [
              { platform: "instagram", status: "connected", limitations: [] },
            ],
            period: {},
            overview: { available: true, metrics: {} },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [
              {
                topic: "Product Demo",
                sampleSize: 1,
                metrics: { reach: 14000 },
                observation:
                  "Product Demo pillar content had higher reach in this dataset.",
              },
              {
                topic: "Education",
                sampleSize: 1,
                metrics: { reach: 5000 },
                observation: "Education pillar trailed on reach here.",
              },
            ],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: [
              "Topics derived from structured pillar metadata only.",
            ],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "چه موضوعاتی بهتر عمل کرده‌اند؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults.map((t) => t.tool)).toContain(
      "content.getHistory",
    );
    expect(result.intelligence.topicAnalysis[0]?.topic).toBe("Product Demo");
  });

  it("test 5: period comparison current vs previous", async () => {
    mockConnectedMetrics();

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("analytics.getPerformance"),
              arguments: {
                from: "2026-08-01",
                to: "2026-08-31",
              },
            },
            {
              name: toolIdToFunctionName("analytics.getPerformance"),
              arguments: {
                from: "2026-07-01",
                to: "2026-07-31",
              },
            },
          ],
        },
        {
          type: "message",
          content: intelJson({
            query: "نسبت به ماه قبل چه تغییری کرده‌ایم؟",
            platforms: [
              { platform: "instagram", status: "connected", limitations: [] },
            ],
            period: { from: "2026-08-01", to: "2026-08-31" },
            overview: { available: true, metrics: { reach: 19000 } },
            performance: {
              trend: "reach_up_vs_prior_month",
              changes: [
                {
                  label: "reach",
                  detail: "Current period reach compared with prior window using Tool data",
                },
              ],
            },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "نسبت به ماه قبل چه تغییری کرده‌ایم؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(
      result.toolResults.filter((t) => t.tool === "analytics.getPerformance")
        .length,
    ).toBe(2);
    expect(result.intelligence.performance.changes.length).toBeGreaterThan(0);
  });

  it("test 6: publishing patterns without causal claim", async () => {
    db.contentItem.count.mockResolvedValue(3);
    db.contentItem.findMany.mockResolvedValue([
      {
        id: "c1",
        platform: "INSTAGRAM",
        format: "REEL",
        publishedAt: new Date("2026-08-04T10:00:00Z"),
        scheduledAt: null,
        createdAt: new Date("2026-08-04T10:00:00Z"),
      },
      {
        id: "c2",
        platform: "INSTAGRAM",
        format: "REEL",
        publishedAt: new Date("2026-08-11T10:00:00Z"),
        scheduledAt: null,
        createdAt: new Date("2026-08-11T10:00:00Z"),
      },
    ]);

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("analytics.getPublishingPatterns"),
              arguments: {},
            },
          ],
        },
        {
          type: "message",
          content: intelJson({
            query: "چه الگوی انتشاری در داده‌های من دیده می‌شود؟",
            platforms: [
              {
                platform: "instagram",
                status: "partially_connected",
                limitations: [
                  "Publishing history available; engagement metrics separate",
                ],
              },
            ],
            period: {},
            overview: { available: true, metrics: {} },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [
              {
                pattern: "Multiple posts clustered on weekdays around 10:00 UTC",
                evidence: "analytics.getPublishingPatterns byHourUtc/byDayOfWeek",
                note: "Observed association — not causal.",
              },
            ],
            insights: [
              {
                insight: "Publishing timestamps show weekday clustering.",
                evidence: ["publishingPatterns"],
                confidence: "medium",
                type: "observation",
              },
            ],
            areasToInvestigate: [],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "چه الگوی انتشاری در داده‌های من دیده می‌شود؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.tool).toBe("analytics.getPublishingPatterns");
    expect(result.intelligence.publishingPatterns[0]?.note).toMatch(
      /not causal|Observed association/i,
    );
  });

  it("test 7: not connected platform → SOCIAL_ANALYTICS_NOT_CONNECTED", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("analytics.getPerformance"),
              arguments: { channel: "LINKEDIN" },
            },
          ],
        },
        {
          type: "message",
          content: intelJson({
            query: "لینکدین چطور است؟",
            platforms: [
              {
                platform: "linkedin",
                status: "not_connected",
                limitations: ["SOCIAL_ANALYTICS_NOT_CONNECTED"],
              },
            ],
            period: {},
            overview: {
              available: false,
              reason: "SOCIAL_ANALYTICS_NOT_CONNECTED",
              metrics: {},
            },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: [
              "LinkedIn was not analyzed — SOCIAL_ANALYTICS_NOT_CONNECTED.",
            ],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "لینکدین چطور است؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(
      (result.toolResults[0]?.data as { reason?: string })?.reason,
    ).toBe("SOCIAL_ANALYTICS_NOT_CONNECTED");
    expect(result.intelligence.platforms[0]?.status).toBe("not_connected");
    expect(result.intelligence.overview.available).toBe(false);
  });

  it("test 8: missing metric reported unavailable, not fabricated", async () => {
    mockConnectedMetrics();

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
          content: intelJson({
            query: "conversions؟",
            platforms: [
              { platform: "instagram", status: "connected", limitations: [] },
            ],
            period: {},
            overview: {
              available: true,
              summary: "Reach/engagement available; conversions not present.",
              metrics: {
                reach: 19000,
                conversions: null,
                conversionsAvailable: false,
              },
            },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: [
              "metricAvailable:false for conversions — not estimated.",
            ],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "نرخ تبدیل چقدر است؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.intelligence.limitations.join(" ")).toMatch(
      /metricAvailable:false|not estimated/i,
    );
    expect(JSON.stringify(result.intelligence)).not.toMatch(
      /\"conversions\":\s*[1-9]/,
    );
  });

  it("test 9: small sample warning", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: intelJson({
            query: "مقایسه فرمت",
            platforms: [
              { platform: "instagram", status: "connected", limitations: [] },
            ],
            period: {},
            overview: { available: true, metrics: {} },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [
              {
                format: "REEL",
                sampleSize: 1,
                metrics: { reach: 100 },
                observation: "Single Reel in sample.",
                limitations: ["Limited sample."],
              },
            ],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: ["Limited sample — not a robust format comparison."],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "مقایسه با نمونه کوچک",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.intelligence.formatAnalysis[0]?.sampleSize).toBe(1);
    expect(result.intelligence.limitations.join(" ")).toMatch(/Limited sample/i);
  });

  it("test 10: fact / observation / inference separated", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: intelJson({
            query: "insight discipline",
            platforms: [
              { platform: "instagram", status: "connected", limitations: [] },
            ],
            period: {},
            overview: { available: true, metrics: {} },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [
              {
                insight: "12 Reels were published.",
                evidence: ["content count"],
                confidence: "high",
                type: "fact",
              },
              {
                insight:
                  "Reels had higher median reach than Carousels in this period.",
                evidence: ["compareContentTypes"],
                confidence: "medium",
                type: "observation",
              },
              {
                insight:
                  "This may indicate short-form video is currently more effective for reach for this account.",
                evidence: ["observation above"],
                confidence: "low",
                type: "inference",
              },
            ],
            areasToInvestigate: [
              "Investigate whether product-demonstration Reels should receive greater strategic emphasis.",
            ],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "بینش‌ها را جدا کن",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    const types = result.intelligence.insights.map((i) => i.type);
    expect(types).toEqual(["fact", "observation", "inference"]);
    expect(result.intelligence.areasToInvestigate[0]).toMatch(/Investigate/i);
    expect(result.intelligence.areasToInvestigate.join(" ")).not.toMatch(
      /publish exactly \d+/i,
    );
  });

  it("test 11: refuses unsupported performance prediction", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: intelJson({
            query: "پیش‌بینی ویو؟",
            platforms: [],
            period: {},
            overview: { available: false, metrics: {} },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: [
              "social.analytics does not predict views, reach, or viral probability.",
            ],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "هفته بعد چند ویو می‌گیرم؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.intelligence.limitations.join(" ")).toMatch(
      /does not predict|viral/i,
    );
    expect(JSON.stringify(result.intelligence)).not.toMatch(
      /predictedViews|viralProbability/,
    );
  });

  it("test 12: does not generate content", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: intelJson({
            query: "کپشن بنویس",
            platforms: [],
            period: {},
            overview: { available: false, metrics: {} },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: [
              "social.analytics does not generate hooks, captions, or scripts.",
            ],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "برای بهترین پست یک کپشن بنویس",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.intelligence.limitations.join(" ")).toMatch(
      /does not generate|captions/i,
    );
  });

  it("test 13: cannot publish", async () => {
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
          content: intelJson({
            query: "publish",
            platforms: [],
            period: {},
            overview: { available: false, metrics: {} },
            performance: { changes: [] },
            topContent: [],
            formatAnalysis: [],
            topicAnalysis: [],
            publishingPatterns: [],
            insights: [],
            areasToInvestigate: [],
            limitations: [
              "social.analytics is READ-only and cannot publish.",
            ],
          }),
        },
      ]),
    );

    const result = await runSocialAnalyticsAgent({
      message: "همین را منتشر کن",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.success).toBe(false);
    expect(result.toolResults[0]?.error?.code).toBe("PERMISSION_DENIED");
  });

  it("statusFromToolAvailability maps SOCIAL_ANALYTICS_NOT_CONNECTED", () => {
    expect(
      statusFromToolAvailability({
        available: false,
        reason: "SOCIAL_ANALYTICS_NOT_CONNECTED",
        platform: "linkedin",
      }),
    ).toMatchObject({ status: "not_connected", platform: "linkedin" });
  });

  it("parseSocialAnalyticsIntelligence rejects non-JSON without fabricating", () => {
    const parsed = parseSocialAnalyticsIntelligence("prose", "q");
    expect(parsed.overview.available).toBe(false);
    expect(parsed.topContent).toEqual([]);
    expect(parsed.limitations.join(" ")).toMatch(/No fabricated/i);
  });

  it("requires authenticated scope", async () => {
    await expect(
      runSocialAnalyticsAgent({
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
