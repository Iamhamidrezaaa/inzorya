import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeLLMProvider,
  ToolRegistry,
  bootstrapAgentTools,
  createMemoryAgentRuntimeStore,
  FOUNDATION_AGENTS,
  getDefaultAgentRegistry,
  isDirectorAllowedSpecialist,
  parseMarketingAnalysis,
  resetAgentBootstrap,
  resetAgentLLMProvider,
  resetDefaultAgentRegistry,
  resetSpecialistInvokers,
  runMarketingAnalystAgent,
  runMarketingDirectorAgent,
  setAgentLLMProvider,
  setSpecialistInvokers,
  specialistIdToInvokeName,
  invokeNameToSpecialistId,
  toolIdToFunctionName,
  MARKETING_ANALYST_TOOL_IDS,
  DIRECTOR_ALLOWED_SPECIALISTS,
  type SpecialistInvokeResult,
} from "@/server/agent";
import { isAnalyticsPlatformRemoved, isAnalyticsPlatformUnavailable } from "@/server/social-analytics-ingestion";

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
        title: "Industry Day",
        status: "OPEN",
        eventDate: new Date("2026-08-15"),
        score: { overall: 72 },
        scoreLevel: "HIGH",
        explanation: null,
        whyMatched: null,
        event: {
          id: "ev1",
          key: "industry-day",
          name: "Industry Day",
          date: "2026-08-15",
        },
        evidence: [],
        matchingFactors: {
          rulesMatched: [],
          rulesFailed: [],
          missingInfo: [],
        },
        preparationWindow: {
          planningStart: null,
          contentDeadline: null,
          designDeadline: null,
          approvalDeadline: null,
          publishingStart: null,
          publishingEnd: null,
        },
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
        id: "cal_1",
        name: "World Burger Day",
        date: "2026-08-10",
        key: "burger-day",
      },
    ],
  })),
}));

vi.mock("@/server/services/knowledge-graph", () => ({
  searchKnowledgeNodes: vi.fn(async () => []),
}));

vi.mock("@/server/research/registry", () => ({
  getWebSearchProvider: () => ({
    id: "offline",
    isConfigured: () => false,
    search: async () => [],
  }),
  getCrawlProvider: () => ({
    id: "offline",
    isConfigured: () => false,
    crawl: async () => ({
      url: "",
      title: null,
      content: null,
      metadata: null,
      source: "offline",
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
    findFirst: ReturnType<typeof vi.fn>;
  };
  socialPublication: { findMany: ReturnType<typeof vi.fn> };
  contentLearning: { findMany: ReturnType<typeof vi.fn> };
  marketingStrategy: { findUnique: ReturnType<typeof vi.fn> };
  businessProfile: { findUnique: ReturnType<typeof vi.fn> };
};

function analysisJson(payload: Record<string, unknown>) {
  return JSON.stringify(payload);
}

function baseAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    query: "این ماه مارکتینگم چطور بود؟",
    scope: {
      brand: "Acme",
      platforms: ["linkedin"],
      from: "2026-08-01",
      to: "2026-08-31",
    },
    dataAvailability: [
      {
        source: "analytics.getPerformance",
        status: "available",
        limitations: [],
      },
    ],
    executiveSummary: {
      status: "mixed",
      summary:
        "عملکرد این ماه Mixed بود. Reach افزایش داشته، اما engagement نسبت به ماه قبل کاهش یافته.",
    },
    performance: {
      available: true,
      current: { reach: 1200, engagement: 80 },
      previous: { reach: 1000, engagement: 100 },
      changes: [
        {
          metric: "reach",
          current: 1200,
          previous: 1000,
          delta: 200,
          deltaPercent: 20,
        },
        {
          metric: "engagement",
          current: 80,
          previous: 100,
          delta: -20,
          deltaPercent: -20,
        },
      ],
      lastUpdatedAt: "2026-08-30T12:00:00.000Z",
      dataAgeMs: 86_400_000,
    },
    contentPerformance: {
      topContent: [
        {
          contentId: "ext_1",
          platform: "linkedin",
          format: "REEL",
          metric: "engagement",
          value: 96,
          rankingMetric: "engagement",
          period: "2026-08",
        },
      ],
      formatAnalysis: [
        {
          format: "REEL",
          sampleSize: 6,
          observation:
            "Reels showed higher median engagement than POST in this sample.",
          limitations: ["Observed association — not causal."],
        },
      ],
      topicAnalysis: [],
    },
    strategyAlignment: {
      available: true,
      observations: [
        "Published content covered Awareness and Engagement pillars.",
      ],
      limitations: [],
    },
    calendarImpact: {
      events: [{ title: "World Burger Day", date: "2026-08-10" }],
      observations: [
        "Event-related content was present in this period; causality is not claimed.",
      ],
      limitations: ["Observed association — not causal."],
    },
    opportunities: [
      {
        title: "Industry Day",
        score: 72,
        evidence: ["opportunity.getRelevant"],
        status: "observed_opportunity",
      },
    ],
    learnings: [
      {
        statement:
          "REEL showed higher median engagement than POST on linkedin in this sample.",
        confidence: "MEDIUM",
        sampleSize: 12,
        dimension: "format",
      },
    ],
    insights: [
      {
        insight: "12 content items with real metrics were observed.",
        type: "fact",
        evidence: ["analytics.getPerformance contentCount=12"],
        confidence: "high",
      },
      {
        insight:
          "Reels showed higher median engagement than static posts in this sample.",
        type: "observation",
        evidence: ["analytics.compareContentTypes", "learning.getRelevant"],
        confidence: "medium",
      },
      {
        insight:
          "Maintaining a meaningful Reel share may deserve investigation for Reach objectives.",
        type: "inference",
        evidence: ["formatAnalysis REEL n=6"],
        confidence: "low",
      },
    ],
    suggestedNextSteps: [
      {
        action: "Review Reel share in the next content plan as a hypothesis",
        reason: "Observed stronger engagement for Reels in this sample",
        evidence: ["formatAnalysis", "learning"],
        confidence: "medium",
      },
    ],
    areasToInvestigate: ["Why engagement declined while reach rose"],
    limitations: [],
    ...overrides,
  };
}

describe("EPIC-019 — marketing.analyst", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentBootstrap();
    resetAgentLLMProvider();
    resetSpecialistInvokers();
    resetDefaultAgentRegistry();
    registry = bootstrapAgentTools(new ToolRegistry());
    db.brand.findFirst.mockResolvedValue({ id: "brand_1", name: "Acme" });
    db.contentItem.count.mockResolvedValue(0);
    db.contentItem.findMany.mockResolvedValue([{ id: "c1" }]);
    db.analyticsSnapshot.findFirst.mockResolvedValue(null);
    db.contentMetric.findFirst.mockResolvedValue({
      source: "LINKEDIN_API",
      collectedAt: new Date(),
      updatedAt: new Date(),
    });
    db.contentMetric.count.mockResolvedValue(2);
    db.contentMetric.findMany.mockResolvedValue([
      {
        externalId: "c1",
        externalPostId: "ext_1",
        title: "Demo",
        platform: "linkedin",
        contentType: "REEL",
        publishedAt: new Date("2026-08-01"),
        reach: 100,
        impressions: 200,
        likes: 10,
        comments: 2,
        shares: 1,
        saves: 0,
        engagement: 13,
        ctr: null,
        collectedAt: new Date(),
        updatedAt: new Date(),
        source: "LINKEDIN_API",
      },
    ]);
    db.socialPublication.findMany.mockResolvedValue([
      { id: "pub_1", externalPostId: "ext_1" },
    ]);
    db.contentLearning.findMany.mockResolvedValue([]);
    db.marketingStrategy.findUnique.mockResolvedValue({
      id: "ms_1",
      pillars: ["Awareness"],
    });
    db.businessProfile.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    resetAgentLLMProvider();
    resetSpecialistInvokers();
  });

  it("TEST 1: Agent registration", () => {
    expect(
      FOUNDATION_AGENTS.some((a) => a.id === "marketing.analyst"),
    ).toBe(true);
    expect(getDefaultAgentRegistry().hasAgent("marketing.analyst")).toBe(true);
    expect(isDirectorAllowedSpecialist("marketing.analyst")).toBe(true);
    expect(DIRECTOR_ALLOWED_SPECIALISTS).toContain("marketing.analyst");
  });

  it("TEST 2: Read-only permission on all tools", () => {
    for (const id of MARKETING_ANALYST_TOOL_IDS) {
      expect(registry.hasTool(id)).toBe(true);
      expect(registry.getTool(id)?.permission).toBe("READ");
    }
    expect(MARKETING_ANALYST_TOOL_IDS).not.toContain("content.publish");
  });

  it("TEST 3–11: General analysis with performance, content, learning, strategy, calendar, opportunity", async () => {
    db.contentLearning.findMany.mockResolvedValue([
      {
        id: "learn_1",
        workspaceId: "ws_1",
        brandId: "brand_1",
        platform: "linkedin",
        dimension: "format",
        type: "OBSERVATION",
        statement: "REEL showed higher median engagement than POST.",
        rationale: "median",
        confidence: "MEDIUM",
        sampleSize: 12,
        metric: "engagement",
        periodFrom: new Date("2026-07-01"),
        periodTo: new Date("2026-07-31"),
        lastObservedAt: new Date(),
        status: "ACTIVE",
        fingerprint: "fp",
        outlierPresent: false,
        limitations: [],
        usefulFeedback: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { evidence: 4 },
      },
    ]);

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("analytics.getPerformance"),
              arguments: { from: "2026-08-01", to: "2026-08-31" },
            },
            {
              name: toolIdToFunctionName("analytics.getTopContent"),
              arguments: {},
            },
            {
              name: toolIdToFunctionName("learning.getRelevant"),
              arguments: {},
            },
            {
              name: toolIdToFunctionName("brand.getStrategy"),
              arguments: {},
            },
            {
              name: toolIdToFunctionName("calendar.getEvents"),
              arguments: {},
            },
            {
              name: toolIdToFunctionName("opportunity.getRelevant"),
              arguments: {},
            },
          ],
        },
        {
          type: "message",
          content: analysisJson(baseAnalysis()),
        },
      ]),
    );

    const result = await runMarketingAnalystAgent({
      message: "این ماه مارکتینگم چطور بود؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.analysis.executiveSummary.status).toBe("mixed");
    expect(result.analysis.performance.available).toBe(true);
    expect(result.analysis.performance.changes[0]?.deltaPercent).toBe(20);
    expect(result.analysis.contentPerformance.topContent[0]?.rankingMetric).toBe(
      "engagement",
    );
    expect(result.analysis.learnings.length).toBeGreaterThan(0);
    expect(result.analysis.strategyAlignment.available).toBe(true);
    expect(result.analysis.calendarImpact.events.length).toBeGreaterThan(0);
    expect(result.analysis.opportunities[0]?.score).toBe(72);
    expect(result.toolResults.map((t) => t.tool)).toEqual(
      expect.arrayContaining([
        "analytics.getPerformance",
        "analytics.getTopContent",
        "learning.getRelevant",
        "brand.getStrategy",
        "calendar.getEvents",
        "opportunity.getRelevant",
      ]),
    );
  });

  it("TEST 12–15: Trend unavailable, small sample, missing metrics, no fake metrics", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.findTrendingTopics"),
              arguments: {},
            },
          ],
        },
        {
          type: "message",
          content: analysisJson(
            baseAnalysis({
              executiveSummary: {
                status: "insufficient_data",
                summary: "Data insufficient for strong conclusions.",
              },
              performance: {
                available: false,
                current: {},
                previous: {},
                changes: [
                  {
                    metric: "reach",
                    current: null,
                    previous: 0,
                    delta: null,
                    deltaPercent: null,
                  },
                ],
                lastUpdatedAt: null,
                dataAgeMs: null,
              },
              insights: [
                {
                  insight: "Only 3 posts in sample — SMALL_SAMPLE.",
                  type: "fact",
                  evidence: ["sampleSize=3"],
                  confidence: "low",
                },
              ],
              limitations: [
                "TREND_PROVIDER_UNAVAILABLE",
                "SMALL_SAMPLE",
                "NO_PERFORMANCE_EVIDENCE",
              ],
            }),
          ),
        },
      ]),
    );

    const result = await runMarketingAnalystAgent({
      message: "روند بازار و عملکرد ما؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.analysis.limitations).toEqual(
      expect.arrayContaining(["TREND_PROVIDER_UNAVAILABLE", "SMALL_SAMPLE"]),
    );
    expect(result.analysis.performance.changes[0]?.deltaPercent).toBeNull();
    expect(JSON.stringify(result.analysis)).not.toMatch(
      /will go viral|fake likes|invented/i,
    );
  });

  it("TEST 16–19: Fact/observation/inference, no causal claim, evidence, freshness", async () => {
    const analysis = parseMarketingAnalysis(
      analysisJson(baseAnalysis()),
      "q",
    );
    const types = analysis.insights.map((i) => i.type);
    expect(types).toContain("fact");
    expect(types).toContain("observation");
    expect(types).toContain("inference");
    expect(
      analysis.insights.every((i) => (i.evidence?.length ?? 0) > 0),
    ).toBe(true);
    expect(analysis.calendarImpact.limitations.join(" ")).toMatch(/not causal/i);
    expect(analysis.performance.lastUpdatedAt).toBeTruthy();
    expect(analysis.performance.dataAgeMs).toBeTypeOf("number");
    expect(JSON.stringify(analysis)).not.toMatch(
      /caused higher|causes reach|because you posted at/i,
    );
  });

  it("TEST 20–22: Wrong brand rejected by tools; no credential leak", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("analytics.getPerformance"),
              arguments: { brandId: "other_brand" },
            },
          ],
        },
        {
          type: "message",
          content: analysisJson(
            baseAnalysis({
              limitations: ["SCOPE_VIOLATION handled"],
            }),
          ),
        },
      ]),
    );

    const result = await runMarketingAnalystAgent({
      message: "گزارش بده",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.success).toBe(false);
    expect(result.toolResults[0]?.error?.code).toBe("SCOPE_VIOLATION");
    expect(JSON.stringify(result)).not.toMatch(/accessToken|refreshToken|Bearer /i);
  });

  it("TEST 23–27: No WRITE/PUBLISH/mutation tools; strategy change stays recommendation", async () => {
    expect(MARKETING_ANALYST_TOOL_IDS).not.toContain("content.publish");
    expect(
      MARKETING_ANALYST_TOOL_IDS.every(
        (id) =>
          !id.startsWith("content.publish") &&
          !id.includes(".write") &&
          !id.includes(".execute"),
      ),
    ).toBe(true);

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: analysisJson(
            baseAnalysis({
              query: "استراتژی را تغییر بده",
              suggestedNextSteps: [
                {
                  action: "Consider reviewing pillar mix — recommendation only",
                  reason: "User asked to change strategy; analyst cannot mutate",
                  evidence: ["user request"],
                  confidence: "low",
                },
              ],
              limitations: ["NO_STRATEGY_MUTATION"],
            }),
          ),
        },
      ]),
    );

    const result = await runMarketingAnalystAgent({
      message: "بر اساس این گزارش استراتژی را تغییر بده.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.analysis.limitations).toContain("NO_STRATEGY_MUTATION");
    expect(result.analysis.suggestedNextSteps.length).toBeGreaterThan(0);
    expect(db.marketingStrategy.findUnique).not.toHaveBeenCalled();
  });

  it("TEST 28–30: Marketing Director routes to marketing.analyst; no recursion", async () => {
    const invokeName = specialistIdToInvokeName("marketing.analyst");
    expect(invokeName).toBe("invoke__marketing_analyst");
    expect(invokeNameToSpecialistId(invokeName)).toBe("marketing.analyst");

    const calls: string[] = [];
    setSpecialistInvokers({
      "marketing.analyst": async (): Promise<SpecialistInvokeResult> => {
        calls.push("marketing.analyst");
        return {
          success: true,
          agentId: "marketing.analyst",
          executionId: "exec_ma",
          status: "COMPLETED",
          response: analysisJson(baseAnalysis()),
          payload: {
            analysis: parseMarketingAnalysis(
              analysisJson(baseAnalysis()),
              "این ماه مارکتینگمون چطور بوده؟",
            ),
            success: true,
          },
        };
      },
    });

    const directorLlm = new FakeLLMProvider([
      {
        type: "tool_calls",
        calls: [
          {
            name: invokeName,
            arguments: {
              message: "این ماه مارکتینگمون چطور بوده؟",
              purpose: "monthly marketing analysis",
            },
          },
        ],
      },
      {
        type: "message",
        content: JSON.stringify({
          intent: "MARKETING_ANALYSIS",
          constraints: {},
          response:
            "عملکرد این ماه Mixed بود. Reach بهتر شده اما engagement کاهش یافته.",
          stepsSummary: [
            {
              agent: "marketing.analyst",
              purpose: "monthly marketing analysis",
              status: "completed",
            },
          ],
          limitations: [],
          conflicts: [],
        }),
      },
    ]);
    setAgentLLMProvider(directorLlm);

    const result = await runMarketingDirectorAgent({
      message: "این ماه مارکتینگمون چطور بوده؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      llm: directorLlm,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.intent).toBe("MARKETING_ANALYSIS");
    expect(calls).toEqual(["marketing.analyst"]);
    expect(result.specialistCalls).toBe(1);
    expect(result.steps[0]?.agent).toBe("marketing.analyst");
    expect(calls).not.toContain("marketing.director");
  });

  it("TEST 31–33: Meta/TikTok unavailable; Pinterest absent", () => {
    expect(isAnalyticsPlatformUnavailable("meta")).toBe(true);
    expect(isAnalyticsPlatformUnavailable("tiktok")).toBe(true);
    expect(isAnalyticsPlatformRemoved("pinterest")).toBe(true);
  });

  it("parse failure does not invent metrics", () => {
    const parsed = parseMarketingAnalysis("not json", "q");
    expect(parsed.executiveSummary.status).toBe("insufficient_data");
    expect(parsed.performance.available).toBe(false);
    expect(parsed.insights).toHaveLength(0);
    expect(parsed.limitations).toContain("PARSE_FAILED");
  });
});
