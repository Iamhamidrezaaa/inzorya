import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  FakeLLMProvider,
  ToolRegistry,
  bootstrapAgentTools,
  createMemoryAgentRuntimeStore,
  resetAgentBootstrap,
  resetAgentLLMProvider,
  runMarketingReadonlyAgent,
  setAgentLLMProvider,
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
    contentMetric: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
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
};

function makeWriteTool(): ToolDefinition {
  return {
    id: "content.publish",
    name: "Publish",
    description: "Should never be callable by marketing.readonly",
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

describe("EPIC AGENT-006 — marketing.readonly", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentBootstrap();
    resetAgentLLMProvider();
    registry = bootstrapAgentTools(new ToolRegistry());
    db.brand.findFirst.mockResolvedValue({ id: "brand_1" });
    db.businessProfile.findUnique.mockResolvedValue(null);
    db.businessBrain.findFirst.mockResolvedValue(null);
    db.marketingStrategy.findUnique.mockResolvedValue(null);
    db.contentItem.count.mockResolvedValue(0);
    db.contentItem.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    resetAgentLLMProvider();
  });

  it("scenario: brand context question", async () => {
    db.brand.findFirst
      .mockResolvedValueOnce({ id: "brand_1" })
      .mockResolvedValueOnce({
        id: "brand_1",
        name: "Capital Fruit",
        slug: "capital-fruit",
        description: "luxury fruit",
        website: null,
        industry: "food",
        brandVoice: "friendly",
        targetAudience: "everyone",
      });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [{ name: toolIdToFunctionName("brand.getContext"), arguments: {} }],
        },
        {
          type: "message",
          content:
            "FACT: برند Capital Fruit در صنعت food است. INFERENCE: مخاطب گسترده دارد.",
        },
      ]),
    );

    const store = createMemoryAgentRuntimeStore();
    const result = await runMarketingReadonlyAgent({
      message: "اطلاعات برند من چیست؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store,
    });

    expect(result.success).toBe(true);
    expect(result.toolResults[0]?.tool).toBe("brand.getContext");
    expect(result.toolResults[0]?.success).toBe(true);
    expect(result.response).toContain("Capital Fruit");
    const logs = store.toolExecutions.get(result.executionId) ?? [];
    expect(logs[0]?.toolId).toBe("brand.getContext");
  });

  it("scenario: strategy question", async () => {
    db.marketingStrategy.findUnique.mockResolvedValue({
      id: "s1",
      goals: ["increase_sales"],
      postingFrequency: null,
      preferredPlatforms: [],
      contentTypes: [],
      tone: null,
      contentLength: null,
      ctaStyle: null,
      currentStage: "understand",
      nextStep: "Complete overview",
      personas: [],
      competitors: [],
      pillars: [],
      roadmapTasks: [],
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            { name: toolIdToFunctionName("brand.getStrategy"), arguments: {} },
          ],
        },
        {
          type: "message",
          content: "FACT: استراتژی فعلی در مرحله understand است.",
        },
      ]),
    );

    const result = await runMarketingReadonlyAgent({
      message: "استراتژی فعلی برند من چیست؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });
    expect(result.toolResults[0]?.tool).toBe("brand.getStrategy");
    expect(result.success).toBe(true);
  });

  it("scenario: content history", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("content.getHistory"),
              arguments: { limit: 5 },
            },
          ],
        },
        { type: "message", content: "FACT: تاریخچه محتوا خالی است." },
      ]),
    );
    const result = await runMarketingReadonlyAgent({
      message: "چه محتوایی در گذشته داشته‌ام؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });
    expect(result.toolResults[0]?.tool).toBe("content.getHistory");
  });

  it("scenario: opportunities 30 days", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("opportunity.getRelevant"),
              arguments: { horizonDays: 30 },
            },
            {
              name: toolIdToFunctionName("calendar.getEvents"),
              arguments: { limit: 5 },
            },
          ],
        },
        {
          type: "message",
          content: "FACT: در افق ۳۰ روزه فرصتی در داده موجود نیست.",
        },
      ]),
    );
    const result = await runMarketingReadonlyAgent({
      message: "برای ۳۰ روز آینده چه فرصت‌های بازاریابی دارم؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });
    expect(result.toolResults.map((t) => t.tool)).toEqual([
      "opportunity.getRelevant",
      "calendar.getEvents",
    ]);
  });

  it("scenario: trending topics reports unavailable provider honestly", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("research.findTrendingTopics"),
              arguments: { topic: "food" },
            },
          ],
        },
        {
          type: "message",
          content:
            "UNAVAILABLE: ارائه‌دهنده تحقیق ترند پیکربندی نشده است، بنابراین سیگنال وب در دسترس نیست.",
        },
      ]),
    );
    const result = await runMarketingReadonlyAgent({
      message: "چه موضوعاتی الان در حوزه من مطرح هستند؟",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });
    expect(result.toolResults[0]?.tool).toBe("research.findTrendingTopics");
    expect(result.response.toLowerCase()).toMatch(/unavailable|در دسترس|پیکربندی/);
  });

  it("scenario: refuse publish actions without calling WRITE/PUBLISH tools", async () => {
    registry.registerTool(makeWriteTool());
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content:
            "من یک Agent فقط‌خواندنی هستم و نمی‌توانم پست را منتشر کنم.",
        },
      ]),
    );
    const result = await runMarketingReadonlyAgent({
      message: "برای فردا این پست را منتشر کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });
    expect(result.success).toBe(true);
    expect(result.toolResults).toHaveLength(0);
    expect(result.response).toMatch(/فقط‌خواندنی|منتشر/);
  });

  it("blocks PUBLISH tool even if LLM requests it", async () => {
    registry.registerTool(makeWriteTool());
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
          content: "اجرای انتشار مجاز نیست.",
        },
      ]),
    );
    const result = await runMarketingReadonlyAgent({
      message: "publish now",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });
    expect(result.toolResults[0]?.success).toBe(false);
    expect(result.toolResults[0]?.error?.code).toBe("PERMISSION_DENIED");
  });

  it("multi-step synthesis uses brand + opportunities", async () => {
    db.brand.findFirst
      .mockResolvedValueOnce({ id: "brand_1" })
      .mockResolvedValueOnce({
        id: "brand_1",
        name: "Capital Fruit",
        slug: "capital-fruit",
        description: null,
        website: null,
        industry: "food",
        brandVoice: null,
        targetAudience: null,
      });

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
              name: toolIdToFunctionName("opportunity.getRelevant"),
              arguments: { horizonDays: 30 },
            },
          ],
        },
        {
          type: "tool_calls",
          calls: [
            {
              name: toolIdToFunctionName("calendar.getEvents"),
              arguments: { limit: 5 },
            },
          ],
        },
        {
          type: "message",
          content:
            "FACT: برند food است. INFERENCE: فرصت‌های ماه آینده باید با صنعت غذا هم‌راستا باشند.",
        },
      ]),
    );

    const store = createMemoryAgentRuntimeStore();
    const result = await runMarketingReadonlyAgent({
      message:
        "برای ماه آینده، فرصت‌های مناسب برند من را بررسی کن و بر اساس اطلاعات برند توضیح بده کدام‌ها مرتبط‌تر هستند.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store,
    });

    expect(result.success).toBe(true);
    expect(result.rounds).toBeGreaterThanOrEqual(3);
    expect(result.toolResults.map((t) => t.tool)).toEqual([
      "brand.getContext",
      "opportunity.getRelevant",
      "calendar.getEvents",
    ]);
    const logs = store.toolExecutions.get(result.executionId) ?? [];
    expect(logs.map((l) => l.sequence)).toEqual([1, 2, 3]);
  });

  it("stops at max tool rounds", async () => {
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
            { name: toolIdToFunctionName("brand.getStrategy"), arguments: {} },
          ],
        },
      ]),
    );
    // After 2 fake steps, FakeLLM returns default message — use maxRounds 1
    const result = await runMarketingReadonlyAgent({
      message: "test",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
      maxRounds: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("MAX_TOOL_ROUNDS");
  });

  it("requires scoped ids", async () => {
    setAgentLLMProvider(new FakeLLMProvider([{ type: "message", content: "x" }]));
    await expect(
      runMarketingReadonlyAgent({
        message: "hi",
        userId: "u",
        workspaceId: "",
        brandId: "b",
        toolRegistry: registry,
        store: createMemoryAgentRuntimeStore(),
      }),
    ).rejects.toMatchObject({ code: "SCOPE_VIOLATION" });
  });
});
