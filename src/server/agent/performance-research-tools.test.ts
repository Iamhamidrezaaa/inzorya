import { beforeEach, describe, expect, it, vi } from "vitest";
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
  resetResearchProviders,
  setCrawlProvider,
  setWebSearchProvider,
} from "@/server/research";

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findFirst: vi.fn() },
    analyticsSnapshot: { findFirst: vi.fn() },
    contentItem: { findMany: vi.fn() },
    contentMetric: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    socialPublication: { findMany: vi.fn() },
    marketingStrategy: { findUnique: vi.fn() },
    businessProfile: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  brand: { findFirst: ReturnType<typeof vi.fn> };
  analyticsSnapshot: { findFirst: ReturnType<typeof vi.fn> };
  contentItem: { findMany: ReturnType<typeof vi.fn> };
  contentMetric: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  socialPublication: { findMany: ReturnType<typeof vi.fn> };
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

const PERF_RESEARCH_IDS = [
  "analytics.getPerformance",
  "analytics.getTopContent",
  "analytics.compareContentTypes",
  "analytics.getPublishingPatterns",
  "research.searchWeb",
  "research.crawlUrl",
  "research.searchCompetitors",
  "research.findTrendingTopics",
] as const;

describe("EPIC AGENT-003 — performance + research tools", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentBootstrap();
    resetResearchProviders();
    // Keep EPIC-003 analytics tests offline from live research providers.
    setWebSearchProvider({
      id: "offline",
      isConfigured: () => false,
      search: async () => [],
    });
    setCrawlProvider({
      id: "offline",
      isConfigured: () => false,
      crawl: async ({ url }) => ({
        url,
        title: null,
        content: null,
        metadata: null,
        source: "offline",
      }),
    });
    registry = bootstrapAgentTools(new ToolRegistry());
    db.brand.findFirst.mockResolvedValue({ id: "brand_1" });
    db.analyticsSnapshot.findFirst.mockResolvedValue(null);
    db.contentItem.findMany.mockResolvedValue([]);
    db.contentMetric.count.mockResolvedValue(0);
    db.contentMetric.findFirst.mockResolvedValue(null);
    db.socialPublication.findMany.mockResolvedValue([]);
  });

  it("registers eight tools with READ permission", () => {
    for (const id of PERF_RESEARCH_IDS) {
      expect(registry.hasTool(id)).toBe(true);
      expect(registry.getTool(id)?.permission).toBe("READ");
    }
  });

  describe("analytics.getPerformance", () => {
    it("returns unavailable when social analytics not connected", async () => {
      const result = await executeTool(registry, {
        toolId: "analytics.getPerformance",
        input: { channel: "INSTAGRAM" },
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        available: false,
        reason: "SOCIAL_ANALYTICS_NOT_CONNECTED",
      });
    });

    it("returns real metrics when linked ContentMetric exists", async () => {
      db.analyticsSnapshot.findFirst.mockResolvedValue(null);
      db.contentItem.findMany.mockResolvedValue([{ id: "c1" }]);
      db.contentMetric.count.mockResolvedValue(1);
      db.contentMetric.findMany.mockResolvedValue([
        {
          externalId: "c1",
          title: "Reel A",
          platform: "INSTAGRAM",
          contentType: "REEL",
          publishedAt: new Date("2026-01-01"),
          reach: 100,
          impressions: 200,
          likes: 10,
          comments: 2,
          shares: 1,
          saves: 3,
          engagement: 16,
          ctr: 0.1,
        },
      ]);

      const result = await executeTool(registry, {
        toolId: "analytics.getPerformance",
        input: { channel: "INSTAGRAM", limit: 5 },
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        available: true,
        metrics: { contentCount: 1, engagement: 16 },
        content: [{ id: "c1", title: "Reel A" }],
      });
    });

    it("rejects unauthorized brand scope", async () => {
      const result = await executeTool(registry, {
        toolId: "analytics.getPerformance",
        input: { brandId: "other" },
        context: ctx(),
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });
  });

  describe("analytics.getTopContent", () => {
    it("unavailable without metrics", async () => {
      const result = await executeTool(registry, {
        toolId: "analytics.getTopContent",
        input: {},
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: false,
        reason: "SOCIAL_ANALYTICS_NOT_CONNECTED",
      });
    });

    it("ranks by engagement_then_reach when data exists", async () => {
      db.contentItem.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
      db.contentMetric.count.mockResolvedValue(2);
      db.contentMetric.findMany.mockResolvedValue([
        {
          externalId: "c2",
          title: "Best",
          platform: "INSTAGRAM",
          contentType: "REEL",
          publishedAt: new Date("2026-02-01"),
          engagement: 50,
          reach: 500,
          impressions: 600,
          likes: 40,
          comments: 5,
          shares: 3,
          saves: 2,
        },
      ]);

      const result = await executeTool(registry, {
        toolId: "analytics.getTopContent",
        input: { limit: 5 },
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: true,
        rankingBasis: "engagement_then_reach",
        items: [{ id: "c2", title: "Best" }],
      });
    });

    it("scope protection", async () => {
      const result = await executeTool(registry, {
        toolId: "analytics.getTopContent",
        input: { brandId: "x" },
        context: ctx(),
      });
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });
  });

  describe("analytics.compareContentTypes", () => {
    it("insufficient data when unavailable", async () => {
      const result = await executeTool(registry, {
        toolId: "analytics.compareContentTypes",
        input: {},
        context: ctx(),
      });
      expect(result.data).toMatchObject({ available: false });
    });

    it("compares types from stored metrics", async () => {
      db.contentItem.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
      db.contentMetric.count.mockResolvedValue(2);
      db.contentMetric.findMany.mockResolvedValue([
        {
          contentType: "REEL",
          reach: 10,
          impressions: 20,
          likes: 1,
          comments: 0,
          shares: 0,
          saves: 0,
          engagement: 5,
        },
        {
          contentType: "POST",
          reach: 5,
          impressions: 10,
          likes: 1,
          comments: 0,
          shares: 0,
          saves: 0,
          engagement: 2,
        },
      ]);

      const result = await executeTool(registry, {
        toolId: "analytics.compareContentTypes",
        input: {},
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: true,
        comparisonBasis: "sum_and_avg_of_stored_content_metrics",
      });
      const types = (result.data as { contentTypes: { type: string }[] })
        .contentTypes;
      expect(types.map((t) => t.type).sort()).toEqual(["POST", "REEL"]);
    });

    it("scope protection", async () => {
      const result = await executeTool(registry, {
        toolId: "analytics.compareContentTypes",
        input: { brandId: "nope" },
        context: ctx(),
      });
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });
  });

  describe("analytics.getPublishingPatterns", () => {
    it("returns historical publishing patterns without performance claims", async () => {
      db.contentItem.findMany.mockResolvedValue([
        {
          platform: "INSTAGRAM",
          format: "INSTAGRAM_REEL",
          publishedAt: new Date("2026-01-05T15:00:00Z"),
          scheduledAt: null,
        },
        {
          platform: "INSTAGRAM",
          format: "INSTAGRAM_POST",
          publishedAt: new Date("2026-01-06T15:00:00Z"),
          scheduledAt: null,
        },
      ]);

      const result = await executeTool(registry, {
        toolId: "analytics.getPublishingPatterns",
        input: { from: "2026-01-01", to: "2026-01-31" },
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        available: true,
        patternKind: "publishing_history",
      });
      const note = (result.data as { note: string }).note;
      expect(note.toLowerCase()).not.toContain("best time");
    });

    it("empty history", async () => {
      db.contentItem.findMany.mockResolvedValue([]);
      const result = await executeTool(registry, {
        toolId: "analytics.getPublishingPatterns",
        input: {},
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: false,
        reason: "NO_PUBLISHING_HISTORY",
      });
    });
  });

  describe("research.searchWeb", () => {
    it("validates query and returns provider unavailable", async () => {
      const bad = await executeTool(registry, {
        toolId: "research.searchWeb",
        input: {},
        context: ctx(),
      });
      expect(bad.success).toBe(false);
      expect(bad.error?.code).toBe("INVALID_INPUT");

      const ok = await executeTool(registry, {
        toolId: "research.searchWeb",
        input: { query: "luxury fruit marketing" },
        context: ctx(),
      });
      expect(ok.success).toBe(true);
      expect(ok.data).toMatchObject({
        available: false,
        reason: "WEB_SEARCH_PROVIDER_NOT_CONFIGURED",
        query: "luxury fruit marketing",
        results: [],
      });
    });
  });

  describe("research.crawlUrl", () => {
    it("rejects invalid URL", async () => {
      const result = await executeTool(registry, {
        toolId: "research.crawlUrl",
        input: { url: "not-a-url" },
        context: ctx(),
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_INPUT");
    });

    it("returns crawl provider unavailable for valid URL", async () => {
      const result = await executeTool(registry, {
        toolId: "research.crawlUrl",
        input: { url: "https://example.com/page" },
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        available: false,
        reason: "CRAWL_PROVIDER_NOT_CONFIGURED",
        url: "https://example.com/page",
      });
    });
  });

  describe("research.searchCompetitors", () => {
    it("returns stored competitors without inventing web findings", async () => {
      db.marketingStrategy.findUnique.mockResolvedValue({
        competitors: [
          {
            name: "Rival Fruits",
            website: "https://rival.example",
            instagram: "@rival",
            notes: "local",
          },
        ],
      });
      db.businessProfile.findUnique.mockResolvedValue({
        competitors: null,
        industry: null,
        businessSummary: null,
      });

      const result = await executeTool(registry, {
        toolId: "research.searchCompetitors",
        input: {},
        context: ctx(),
      });
      expect(result.data).toMatchObject({
        available: true,
        webResearch: { available: false },
        competitors: [
          {
            name: "Rival Fruits",
            stored: true,
            informationSource: "stored",
            findings: [],
            webFindings: [],
          },
        ],
      });
    });

    it("no competitors and no provider", async () => {
      db.marketingStrategy.findUnique.mockResolvedValue({ competitors: [] });
      db.businessProfile.findUnique.mockResolvedValue({
        competitors: null,
        industry: null,
        businessSummary: null,
      });
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

    it("scope protection", async () => {
      const result = await executeTool(registry, {
        toolId: "research.searchCompetitors",
        input: { brandId: "x" },
        context: ctx(),
      });
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });
  });

  describe("research.findTrendingTopics", () => {
    it("valid topic returns unavailable without fabricated scores", async () => {
      const result = await executeTool(registry, {
        toolId: "research.findTrendingTopics",
        input: { topic: "exotic fruit" },
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        available: false,
        topic: "exotic fruit",
        signalKind: "none",
        signals: [],
      });
      expect(JSON.stringify(result.data)).not.toMatch(/viralScore|trendScore/i);
    });

    it("requires topic", async () => {
      const result = await executeTool(registry, {
        toolId: "research.findTrendingTopics",
        input: {},
        context: ctx(),
      });
      expect(result.error?.code).toBe("INVALID_INPUT");
    });
  });

  it("logs tool execution via agent runtime", async () => {
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
    expect(logs[0]?.status).toBe("COMPLETED");
  });
});
