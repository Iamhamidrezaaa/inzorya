import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  FakeLLMProvider,
  ToolRegistry,
  bootstrapAgentTools,
  createMemoryAgentRuntimeStore,
  enforceBlueprintFidelity,
  parseContentAsset,
  resetAgentBootstrap,
  resetAgentLLMProvider,
  runContentCreatorAgent,
  setAgentLLMProvider,
  toolIdToFunctionName,
} from "@/server/agent";
import type { ContentPlanItem } from "@/server/agent";
import type { ToolDefinition } from "@/server/agent/types";

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findFirst: vi.fn() },
    businessProfile: { findUnique: vi.fn() },
    businessBrain: { findFirst: vi.fn() },
    marketingStrategy: { findUnique: vi.fn() },
    contentItem: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    campaign: { create: vi.fn() },
    task: { create: vi.fn() },
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
  businessProfile: { findUnique: ReturnType<typeof vi.fn> };
  businessBrain: { findFirst: ReturnType<typeof vi.fn> };
  marketingStrategy: { findUnique: ReturnType<typeof vi.fn> };
  contentItem: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  campaign: { create: ReturnType<typeof vi.fn> };
  task: { create: ReturnType<typeof vi.fn> };
};

function makePublishTool(): ToolDefinition {
  return {
    id: "content.publish",
    name: "Publish",
    description: "Should never be callable by content.creator",
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

function blueprintItem(
  overrides: Partial<ContentPlanItem> & Pick<ContentPlanItem, "format">,
): ContentPlanItem {
  return {
    id: "bp1",
    channel: "INSTAGRAM",
    topic: "New burger launch",
    objective: "Sales",
    audience: "food lovers",
    pillar: "Product",
    angle: "Result-first product demonstration",
    whyNow: "Launch window",
    evidence: [{ type: "user", summary: "Approved blueprint" }],
    reasoning: { facts: [], inferences: [], unknowns: [] },
    ...overrides,
  };
}

function assetJson(payload: Record<string, unknown>) {
  return JSON.stringify(payload);
}

describe("EPIC AGENT-010 — content.creator", () => {
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
    db.contentItem.create.mockResolvedValue({});
    db.campaign.create.mockResolvedValue({});
    db.task.create.mockResolvedValue({});
  });

  afterEach(() => {
    resetAgentLLMProvider();
  });

  it("test 1: Reel — hook + scenes + caption + CTA", async () => {
    const item = blueprintItem({ format: "Reel", objective: "Sales" });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Reel",
              topic: "New burger launch",
              objective: "Sales",
              audience: "food lovers",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: ["اول نتیجه را ببین", "همین همبرگر تمام شد", "قبل از دستورالعمل"],
              primaryHook: "اول نتیجه را ببین",
              script: {
                scenes: [
                  {
                    order: 1,
                    duration: "3s",
                    visual: "Finished burger close-up",
                    voiceover: "این همبرگر تازه آماده شده.",
                    onScreenText: "آماده سرو",
                    productionNote: "Natural light",
                  },
                  {
                    order: 2,
                    duration: "8s",
                    visual: "Assembly steps",
                    voiceover: "از مواد تازه شروع می‌کنیم.",
                    onScreenText: "مواد تازه",
                  },
                ],
                ending: "Logo end card",
              },
              caption: "لانچ همبرگر جدید — طعم تازه را امتحان کنید.",
              cta: "همین امروز سفارش بده",
              cover: { concept: "Hero burger shot", text: "جدید" },
              productionNotes: ["Shoot vertical 9:16"],
            },
            quality: {
              strategicConsistency: "Matches Blueprint Reel / Sales / result-first",
              brandConsistency: "Neutral professional (voice not loaded)",
              limitations: [],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "این Blueprint را اجرا کن",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.success).toBe(true);
    expect(result.asset.creative.hooks.length).toBe(3);
    expect(result.asset.creative.script?.scenes?.length).toBeGreaterThan(0);
    expect(result.asset.creative.caption).toBeTruthy();
    expect(result.asset.creative.cta).toBeTruthy();
    expect(result.asset.content.format).toBe("Reel");
  });

  it("test 2: Carousel — cover + slides + caption + CTA", async () => {
    const item = blueprintItem({
      format: "Carousel",
      objective: "Education",
      topic: "3 mistakes restaurant owners make",
      angle: "3 mistakes restaurant owners make",
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Carousel",
              topic: "3 mistakes restaurant owners make",
              objective: "Education",
              angle: "3 mistakes restaurant owners make",
            },
            creative: {
              hooks: ["۳ اشتباه رایج", "اشتباه اول", "قبل از تبلیغات"],
              primaryHook: "۳ اشتباه رایج",
              carousel: {
                cover: { concept: "Bold title card", text: "۳ اشتباه" },
                slides: [
                  {
                    order: 1,
                    purpose: "Cover",
                    copy: "۳ اشتباه رستوران‌داران",
                    visual: "Title",
                  },
                  {
                    order: 2,
                    purpose: "Mistake 1",
                    copy: "منوی شلوغ بدون تمرکز",
                    visual: "Icon",
                  },
                  {
                    order: 3,
                    purpose: "Mistake 2",
                    copy: "نادیده گرفتن محتوای پشت‌صحنه",
                    visual: "Icon",
                  },
                  {
                    order: 4,
                    purpose: "CTA",
                    copy: "کدام اشتباه را دارید؟",
                    visual: "Question",
                  },
                ],
              },
              caption: "این ۳ اشتباه را چک کنید.",
              cta: "کدام مورد را تجربه کرده‌اید؟ کامنت کنید",
              productionNotes: ["Keep to 4–6 slides"],
            },
            quality: {
              strategicConsistency: "Education carousel preserved",
              brandConsistency: "ok",
              limitations: [],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "کاروسل را بساز",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.asset.content.format).toBe("Carousel");
    expect(result.asset.creative.carousel?.slides?.length).toBeGreaterThan(2);
    expect(result.asset.creative.carousel?.cover).toBeTruthy();
    expect(result.asset.creative.caption).toBeTruthy();
  });

  it("test 3: Story — frames + interaction + CTA", async () => {
    const item = blueprintItem({ format: "Story", objective: "Engagement" });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Story",
              topic: "New burger launch",
              objective: "Engagement",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: ["امروز چی می‌خوری؟"],
              primaryHook: "امروز چی می‌خوری؟",
              story: {
                frames: [
                  {
                    order: 1,
                    purpose: "Attention",
                    onScreenText: "همبرگر جدید",
                    visual: "Close-up",
                  },
                  {
                    order: 2,
                    purpose: "Context",
                    onScreenText: "تازه از آشپزخانه",
                    visual: "Kitchen",
                  },
                  {
                    order: 3,
                    purpose: "Value",
                    onScreenText: "مواد تازه",
                    visual: "Ingredients",
                  },
                  {
                    order: 4,
                    purpose: "Interaction",
                    onScreenText: "کدام را انتخاب می‌کنی؟",
                    interaction: "poll",
                  },
                  {
                    order: 5,
                    purpose: "CTA",
                    onScreenText: "لینک سفارش",
                    interaction: "link",
                  },
                ],
              },
              cta: "در استوری رأی بده",
              productionNotes: [],
            },
            quality: {
              strategicConsistency: "ok",
              brandConsistency: "ok",
              limitations: [],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "استوری بساز",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.asset.creative.story?.frames?.length).toBeGreaterThan(3);
    expect(
      result.asset.creative.story?.frames?.some((f) => f.interaction),
    ).toBe(true);
  });

  it("test 4: Static Post — copy + visual + CTA", async () => {
    const item = blueprintItem({
      format: "Static Post",
      objective: "Awareness",
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Static Post",
              topic: "New burger launch",
              objective: "Awareness",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: ["معرفی همبرگر جدید"],
              primaryHook: "معرفی همبرگر جدید",
              staticPost: {
                headline: "همبرگر جدید رسید",
                body: "طعم تازه، مواد انتخاب‌شده، آماده سرو.",
                visualDirection: "Centered product photo on warm backdrop",
              },
              caption: "همبرگر جدید را بشناسید.",
              cta: "پروفایل را برای جزئیات دنبال کنید",
              productionNotes: [],
            },
            quality: {
              strategicConsistency: "ok",
              brandConsistency: "ok",
              limitations: [],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "پست استاتیک بساز",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.asset.creative.staticPost?.headline).toBeTruthy();
    expect(result.asset.creative.staticPost?.visualDirection).toBeTruthy();
    expect(result.asset.creative.cta).toBeTruthy();
  });

  it("test 5: brand voice influences tone", async () => {
    db.brand.findFirst
      .mockResolvedValueOnce({ id: "brand_1" })
      .mockResolvedValueOnce({
        id: "brand_1",
        name: "Capital Fruit",
        slug: "capital-fruit",
        description: "luxury fruit",
        website: null,
        industry: "food",
        brandVoice: "warm playful Persian",
        targetAudience: "families",
      });

    const item = blueprintItem({ format: "Reel" });

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
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Reel",
              topic: "New burger launch",
              objective: "Sales",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: ["بیا یه لقمه بزنیم!"],
              primaryHook: "بیا یه لقمه بزنیم!",
              script: {
                scenes: [
                  {
                    order: 1,
                    visual: "Playful reveal",
                    voiceover: "سلام! امروز یه سورپرایز داریم.",
                  },
                ],
              },
              caption: "با لحن گرم و خودمونی براتون آوردیم.",
              cta: "بیا امتحان کن",
              productionNotes: [],
            },
            quality: {
              strategicConsistency: "ok",
              brandConsistency: "Adapted to warm playful Persian brand voice",
              limitations: [],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "با لحن برند بنویس",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.tool).toBe("brand.getContext");
    expect(result.asset.quality.brandConsistency).toMatch(/warm|playful|brand voice/i);
  });

  it("test 6: user override formal tone", async () => {
    const item = blueprintItem({ format: "Reel" });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Reel",
              topic: "New burger launch",
              objective: "Sales",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: ["معرفی محصول جدید"],
              primaryHook: "معرفی محصول جدید",
              script: {
                scenes: [
                  {
                    order: 1,
                    voiceover: "با افتخار محصول جدید را معرفی می‌کنیم.",
                  },
                ],
              },
              caption: "لطفاً جزئیات سفارش را در پیام مستقیم ارسال فرمایید.",
              cta: "برای اطلاعات بیشتر پیام دهید",
              productionNotes: ["User override: formal tone"],
            },
            quality: {
              strategicConsistency: "ok",
              brandConsistency: "Formal tone per user override",
              limitations: [],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "کپشن رسمی‌تر باشد.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.asset.creative.productionNotes.join(" ")).toMatch(/formal/i);
    expect(result.asset.quality.brandConsistency).toMatch(/Formal|رسمی|override/i);
  });

  it("test 7: Blueprint fidelity — does not change format/objective/topic", async () => {
    const item = blueprintItem({
      format: "Carousel",
      objective: "Education",
      topic: "3 mistakes restaurant owners make",
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Reel",
              topic: "Different topic",
              objective: "Sales",
              angle: "changed",
            },
            creative: {
              hooks: ["x"],
              primaryHook: "x",
              productionNotes: [],
            },
            quality: {
              strategicConsistency: "drifted",
              brandConsistency: "ok",
              limitations: [],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "اجرا کن",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.asset.content.format).toBe("Carousel");
    expect(result.asset.content.objective).toBe("Education");
    expect(result.asset.content.topic).toBe("3 mistakes restaurant owners make");
    expect(result.asset.quality.blueprintConcern || result.asset.quality.limitations.join(" ")).toMatch(
      /fidelity|drift|Blueprint/i,
    );
  });

  it("test 8: content pattern transferred without copying external wording", async () => {
    const item = blueprintItem({
      format: "Reel",
      angle: "Result-first product demonstration",
    });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Reel",
              topic: "New burger launch",
              objective: "Sales",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: ["اول محصول آماده را نشان بده"],
              primaryHook: "اول محصول آماده را نشان بده",
              script: {
                scenes: [
                  {
                    order: 1,
                    visual: "Finished product first",
                    voiceover: "نتیجه را از ابتدا ببینید.",
                    productionNote:
                      "Structural transfer of result-first — original creator wording not copied",
                  },
                ],
              },
              caption: "نتیجه را اول ببینید، بعد روش ساخت.",
              cta: "جزئیات را بپرسید",
              productionNotes: ["Pattern: result-first (structure only)"],
            },
            quality: {
              strategicConsistency: "ok",
              brandConsistency: "ok",
              limitations: [],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "با الگوی result-first بساز",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.asset.creative.productionNotes.join(" ")).toMatch(
      /result-first|structure/i,
    );
    expect(result.response).not.toMatch(/COPY_EXTERNAL_HOOK_EXACT_PHRASE_XYZ/);
  });

  it("test 9: missing data — no invented statistics/claims", async () => {
    const item = blueprintItem({ format: "Reel" });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Reel",
              topic: "New burger launch",
              objective: "Sales",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: ["همبرگر جدید"],
              primaryHook: "همبرگر جدید",
              script: {
                scenes: [
                  {
                    order: 1,
                    voiceover: "محصول جدید را معرفی می‌کنیم — بدون آمار ساختگی.",
                  },
                ],
              },
              caption: "جزئیات قیمت و تخفیف در Blueprint موجود نیست.",
              cta: "برای اطلاعات بیشتر پیام دهید",
              productionNotes: [],
            },
            quality: {
              strategicConsistency: "ok",
              brandConsistency: "ok",
              limitations: [
                "No invented prices, statistics, testimonials, or guarantees.",
              ],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "بدون ادعای ساختگی بنویس",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.asset.quality.limitations.join(" ")).toMatch(
      /No invented|statistics|prices/i,
    );
    expect(JSON.stringify(result.asset)).not.toMatch(
      /۹۸٪|guaranteed|certified award/i,
    );
  });

  it("test 10: no publishing", async () => {
    registry.registerTool(makePublishTool());
    const item = blueprintItem({ format: "Reel" });

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
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Reel",
              topic: "New burger launch",
              objective: "Sales",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: [],
              primaryHook: "",
              productionNotes: [],
            },
            quality: {
              strategicConsistency: "n/a",
              brandConsistency: "n/a",
              limitations: [
                "content.creator cannot publish or schedule. Assets only.",
              ],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "همین رو منتشر کن.",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.toolResults[0]?.success).toBe(false);
    expect(result.toolResults[0]?.error?.code).toBe("PERMISSION_DENIED");
  });

  it("test 11: no ContentItem/Campaign/Task persistence", async () => {
    const item = blueprintItem({ format: "Reel" });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Reel",
              topic: "New burger launch",
              objective: "Sales",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: ["a", "b", "c"],
              primaryHook: "a",
              caption: "cap",
              cta: "cta",
              productionNotes: [],
            },
            quality: {
              strategicConsistency: "ok",
              brandConsistency: "ok",
              limitations: ["No ContentItem persisted."],
            },
          }),
        },
      ]),
    );

    await runContentCreatorAgent({
      message: "بساز",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(db.contentItem.create).not.toHaveBeenCalled();
    expect(db.campaign.create).not.toHaveBeenCalled();
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it("test 12: limited hook variants (default 3)", async () => {
    const item = blueprintItem({ format: "Reel" });

    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: assetJson({
            blueprintReference: "bp1",
            content: {
              channel: "INSTAGRAM",
              format: "Reel",
              topic: "New burger launch",
              objective: "Sales",
              angle: "Result-first product demonstration",
            },
            creative: {
              hooks: ["h1", "h2", "h3"],
              primaryHook: "h1",
              ctaVariants: ["c1", "c2"],
              productionNotes: [],
            },
            quality: {
              strategicConsistency: "ok",
              brandConsistency: "ok",
              limitations: [],
            },
          }),
        },
      ]),
    );

    const result = await runContentCreatorAgent({
      message: "هوک‌ها را بساز",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      blueprintItem: item,
      toolRegistry: registry,
      store: createMemoryAgentRuntimeStore(),
    });

    expect(result.asset.creative.hooks).toHaveLength(3);
    expect(result.asset.creative.hooks.length).toBeLessThan(10);
  });

  it("enforceBlueprintFidelity restores strategic fields", () => {
    const item = blueprintItem({ format: "Carousel", objective: "Education" });
    const restored = enforceBlueprintFidelity(
      {
        blueprintReference: "bp1",
        content: {
          channel: "TIKTOK",
          format: "Reel",
          topic: "other",
          objective: "Sales",
          angle: "x",
        },
        creative: {
          hooks: [],
          primaryHook: "",
          ctaVariants: [],
          hashtags: [],
          productionNotes: [],
        },
        quality: {
          strategicConsistency: "",
          brandConsistency: "",
          limitations: [],
        },
      },
      item,
    );
    expect(restored.content.format).toBe("Carousel");
    expect(restored.content.objective).toBe("Education");
    expect(restored.quality.limitations.length).toBeGreaterThan(0);
  });

  it("parseContentAsset rejects non-JSON without fabricating", () => {
    const parsed = parseContentAsset("prose", "q");
    expect(parsed.creative.hooks).toEqual([]);
    expect(parsed.quality.limitations.join(" ")).toMatch(/No fabricated|persisted/i);
  });

  it("requires authenticated scope", async () => {
    await expect(
      runContentCreatorAgent({
        message: "hi",
        userId: "",
        workspaceId: "ws_1",
        brandId: "brand_1",
        blueprintItem: blueprintItem({ format: "Reel" }),
        toolRegistry: registry,
        store: createMemoryAgentRuntimeStore(),
      }),
    ).rejects.toMatchObject({ code: "SCOPE_VIOLATION" });
  });
});
