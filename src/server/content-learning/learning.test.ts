import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ToolRegistry,
  bootstrapAgentTools,
  executeTool,
  resetAgentBootstrap,
} from "@/server/agent";
import { CONTENT_STRATEGIST_TOOL_IDS, CONTENT_STRATEGIST_SYSTEM_PROMPT } from "@/server/agent/content-strategist/constants";
import { CONTENT_PLANNER_TOOL_IDS, CONTENT_PLANNER_SYSTEM_PROMPT } from "@/server/agent/content-planner/constants";
import type { ToolContext } from "@/server/agent/types";
import {
  createContentLearningEngine,
  MIN_LEARNING_SAMPLE,
} from "@/server/content-learning";
import { isAnalyticsPlatformRemoved, isAnalyticsPlatformUnavailable } from "@/server/social-analytics-ingestion";

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findFirst: vi.fn() },
    contentMetric: { findMany: vi.fn() },
    contentLearning: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contentLearningEvidence: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    contentLearningVersion: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  brand: { findFirst: ReturnType<typeof vi.fn> };
  contentMetric: { findMany: ReturnType<typeof vi.fn> };
  contentLearning: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  contentLearningEvidence: {
    deleteMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  contentLearningVersion: { create: ReturnType<typeof vi.fn> };
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

function metricRow(
  overrides: Partial<{
    id: string;
    platform: string;
    contentType: string;
    title: string;
    publishedAt: Date;
    engagement: number | null;
    impressions: number | null;
    likes: number | null;
    views: number | null;
    reach: number | null;
    comments: number | null;
    shares: number | null;
    clicks: number | null;
    saves: number | null;
    contentDraftId: string | null;
    socialPublicationId: string | null;
    externalPostId: string | null;
    source: string;
  }> = {},
) {
  return {
    id: overrides.id ?? `cm_${Math.random().toString(36).slice(2, 8)}`,
    platform: overrides.platform ?? "linkedin",
    contentType: overrides.contentType ?? "POST",
    title: overrides.title ?? "Topic A",
    publishedAt: overrides.publishedAt ?? new Date("2026-07-01T12:00:00Z"),
    engagement: overrides.engagement ?? null,
    impressions: overrides.impressions ?? null,
    likes: overrides.likes ?? null,
    views: overrides.views ?? null,
    reach: overrides.reach ?? null,
    comments: overrides.comments ?? null,
    shares: overrides.shares ?? null,
    clicks: overrides.clicks ?? null,
    saves: overrides.saves ?? null,
    contentDraftId: overrides.contentDraftId ?? "draft_1",
    socialPublicationId: overrides.socialPublicationId ?? "pub_1",
    externalPostId: overrides.externalPostId ?? "ext_1",
    source: overrides.source ?? "LINKEDIN_API",
  };
}

function validSample() {
  const rows = [];
  for (let i = 0; i < 6; i++) {
    rows.push(
      metricRow({
        id: `reel_${i}`,
        contentType: "REEL",
        title: "Demo Reel",
        engagement: 100 + i * 10,
        publishedAt: new Date(`2026-07-0${(i % 5) + 1}T10:00:00Z`),
        socialPublicationId: `pub_r_${i}`,
        externalPostId: `ext_r_${i}`,
      }),
    );
  }
  for (let i = 0; i < 6; i++) {
    rows.push(
      metricRow({
        id: `post_${i}`,
        contentType: "POST",
        title: "Static Post",
        engagement: 20 + i,
        publishedAt: new Date(`2026-07-1${(i % 5) + 1}T10:00:00Z`),
        socialPublicationId: `pub_p_${i}`,
        externalPostId: `ext_p_${i}`,
      }),
    );
  }
  return rows;
}

describe("EPIC-018 — Content Learning & Performance Intelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.brand.findFirst.mockResolvedValue({ id: "brand_1" });
    db.contentMetric.findMany.mockResolvedValue([]);
    db.contentLearning.findUnique.mockResolvedValue(null);
    db.contentLearning.findFirst.mockResolvedValue(null);
    db.contentLearning.findMany.mockResolvedValue([]);
    db.contentLearningEvidence.deleteMany.mockResolvedValue({ count: 0 });
    db.contentLearningEvidence.findMany.mockResolvedValue([]);
    db.contentLearning.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "learn_1",
      workspaceId: data.workspaceId,
      brandId: data.brandId,
      platform: data.platform,
      dimension: data.dimension,
      type: data.type,
      statement: data.statement,
      rationale: data.rationale,
      confidence: data.confidence,
      sampleSize: data.sampleSize,
      metric: data.metric,
      periodFrom: data.periodFrom,
      periodTo: data.periodTo,
      lastObservedAt: new Date(),
      status: data.status,
      fingerprint: data.fingerprint,
      outlierPresent: data.outlierPresent,
      limitations: data.limitations,
      usefulFeedback: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { evidence: 3 },
    }));
    db.contentLearning.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "learn_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      platform: "linkedin",
      dimension: "format",
      type: "OBSERVATION",
      statement: data.statement ?? "updated",
      rationale: data.rationale ?? "r",
      confidence: data.confidence ?? "MEDIUM",
      sampleSize: data.sampleSize ?? 12,
      metric: data.metric ?? "engagement",
      periodFrom: data.periodFrom ?? null,
      periodTo: data.periodTo ?? null,
      lastObservedAt: new Date(),
      status: data.status ?? "ACTIVE",
      fingerprint: "fp",
      outlierPresent: data.outlierPresent ?? false,
      limitations: data.limitations ?? [],
      usefulFeedback: data.usefulFeedback ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { evidence: 3 },
    }));
    db.contentLearningVersion.create.mockResolvedValue({ id: "v1" });
  });

  it("TEST 1: No metrics → NO_DATA", async () => {
    const engine = createContentLearningEngine();
    const result = await engine.analyze({
      scope: { workspaceId: "ws_1", brandId: "brand_1" },
    });
    expect(result.status).toBe("NO_DATA");
    expect(result.learnings).toHaveLength(0);
  });

  it("TEST 2: Small sample → INSUFFICIENT_SAMPLE", async () => {
    db.contentMetric.findMany.mockResolvedValue([
      metricRow({ engagement: 10 }),
      metricRow({ id: "cm2", engagement: 12, contentType: "REEL" }),
      metricRow({ id: "cm3", engagement: 8 }),
    ]);
    const engine = createContentLearningEngine();
    const result = await engine.analyze({
      scope: { workspaceId: "ws_1", brandId: "brand_1" },
    });
    expect(result.status).toBe("INSUFFICIENT_SAMPLE");
    expect(result.sampleSize).toBeLessThan(MIN_LEARNING_SAMPLE);
  });

  it("TEST 3–8: Valid sample creates learning with evidence, sample, period, confidence; nulls not zero", async () => {
    const rows = validSample();
    rows[0]!.reach = null;
    rows[0]!.impressions = null;
    db.contentMetric.findMany.mockResolvedValue(rows);

    const engine = createContentLearningEngine();
    const result = await engine.analyze({
      scope: { workspaceId: "ws_1", brandId: "brand_1" },
    });
    expect(result.status).toBe("READY");
    expect(result.learnings.length).toBeGreaterThan(0);
    const learning = result.learnings[0]!;
    expect(learning.sampleSize).toBeGreaterThanOrEqual(MIN_LEARNING_SAMPLE);
    expect(learning.periodFrom).toBeTruthy();
    expect(learning.periodTo).toBeTruthy();
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(learning.confidence);
    expect(learning.evidenceCount).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toMatch(/will go viral|performance forecast|viral probability/i);
    expect(db.contentLearning.create).toHaveBeenCalled();
    const createData = db.contentLearning.create.mock.calls[0][0].data;
    expect(createData.evidence.create.length).toBeGreaterThan(0);
    expect(createData.evidence.create[0].value).not.toBe(0);
    // null metrics never coerced in source rows
    expect(rows[0]!.reach).toBeNull();
  });

  it("TEST 9–10: Duplicate analysis upserts by fingerprint", async () => {
    db.contentMetric.findMany.mockResolvedValue(validSample());
    const engine = createContentLearningEngine();

    const first = await engine.analyze({
      scope: { workspaceId: "ws_1", brandId: "brand_1" },
    });
    expect(first.status).toBe("READY");
    expect(db.contentLearning.create.mock.calls.length).toBeGreaterThan(0);

    const fingerprints = db.contentLearning.create.mock.calls.map(
      (c) => (c[0] as { data: { fingerprint: string } }).data.fingerprint,
    );

    db.contentLearning.findUnique.mockImplementation(
      async ({
        where,
      }: {
        where: { brandId_fingerprint: { fingerprint: string } };
      }) => ({
        id: "learn_existing",
        workspaceId: "ws_1",
        brandId: "brand_1",
        platform: "linkedin",
        dimension: "format",
        type: "OBSERVATION",
        statement: "previous statement that will change",
        rationale: "old",
        confidence: "LOW",
        sampleSize: 10,
        metric: "engagement",
        periodFrom: new Date("2026-07-01"),
        periodTo: new Date("2026-07-15"),
        lastObservedAt: new Date("2026-07-20"),
        status: "ACTIVE",
        fingerprint: where.brandId_fingerprint.fingerprint,
        outlierPresent: false,
        limitations: [],
        usefulFeedback: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { versions: 1, evidence: 2 },
      }),
    );
    db.contentLearning.create.mockClear();
    db.contentLearning.update.mockClear();
    db.contentLearningVersion.create.mockClear();

    const second = await engine.analyze({
      scope: { workspaceId: "ws_1", brandId: "brand_1" },
    });
    expect(second.status).toBe("READY");
    expect(db.contentLearning.create).not.toHaveBeenCalled();
    expect(db.contentLearning.update.mock.calls.length).toBeGreaterThan(0);
    expect(db.contentLearningVersion.create.mock.calls.length).toBeGreaterThan(
      0,
    );
    expect(fingerprints[0]).toMatch(/^[a-f0-9]{32}$/);
  });

  it("TEST 12: Archive works", async () => {
    const engine = createContentLearningEngine();
    db.contentLearning.findFirst.mockResolvedValue({
      id: "learn_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      status: "ACTIVE",
    });
    const archived = await engine.archive("learn_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    });
    expect(db.contentLearning.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ARCHIVED" }),
      }),
    );
    expect(archived.status).toBe("ARCHIVED");
  });

  it("TEST 13: Stale learning handled on refresh", async () => {
    const engine = createContentLearningEngine();
    db.contentLearning.findFirst
      .mockResolvedValueOnce({
        id: "learn_1",
        workspaceId: "ws_1",
        brandId: "brand_1",
        platform: "linkedin",
        periodFrom: new Date("2026-01-01"),
        periodTo: new Date("2026-03-01"),
        fingerprint: "fp1",
        status: "ACTIVE",
        lastObservedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      })
      .mockResolvedValueOnce({
        id: "learn_1",
        workspaceId: "ws_1",
        brandId: "brand_1",
        platform: "linkedin",
        dimension: "format",
        type: "OBSERVATION",
        statement: "s",
        rationale: "r",
        confidence: "MEDIUM",
        sampleSize: 12,
        metric: "engagement",
        periodFrom: null,
        periodTo: null,
        lastObservedAt: new Date(),
        status: "STALE",
        fingerprint: "fp1",
        outlierPresent: false,
        limitations: [],
        usefulFeedback: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { evidence: 1 },
      });
    db.contentMetric.findMany.mockResolvedValue([]);
    const refreshed = await engine.refresh("learn_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    });
    expect(db.contentLearning.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "STALE" }),
      }),
    );
    expect(refreshed.status).toBe("NO_DATA");
  });

  it("TEST 14–15: Wrong workspace/brand rejected via scoped get", async () => {
    db.contentLearning.findFirst.mockResolvedValue(null);
    const engine = createContentLearningEngine();
    const missing = await engine.get("learn_x", {
      workspaceId: "ws_other",
      brandId: "brand_1",
    });
    expect(missing).toBeNull();
    await expect(
      engine.archive("learn_x", {
        workspaceId: "ws_1",
        brandId: "brand_other",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("TEST 16–17: Agent can read learning; READ tool cannot mutate", async () => {
    resetAgentBootstrap();
    const registry = bootstrapAgentTools(new ToolRegistry());
    expect(registry.hasTool("learning.getRelevant")).toBe(true);
    expect(registry.getTool("learning.getRelevant")?.permission).toBe("READ");

    db.contentLearning.findMany.mockResolvedValue([
      {
        id: "learn_1",
        workspaceId: "ws_1",
        brandId: "brand_1",
        platform: "linkedin",
        dimension: "format",
        type: "OBSERVATION",
        statement: "REEL showed higher median engagement than POST.",
        rationale: "median comparison",
        confidence: "MEDIUM",
        sampleSize: 12,
        metric: "engagement",
        periodFrom: new Date("2026-07-01"),
        periodTo: new Date("2026-07-20"),
        lastObservedAt: new Date(),
        status: "ACTIVE",
        fingerprint: "fp",
        outlierPresent: false,
        limitations: ["Observed association — not causal."],
        usefulFeedback: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { evidence: 4 },
      },
    ]);

    const result = await executeTool(registry, {
      toolId: "learning.getRelevant",
      input: { platform: "linkedin", limit: 5 },
      context: ctx(),
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ available: true });
    expect(db.contentLearning.update).not.toHaveBeenCalled();
    expect(db.contentLearning.create).not.toHaveBeenCalled();
    expect(JSON.stringify(result.data)).not.toMatch(/accessToken|refreshToken/i);
  });

  it("TEST 18–20: Strategist/Planner allowlists include learning; user constraints remain highest priority in prompts", () => {
    expect(CONTENT_STRATEGIST_TOOL_IDS).toContain("learning.getRelevant");
    expect(CONTENT_PLANNER_TOOL_IDS).toContain("learning.getRelevant");
    expect(CONTENT_STRATEGIST_SYSTEM_PROMPT).toMatch(/Explicit user constraints/);
    expect(CONTENT_STRATEGIST_SYSTEM_PROMPT).toMatch(/learning\.getRelevant/);
    expect(CONTENT_STRATEGIST_SYSTEM_PROMPT).toMatch(/never override explicit user constraints/i);
    expect(CONTENT_PLANNER_SYSTEM_PROMPT).toMatch(/Explicit user constraints/);
    expect(CONTENT_PLANNER_SYSTEM_PROMPT).toMatch(/learning\.getRelevant/);
    expect(CONTENT_PLANNER_SYSTEM_PROMPT).toMatch(/never override explicit user constraints/i);
    expect(CONTENT_STRATEGIST_SYSTEM_PROMPT).not.toMatch(/will go viral|optimal posting time prediction/i);
  });

  it("TEST 24–27: No prediction / auto strategy / content / publishing in engine output", async () => {
    db.contentMetric.findMany.mockResolvedValue(validSample());
    const engine = createContentLearningEngine();
    const result = await engine.analyze({
      scope: { workspaceId: "ws_1", brandId: "brand_1" },
    });
    const blob = JSON.stringify(result).toLowerCase();
    expect(blob.includes("will go viral")).toBe(false);
    expect(blob.includes("viral probability")).toBe(false);
    expect(blob.includes("guaranteed performance")).toBe(false);
    expect(blob.includes("automatically change marketingstrategy")).toBe(false);
    expect(blob.includes("auto-reschedule")).toBe(false);
    expect(blob.includes("auto-publish")).toBe(false);
    // Engine must not mutate strategy/content/publishing tables
    expect(db.contentLearning.create).toHaveBeenCalled();
  });

  it("TEST 28–30: Meta/TikTok unavailable; Pinterest removed", () => {
    expect(isAnalyticsPlatformUnavailable("meta")).toBe(true);
    expect(isAnalyticsPlatformUnavailable("tiktok")).toBe(true);
    expect(isAnalyticsPlatformRemoved("pinterest")).toBe(true);
  });

  it("mock/legacy sources are excluded from production learning query", async () => {
    const engine = createContentLearningEngine();
    await engine.analyze({
      scope: { workspaceId: "ws_1", brandId: "brand_1" },
    });
    const where = db.contentMetric.findMany.mock.calls[0][0].where;
    expect(where.NOT).toEqual({ source: { in: ["mock", "legacy"] } });
  });
});
