import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeLLMProvider,
  createMemoryAgentRuntimeStore,
  invokeSpecialistAgent,
  resetSpecialistInvokers,
  runMarketingDirectorAgent,
  setAgentLLMProvider,
  setSpecialistInvokers,
  specialistIdToInvokeName,
  resetAgentLLMProvider,
  type SpecialistInvokeResult,
  type SpecialistInvokerMap,
  type SpecialistInvokeContext,
} from "@/server/agent";
import type { ContentBlueprint } from "@/server/agent";

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findFirst: vi.fn(async () => ({ id: "brand_1" })) },
    businessProfile: { findUnique: vi.fn(async () => null) },
    businessBrain: { findFirst: vi.fn(async () => null) },
    marketingStrategy: { findUnique: vi.fn(async () => null) },
    contentItem: { count: vi.fn(), findMany: vi.fn(async () => []) },
    analyticsSnapshot: { findFirst: vi.fn(async () => null) },
    contentMetric: { count: vi.fn(), findMany: vi.fn(async () => []), findFirst: vi.fn() },
    socialPublication: { findMany: vi.fn() },
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

function mockResult(
  agentId: SpecialistInvokeResult["agentId"],
  payload: Record<string, unknown>,
  success = true,
): SpecialistInvokeResult {
  return {
    success,
    agentId,
    executionId: `child_${agentId}`,
    status: success ? "COMPLETED" : "FAILED",
    response: typeof payload.response === "string" ? payload.response : "",
    payload,
    error: success
      ? undefined
      : { code: "SPECIALIST_FAILED", message: "Specialist failed." },
  };
}

function sampleBlueprint(
  constraints: Record<string, unknown> = { Reel: 3, Carousel: 2 },
): ContentBlueprint {
  return {
    request: {
      original: "plan",
      mode: "user_constrained",
      dateRange: {},
      channels: ["INSTAGRAM"],
      constraints,
    },
    strategy: {
      primaryObjective: "Engagement",
      secondaryObjectives: [],
      summary: "Constrained plan",
    },
    contentPlan: [
      {
        id: "r1",
        channel: "INSTAGRAM",
        format: "Reel",
        topic: "T1",
        objective: "Engagement",
        angle: "A1",
        whyNow: "user",
        evidence: [],
        reasoning: { facts: [], inferences: [], unknowns: [] },
      },
      {
        id: "r2",
        channel: "INSTAGRAM",
        format: "Reel",
        topic: "T2",
        objective: "Engagement",
        angle: "A2",
        whyNow: "user",
        evidence: [],
        reasoning: { facts: [], inferences: [], unknowns: [] },
      },
      {
        id: "r3",
        channel: "INSTAGRAM",
        format: "Reel",
        topic: "T3",
        objective: "Engagement",
        angle: "A3",
        whyNow: "user",
        evidence: [],
        reasoning: { facts: [], inferences: [], unknowns: [] },
      },
      {
        id: "c1",
        channel: "INSTAGRAM",
        format: "Carousel",
        topic: "T4",
        objective: "Education",
        angle: "A4",
        whyNow: "user",
        evidence: [],
        reasoning: { facts: [], inferences: [], unknowns: [] },
      },
      {
        id: "c2",
        channel: "INSTAGRAM",
        format: "Carousel",
        topic: "T5",
        objective: "Education",
        angle: "A5",
        whyNow: "user",
        evidence: [],
        reasoning: { facts: [], inferences: [], unknowns: [] },
      },
    ],
    coverage: {
      requestedCount: constraints,
      plannedCount: constraints,
      channels: ["INSTAGRAM"],
      formats: ["Reel", "Carousel"],
    },
    limitations: [],
  };
}

describe("EPIC AGENT-012 — marketing.director", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentLLMProvider();
    resetSpecialistInvokers();
  });

  afterEach(() => {
    resetAgentLLMProvider();
    resetSpecialistInvokers();
  });

  function installMocks(map: SpecialistInvokerMap) {
    setSpecialistInvokers(map);
  }

  it("test 1: simple information → marketing.readonly only", async () => {
    const calls: string[] = [];
    installMocks({
      "marketing.readonly": async () => {
        calls.push("marketing.readonly");
        return mockResult("marketing.readonly", {
          response: "Brand is Capital Fruit.",
          success: true,
        });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("marketing.readonly"),
              arguments: { message: "اطلاعات برند من چیست؟", purpose: "brand info" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "INFORMATION",
            constraints: {},
            response: "برند شما Capital Fruit است.",
            stepsSummary: [
              { agent: "marketing.readonly", purpose: "brand info", status: "completed" },
            ],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "اطلاعات برند من چیست؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual(["marketing.readonly"]);
    expect(result.specialistCalls).toBe(1);
    expect(result.intent).toBe("INFORMATION");
  });

  it("test 2: trend → trend.intelligence", async () => {
    const calls: string[] = [];
    installMocks({
      "trend.intelligence": async () => {
        calls.push("trend.intelligence");
        return mockResult("trend.intelligence", {
          intelligence: {
            trends: [{ topic: "BTS food", classification: "signal" }],
            limitations: [],
          },
        });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("trend.intelligence"),
              arguments: { message: "ترندها؟" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "TREND_RESEARCH",
            response: "سیگنال‌های ترند جمع‌آوری شد.",
            stepsSummary: [{ agent: "trend.intelligence", status: "completed" }],
            limitations: [],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "الان در حوزه من چه چیزهایی ترند شده؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual(["trend.intelligence"]);
  });

  it("test 3: analytics → social.analytics", async () => {
    const calls: string[] = [];
    installMocks({
      "social.analytics": async () => {
        calls.push("social.analytics");
        return mockResult("social.analytics", {
          intelligence: {
            overview: { available: true, summary: "Reach strong" },
            insights: [],
            limitations: [],
          },
        });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("social.analytics"),
              arguments: { message: "ماه گذشته" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "PERFORMANCE_ANALYSIS",
            response: "عملکرد ماه گذشته خلاصه شد.",
            stepsSummary: [{ agent: "social.analytics", status: "completed" }],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "ماه گذشته پیجم چطور عمل کرد؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual(["social.analytics"]);
  });

  it("test 4: content analysis → viral.content.analyst", async () => {
    const calls: string[] = [];
    installMocks({
      "viral.content.analyst": async () => {
        calls.push("viral.content.analyst");
        return mockResult("viral.content.analyst", {
          analysis: { patterns: [], limitations: [] },
        });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("viral.content.analyst"),
              arguments: { message: "https://example.com/x" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "CONTENT_ANALYSIS",
            response: "تحلیل ساختاری انجام شد.",
            stepsSummary: [{ agent: "viral.content.analyst", status: "completed" }],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "این URL را تحلیل کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual(["viral.content.analyst"]);
  });

  it("test 5: planning → content.strategist", async () => {
    const calls: string[] = [];
    installMocks({
      "content.strategist": async () => {
        calls.push("content.strategist");
        return mockResult("content.strategist", {
          blueprint: sampleBlueprint({}),
        });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("content.strategist"),
              arguments: { message: "برنامه هفته بعد" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "CONTENT_PLANNING",
            response: "Blueprint آماده است.",
            stepsSummary: [{ agent: "content.strategist", status: "completed" }],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "برای هفته بعد برنامه محتوا بده.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual(["content.strategist"]);
  });

  it("test 6: creation from Blueprint → content.creator only", async () => {
    const calls: string[] = [];
    const bp = sampleBlueprint({ Reel: 1 });
    installMocks({
      "content.creator": async (ctx: SpecialistInvokeContext) => {
        calls.push("content.creator");
        expect(ctx.blueprintItem || ctx.blueprint).toBeTruthy();
        return mockResult("content.creator", {
          asset: { creative: { hooks: ["h1"] }, quality: { limitations: [] } },
        });
      },
      "content.strategist": async () => {
        calls.push("content.strategist");
        return mockResult("content.strategist", { blueprint: bp });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("content.creator"),
              arguments: {
                message: "این Blueprint را اجرا کن",
                blueprint: bp,
                blueprintItem: bp.contentPlan[0],
              },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "CONTENT_CREATION",
            response: "محتوا آماده شد.",
            stepsSummary: [{ agent: "content.creator", status: "completed" }],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "برای این Blueprint محتوا تولید کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual(["content.creator"]);
    expect(result.specialistCalls).toBe(1);
  });

  it("test 7: full workflow analytics→trend→strategist→creator with constraints", async () => {
    const calls: string[] = [];
    const seenConstraints: Record<string, unknown>[] = [];
    installMocks({
      "social.analytics": async (ctx: SpecialistInvokeContext) => {
        calls.push("social.analytics");
        seenConstraints.push(ctx.constraints || {});
        return mockResult("social.analytics", {
          intelligence: {
            overview: { available: true, summary: "Reels stronger" },
            insights: [
              { type: "observation", insight: "Reels higher reach", confidence: "medium" },
            ],
            limitations: [],
          },
        });
      },
      "trend.intelligence": async (ctx: SpecialistInvokeContext) => {
        calls.push("trend.intelligence");
        seenConstraints.push(ctx.constraints || {});
        return mockResult("trend.intelligence", {
          intelligence: {
            trends: [{ topic: "BTS", classification: "emerging_pattern" }],
            limitations: [],
          },
        });
      },
      "content.strategist": async (ctx: SpecialistInvokeContext) => {
        calls.push("content.strategist");
        seenConstraints.push(ctx.constraints || {});
        expect(ctx.constraints).toMatchObject({ Reel: 3, Carousel: 2 });
        return mockResult("content.strategist", {
          blueprint: sampleBlueprint({ Reel: 3, Carousel: 2 }),
        });
      },
      "content.creator": async (ctx: SpecialistInvokeContext) => {
        calls.push("content.creator");
        seenConstraints.push(ctx.constraints || {});
        expect(ctx.constraints).toMatchObject({ Reel: 3, Carousel: 2 });
        expect(ctx.blueprint || ctx.blueprintItem).toBeTruthy();
        return mockResult("content.creator", {
          asset: {
            content: { format: "Reel" },
            creative: { hooks: ["a", "b", "c"] },
            quality: { limitations: [] },
          },
        });
      },
    });

    const constraints = { Reel: 3, Carousel: 2, channel: "INSTAGRAM" };

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("social.analytics"),
              arguments: {
                message: "عملکرد ماه قبل",
                constraints,
              },
            },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("trend.intelligence"),
              arguments: { message: "ترندهای فعلی", constraints },
            },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("content.strategist"),
              arguments: {
                message: "۳ ریلز و ۲ کاروسل",
                constraints,
              },
            },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("content.creator"),
              arguments: {
                message: "محتواها را آماده کن",
                constraints,
              },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "MULTI_STEP_MARKETING_TASK",
            constraints,
            response:
              "برنامه ۳ ریلز و ۲ کاروسل بر اساس عملکرد و ترندها آماده و محتوا تولید شد.",
            stepsSummary: [
              { agent: "social.analytics", status: "completed" },
              { agent: "trend.intelligence", status: "completed" },
              { agent: "content.strategist", status: "completed" },
              { agent: "content.creator", status: "completed" },
            ],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message:
        "بر اساس عملکرد ماه قبل و ترندهای فعلی برای هفته آینده ۳ ریلز و ۲ کاروسل برنامه بده و محتواهاش را هم آماده کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual([
      "social.analytics",
      "trend.intelligence",
      "content.strategist",
      "content.creator",
    ]);
    expect(result.constraints).toMatchObject({ Reel: 3, Carousel: 2 });
    expect(seenConstraints.every((c) => c.Reel === 3 && c.Carousel === 2)).toBe(
      true,
    );
  });

  it("test 8: calendar workflow via readonly then strategist then creator", async () => {
    const calls: string[] = [];
    installMocks({
      "marketing.readonly": async () => {
        calls.push("marketing.readonly");
        return mockResult("marketing.readonly", {
          response: "World Burger Day opportunity found.",
          toolResults: [{ tool: "calendar.getEvents", success: true }],
        });
      },
      "content.strategist": async () => {
        calls.push("content.strategist");
        return mockResult("content.strategist", {
          blueprint: sampleBlueprint({ Reel: 1 }),
        });
      },
      "content.creator": async () => {
        calls.push("content.creator");
        return mockResult("content.creator", {
          asset: { creative: { caption: "burger day" }, quality: { limitations: [] } },
        });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("marketing.readonly"),
              arguments: { message: "فرصت روز برگر" },
            },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("content.strategist"),
              arguments: { message: "برنامه برای روز برگر" },
            },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("content.creator"),
              arguments: { message: "محتوا" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "CALENDAR_OPPORTUNITY",
            response: "محتوای مناسب روز جهانی برگر آماده شد.",
            stepsSummary: [
              { agent: "marketing.readonly", status: "completed" },
              { agent: "content.strategist", status: "completed" },
              { agent: "content.creator", status: "completed" },
            ],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "برای روز جهانی برگر یک محتوای مناسب آماده کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual([
      "marketing.readonly",
      "content.strategist",
      "content.creator",
    ]);
  });

  it("test 9: analysis only — no creator", async () => {
    const calls: string[] = [];
    installMocks({
      "viral.content.analyst": async () => {
        calls.push("viral.content.analyst");
        return mockResult("viral.content.analyst", {
          analysis: { patterns: [{ pattern: "result-first" }], limitations: [] },
        });
      },
      "content.creator": async () => {
        calls.push("content.creator");
        return mockResult("content.creator", { asset: {} });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("viral.content.analyst"),
              arguments: {
                message: "فقط تحلیل",
                constraints: { createContent: false },
              },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "CONTENT_ANALYSIS",
            constraints: { createContent: false },
            response: "تحلیل انجام شد. محتوا تولید نشد.",
            stepsSummary: [
              { agent: "viral.content.analyst", status: "completed" },
            ],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "این محتوا را فقط تحلیل کن. چیزی تولید نکن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual(["viral.content.analyst"]);
    expect(calls).not.toContain("content.creator");
  });

  it("test 10: strategy only — no creator", async () => {
    const calls: string[] = [];
    installMocks({
      "content.strategist": async () => {
        calls.push("content.strategist");
        return mockResult("content.strategist", {
          blueprint: sampleBlueprint({}),
        });
      },
      "content.creator": async () => {
        calls.push("content.creator");
        return mockResult("content.creator", { asset: {} });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("content.strategist"),
              arguments: {
                message: "برنامه",
                constraints: { createContent: false },
              },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "CONTENT_PLANNING",
            constraints: { createContent: false },
            response: "برنامه آماده است؛ محتوا تولید نشد.",
            stepsSummary: [{ agent: "content.strategist", status: "completed" }],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "برنامه بده ولی محتوا تولید نکن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual(["content.strategist"]);
  });

  it("test 11: provider/trend failure preserves limitation", async () => {
    installMocks({
      "trend.intelligence": async () =>
        mockResult("trend.intelligence", {
          intelligence: {
            trends: [],
            limitations: [
              "external research unavailable (TREND_RESEARCH_PROVIDER_NOT_CONFIGURED)",
            ],
          },
        }),
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("trend.intelligence"),
              arguments: { message: "ترند" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "TREND_RESEARCH",
            response:
              "Current external trend research was unavailable, so this part of the analysis is limited.",
            limitations: [
              "external research unavailable (TREND_RESEARCH_PROVIDER_NOT_CONFIGURED)",
            ],
            stepsSummary: [{ agent: "trend.intelligence", status: "completed" }],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "ترندهای فعلی؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.final.limitations.join(" ")).toMatch(/unavailable/i);
    expect(result.response).toMatch(/unavailable|limited/i);
  });

  it("test 12: specialist failure — explicit reason", async () => {
    installMocks({
      "social.analytics": async () =>
        mockResult(
          "social.analytics",
          { intelligence: { overview: { available: false } } },
          false,
        ),
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("social.analytics"),
              arguments: { message: "performance" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "PERFORMANCE_ANALYSIS",
            response:
              "Social analytics specialist failed; cannot complete a performance report without inventing metrics.",
            limitations: ["social.analytics failed"],
            stepsSummary: [{ agent: "social.analytics", status: "failed" }],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "عملکرد؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.steps[0]?.status).toBe("failed");
    expect(result.response).toMatch(/failed|cannot complete/i);
  });

  it("test 13: constraint preservation 3 Reels + 2 Carousels", async () => {
    installMocks({
      "content.strategist": async (ctx: SpecialistInvokeContext) => {
        expect(ctx.constraints).toMatchObject({ Reel: 3, Carousel: 2 });
        return mockResult("content.strategist", {
          blueprint: sampleBlueprint({ Reel: 3, Carousel: 2 }),
        });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("content.strategist"),
              arguments: {
                message: "۳ ریلز و ۲ کاروسل",
                constraints: { Reel: 3, Carousel: 2 },
              },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "CONTENT_PLANNING",
            constraints: { Reel: 3, Carousel: 2 },
            response: "دقیقاً ۳ ریلز و ۲ کاروسل برنامه‌ریزی شد.",
            stepsSummary: [{ agent: "content.strategist", status: "completed" }],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "۳ ریلز و ۲ کاروسل",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.constraints).toMatchObject({ Reel: 3, Carousel: 2 });
  });

  it("test 14: no recursive Director", async () => {
    await expect(
      invokeSpecialistAgent({
        agentId: "marketing.director",
        rawArgs: { message: "hi" },
        userId: "u",
        workspaceId: "w",
        brandId: "b",
        parentExecutionId: "p",
        depth: 0,
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("test 15: no arbitrary Agent / no privilege escalation path", async () => {
    await expect(
      invokeSpecialistAgent({
        agentId: "system.test",
        rawArgs: { message: "hi" },
        userId: "u",
        workspaceId: "w",
        brandId: "b",
        parentExecutionId: "p",
        depth: 0,
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("test 16: publish request refused", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: JSON.stringify({
            intent: "UNKNOWN",
            response:
              "Publishing is not currently available. I can help plan or create content assets, but I cannot publish.",
            limitations: ["publishing unavailable"],
            stepsSummary: [],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "همین را منتشر کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.specialistCalls).toBe(0);
    expect(result.response).toMatch(/cannot publish|not currently available/i);
  });

  it("test 17: conflicting evidence preserved", async () => {
    installMocks({
      "social.analytics": async () =>
        mockResult("social.analytics", {
          intelligence: {
            overview: { available: true, summary: "Reels historically better" },
            insights: [
              {
                type: "observation",
                insight: "Reels historically perform better",
                confidence: "medium",
              },
            ],
            limitations: [],
          },
        }),
      "trend.intelligence": async () =>
        mockResult("trend.intelligence", {
          intelligence: {
            trends: [
              {
                topic: "Carousels gaining attention",
                classification: "emerging_pattern",
              },
            ],
            limitations: [],
          },
        }),
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("social.analytics"),
              arguments: { message: "history" },
            },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("trend.intelligence"),
              arguments: { message: "trends" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "STRATEGIC_ANALYSIS",
            response:
              "Historical evidence favors Reels; current signals highlight Carousels. No forced consensus.",
            conflicts: [
              {
                topic: "format preference",
                sides: [
                  "Historical: Reels perform better",
                  "Current signal: Carousels gaining attention",
                ],
                decision: "Present both; strategist should decide if planning.",
              },
            ],
            stepsSummary: [
              { agent: "social.analytics", status: "completed" },
              { agent: "trend.intelligence", status: "completed" },
            ],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "Reel یا Carousel؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.final.conflicts?.length).toBeGreaterThan(0);
    expect(result.response).toMatch(/Historical|Current/i);
  });

  it("test 18: simple request does not invoke entire ecosystem", async () => {
    const calls: string[] = [];
    installMocks({
      "marketing.readonly": async () => {
        calls.push("marketing.readonly");
        return mockResult("marketing.readonly", { response: "ok" });
      },
      "trend.intelligence": async () => {
        calls.push("trend.intelligence");
        return mockResult("trend.intelligence", { intelligence: {} });
      },
      "social.analytics": async () => {
        calls.push("social.analytics");
        return mockResult("social.analytics", { intelligence: {} });
      },
      "content.strategist": async () => {
        calls.push("content.strategist");
        return mockResult("content.strategist", { blueprint: sampleBlueprint() });
      },
      "content.creator": async () => {
        calls.push("content.creator");
        return mockResult("content.creator", { asset: {} });
      },
      "viral.content.analyst": async () => {
        calls.push("viral.content.analyst");
        return mockResult("viral.content.analyst", { analysis: {} });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("marketing.readonly"),
              arguments: { message: "brand?" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "INFORMATION",
            response: "اطلاعات برند.",
            stepsSummary: [{ agent: "marketing.readonly", status: "completed" }],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message: "نام برند من چیست؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.specialistCalls).toBe(1);
    expect(calls).toEqual(["marketing.readonly"]);
  });

  it("analytics → strategy multi-step", async () => {
    const calls: string[] = [];
    installMocks({
      "social.analytics": async () => {
        calls.push("social.analytics");
        return mockResult("social.analytics", {
          intelligence: {
            overview: { available: true, summary: "ok" },
            limitations: [],
          },
        });
      },
      "content.strategist": async (ctx: SpecialistInvokeContext) => {
        calls.push("content.strategist");
        expect(ctx.handoff && Object.keys(ctx.handoff).length).toBeGreaterThan(0);
        return mockResult("content.strategist", {
          blueprint: sampleBlueprint({}),
        });
      },
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("social.analytics"),
              arguments: { message: "30 days" },
            },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: specialistIdToInvokeName("content.strategist"),
              arguments: { message: "plan next month" },
            },
          ],
        },
        {
          type: "message",
          content: JSON.stringify({
            intent: "MULTI_STEP_MARKETING_TASK",
            response: "برنامه ماه بعد بر اساس عملکرد.",
            stepsSummary: [
              { agent: "social.analytics", status: "completed" },
              { agent: "content.strategist", status: "completed" },
            ],
          }),
        },
      ]),
    );

    const result = await runMarketingDirectorAgent({
      message:
        "بر اساس عملکرد ۳۰ روز گذشته‌ام، برای ماه آینده برنامه محتوا بده.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      store: createMemoryAgentRuntimeStore(),
    });

    expect(calls).toEqual(["social.analytics", "content.strategist"]);
  });

  it("requires authenticated scope", async () => {
    await expect(
      runMarketingDirectorAgent({
        message: "hi",
        userId: "",
        workspaceId: "ws_1",
        brandId: "brand_1",
        store: createMemoryAgentRuntimeStore(),
      }),
    ).rejects.toMatchObject({ code: "SCOPE_VIOLATION" });
  });
});
