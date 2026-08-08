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

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findFirst: vi.fn() },
    businessProfile: { findUnique: vi.fn() },
    businessBrain: { findFirst: vi.fn() },
    marketingStrategy: { findUnique: vi.fn() },
    contentItem: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/server/services/calendar", () => ({
  searchCalendarEvents: vi.fn(),
}));

vi.mock("@/server/services/opportunity-matching", () => ({
  getMatchingDashboard: vi.fn(),
}));

vi.mock("@/server/services/knowledge-graph", () => ({
  searchKnowledgeNodes: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { searchCalendarEvents } from "@/server/services/calendar";
import { getMatchingDashboard } from "@/server/services/opportunity-matching";
import { searchKnowledgeNodes } from "@/server/services/knowledge-graph";

const mockedPrisma = prisma as unknown as {
  brand: { findFirst: ReturnType<typeof vi.fn> };
  businessProfile: { findUnique: ReturnType<typeof vi.fn> };
  businessBrain: { findFirst: ReturnType<typeof vi.fn> };
  marketingStrategy: { findUnique: ReturnType<typeof vi.fn> };
  contentItem: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
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

describe("EPIC AGENT-002 — read-only marketing tools", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentBootstrap();
    registry = bootstrapAgentTools(new ToolRegistry());
    mockedPrisma.brand.findFirst.mockResolvedValue({ id: "brand_1" });
  });

  it("registers all six tools with READ permission", () => {
    const ids = [
      "brand.getContext",
      "brand.getStrategy",
      "content.getHistory",
      "calendar.getEvents",
      "opportunity.getRelevant",
      "knowledge.search",
    ];
    for (const id of ids) {
      expect(registry.hasTool(id)).toBe(true);
      expect(registry.getTool(id)?.permission).toBe("READ");
    }
  });

  describe("brand.getContext", () => {
    it("returns structured context for a valid brand", async () => {
      mockedPrisma.brand.findFirst
        .mockResolvedValueOnce({ id: "brand_1" })
        .mockResolvedValueOnce({
          id: "brand_1",
          name: "Acme",
          slug: "acme",
          description: "desc",
          website: null,
          industry: "retail",
          brandVoice: "friendly",
          targetAudience: "shoppers",
        });
      mockedPrisma.businessProfile.findUnique.mockResolvedValue({
        businessSummary: "We sell things",
        industry: "retail",
        website: null,
        country: "IR",
        languages: ["fa"],
        mainProducts: "goods",
        businessGoals: "grow sales",
        targetAudience: "families",
        preferredPlatforms: ["INSTAGRAM"],
        preferredTone: "warm",
        mainCta: "Shop now",
      });
      mockedPrisma.businessBrain.findFirst.mockResolvedValue({
        score: 40,
        completionPercent: 50,
        version: 2,
        answers: [
          { value: "retail", question: { key: "industry" } },
        ],
        voice: {
          toneOfVoice: "warm",
          traits: ["clear"],
          writingStyle: null,
          emojiUsage: null,
          ctaStyle: null,
          preferredWords: [],
          forbiddenWords: [],
          deletedAt: null,
        },
      });

      const result = await executeTool(registry, {
        toolId: "brand.getContext",
        input: {},
        context: ctx(),
      });

      expect(result.success).toBe(true);
      expect(result.tool).toBe("brand.getContext");
      expect(result.data).toMatchObject({
        brand: { name: "Acme", industry: "retail" },
        business: { country: "IR" },
        objectives: ["grow sales"],
        brain: { completionPercent: 50 },
      });
    });

    it("rejects unauthorized brandId", async () => {
      const result = await executeTool(registry, {
        toolId: "brand.getContext",
        input: { brandId: "other_brand" },
        context: ctx(),
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });

    it("fails when brand missing from workspace", async () => {
      mockedPrisma.brand.findFirst.mockResolvedValue(null);
      const result = await executeTool(registry, {
        toolId: "brand.getContext",
        input: {},
        context: ctx(),
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });
  });

  describe("brand.getStrategy", () => {
    it("returns strategy when it exists", async () => {
      mockedPrisma.marketingStrategy.findUnique.mockResolvedValue({
        id: "strat_1",
        goals: ["increase_sales"],
        postingFrequency: "daily",
        preferredPlatforms: ["INSTAGRAM"],
        contentTypes: ["REELS"],
        tone: "friendly",
        contentLength: "short",
        ctaStyle: "soft",
        currentStage: "planning",
        nextStep: "publish",
        personas: [],
        competitors: [],
        pillars: [{ id: "p1", name: "Education", description: null }],
        roadmapTasks: [],
      });

      const result = await executeTool(registry, {
        toolId: "brand.getStrategy",
        input: {},
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        exists: true,
        strategy: { id: "strat_1", goals: ["increase_sales"] },
      });
    });

    it("returns empty structured result when strategy missing", async () => {
      mockedPrisma.marketingStrategy.findUnique.mockResolvedValue(null);
      const result = await executeTool(registry, {
        toolId: "brand.getStrategy",
        input: {},
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ exists: false, strategy: null });
    });

    it("rejects unauthorized brand", async () => {
      const result = await executeTool(registry, {
        toolId: "brand.getStrategy",
        input: { brandId: "nope" },
        context: ctx(),
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });
  });

  describe("content.getHistory", () => {
    it("returns existing content with filters and limit", async () => {
      mockedPrisma.contentItem.count.mockResolvedValue(2);
      mockedPrisma.contentItem.findMany.mockResolvedValue([
        {
          id: "c1",
          title: "Post A",
          body: "hello",
          status: "PUBLISHED",
          platform: "INSTAGRAM",
          format: "INSTAGRAM_REEL",
          scheduledAt: null,
          publishedAt: new Date("2026-01-01"),
          campaign: { id: "camp1", name: "Launch" },
          pillar: null,
        },
      ]);

      const result = await executeTool(registry, {
        toolId: "content.getHistory",
        input: { limit: 1, channel: "INSTAGRAM" },
        context: ctx(),
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        limit: 1,
        total: 2,
        items: [{ id: "c1", channel: "INSTAGRAM", caption: "hello" }],
      });
      expect(mockedPrisma.contentItem.findMany).toHaveBeenCalled();
      const arg = mockedPrisma.contentItem.findMany.mock.calls[0]?.[0];
      expect(arg.where.platform).toBe("INSTAGRAM");
      expect(arg.take).toBe(1);
    });

    it("rejects unauthorized brand", async () => {
      const result = await executeTool(registry, {
        toolId: "content.getHistory",
        input: { brandId: "x" },
        context: ctx(),
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });
  });

  describe("calendar.getEvents", () => {
    it("filters by date/category and respects limit", async () => {
      vi.mocked(searchCalendarEvents).mockResolvedValue({
        total: 1,
        offset: 0,
        limit: 10,
        events: [
          {
            id: "e1",
            key: "nowruz",
            name: "Nowruz",
            title: "Nowruz",
            nextDate: "2026-03-21",
            countries: ["IR"],
            industries: ["retail"],
            tags: ["holiday"],
            preparationDays: 14,
            verificationStatus: "VERIFIED",
            importance: "HIGH",
            source: "seed",
            marketingCategory: { key: "cultural" },
            category: null,
            region: { key: "mena" },
            sourceRef: { key: "internal" },
          },
        ],
      } as never);

      const result = await executeTool(registry, {
        toolId: "calendar.getEvents",
        input: {
          from: "2026-01-01",
          to: "2026-12-31",
          category: "cultural",
          limit: 10,
        },
        context: ctx(),
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        events: [{ id: "e1", name: "Nowruz", category: "cultural" }],
      });
      expect(searchCalendarEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "cultural",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        }),
      );
    });

    it("returns empty events list", async () => {
      vi.mocked(searchCalendarEvents).mockResolvedValue({
        total: 0,
        offset: 0,
        limit: 40,
        events: [],
      });
      const result = await executeTool(registry, {
        toolId: "calendar.getEvents",
        input: {},
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ total: 0, events: [] });
    });
  });

  describe("opportunity.getRelevant", () => {
    it("returns existing opportunities with horizon and score filters", async () => {
      const today = new Date();
      const in10 = new Date(today);
      in10.setUTCDate(in10.getUTCDate() + 10);
      const in200 = new Date(today);
      in200.setUTCDate(in200.getUTCDate() + 200);

      vi.mocked(getMatchingDashboard).mockResolvedValue({
        upcoming: [
          {
            id: "opp_high",
            title: "High opp",
            status: "NEW",
            scoreLevel: "high",
            confidence: 80,
            whyMatched: "industry",
            matchReason: "industry",
            summary: "summary",
            eventDate: in10,
            rulesMatched: ["industry"],
            rulesFailed: [],
            missingInfo: [],
            planningStart: null,
            contentDeadline: null,
            designDeadline: null,
            approvalDeadline: null,
            publishingStart: null,
            publishingEnd: null,
            score: { overall: 75, confidence: 80, explanation: "good fit" },
            evidence: [
              {
                ruleKey: "industry",
                passed: true,
                detail: "match",
                weight: 1,
                contribution: 10,
              },
            ],
            event: { id: "ev1", key: "k", name: "Event" },
          },
          {
            id: "opp_far",
            title: "Far",
            status: "NEW",
            scoreLevel: "medium",
            confidence: 60,
            whyMatched: null,
            matchReason: "x",
            summary: "x",
            eventDate: in200,
            rulesMatched: [],
            rulesFailed: [],
            missingInfo: [],
            planningStart: null,
            contentDeadline: null,
            designDeadline: null,
            approvalDeadline: null,
            publishingStart: null,
            publishingEnd: null,
            score: { overall: 40, confidence: 60, explanation: "far" },
            evidence: [],
            event: { id: "ev2", key: "k2", name: "Far Event" },
          },
        ],
      } as never);

      const result = await executeTool(registry, {
        toolId: "opportunity.getRelevant",
        input: { horizonDays: 30, minScore: 50, limit: 10 },
        context: ctx(),
      });

      expect(result.success).toBe(true);
      const data = result.data as {
        opportunities: { id: string; score: number }[];
        horizonDays: number;
      };
      expect(data.horizonDays).toBe(30);
      expect(data.opportunities).toHaveLength(1);
      expect(data.opportunities[0]?.id).toBe("opp_high");
      expect(data.opportunities[0]?.score).toBe(75);
    });

    it("is deterministic for same dashboard input", async () => {
      vi.mocked(getMatchingDashboard).mockResolvedValue({
        upcoming: [],
      } as never);
      const a = await executeTool(registry, {
        toolId: "opportunity.getRelevant",
        input: {},
        context: ctx(),
      });
      const b = await executeTool(registry, {
        toolId: "opportunity.getRelevant",
        input: {},
        context: ctx(),
      });
      expect(a.data).toEqual(b.data);
    });
  });

  describe("knowledge.search", () => {
    it("searches by keyword and kind", async () => {
      vi.mocked(searchKnowledgeNodes).mockResolvedValue([
        {
          id: "n1",
          key: "retail",
          kind: "INDUSTRY",
          name: "Retail",
          description: "Retail industry",
          parent: null,
          _count: { fromRels: 1, toRels: 2, eventLinks: 0 },
        },
      ] as never);

      const result = await executeTool(registry, {
        toolId: "knowledge.search",
        input: { query: "retail", kind: "INDUSTRY", limit: 5 },
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        nodes: [{ id: "n1", kind: "INDUSTRY", name: "Retail" }],
      });
      expect(searchKnowledgeNodes).toHaveBeenCalledWith({
        q: "retail",
        kind: "INDUSTRY",
        limit: 5,
      });
    });

    it("returns empty nodes", async () => {
      vi.mocked(searchKnowledgeNodes).mockResolvedValue([]);
      const result = await executeTool(registry, {
        toolId: "knowledge.search",
        input: { query: "zzz-none" },
        context: ctx(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ nodes: [], total: 0 });
    });

    it("requires workspace/brand scope on context", async () => {
      const result = await executeTool(registry, {
        toolId: "knowledge.search",
        input: {},
        context: ctx({ brandId: "" }),
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("SCOPE_VIOLATION");
    });
  });

  it("logs tool executions through agent runtime", async () => {
    mockedPrisma.brand.findFirst.mockResolvedValue({ id: "brand_1" });
    mockedPrisma.businessProfile.findUnique.mockResolvedValue(null);
    mockedPrisma.businessBrain.findFirst.mockResolvedValue(null);
    mockedPrisma.brand.findFirst
      .mockResolvedValueOnce({ id: "brand_1" })
      .mockResolvedValueOnce({
        id: "brand_1",
        name: "Acme",
        slug: "acme",
        description: null,
        website: null,
        industry: null,
        brandVoice: null,
        targetAudience: null,
      });

    const store = createMemoryAgentRuntimeStore();
    const outcome = await runAgentExecution({
      agentId: "system.test",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      input: {
        toolCalls: [{ toolId: "brand.getContext", input: {} }],
      },
      toolRegistry: registry,
      store,
    });

    expect(outcome.status).toBe("COMPLETED");
    const logs = store.toolExecutions.get(outcome.executionId) ?? [];
    expect(logs[0]?.toolId).toBe("brand.getContext");
    expect(logs[0]?.status).toBe("COMPLETED");
  });

  it("rejects WRITE-only permission for READ tools", async () => {
    // READ tools require READ in allowedPermissions
    const result = await executeTool(registry, {
      toolId: "calendar.getEvents",
      input: {},
      context: ctx({ allowedPermissions: ["WRITE"] }),
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("PERMISSION_DENIED");
  });
});
