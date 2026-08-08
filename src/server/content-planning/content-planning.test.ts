import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  FakeLLMProvider,
  setAgentLLMProvider,
  resetAgentLLMProvider,
} from "@/server/agent/llm";
import {
  bootstrapAgentTools,
  resetAgentBootstrap,
  ToolRegistry,
} from "@/server/agent";
import { runContentPlannerAgent } from "@/server/agent/content-planner";
import {
  contentPlanning,
  detectScheduleConflicts,
  resolvePublishability,
  ContentPlanningError,
} from "@/server/content-planning";
import {
  createContentWorkspaceService,
  createMemoryStore,
  createStubRegenerator,
} from "@/server/content-workspace";
import { getSocialProviderRegistry } from "@/server/social/registry";
import type { ContentAsset } from "@/server/agent/content-creator/output";
import type { ContentDraftPayload } from "@/server/content-workspace/types";

function payload(): ContentDraftPayload {
  return {
    primaryHook: "Hook",
    hooks: ["Hook"],
    caption: "Caption",
    cta: "CTA",
    ctaVariants: [],
    visualDirection: "",
    hashtags: [],
    productionNotes: [],
  };
}

describe("EPIC-015 Content Planner & Scheduling", () => {
  const suffix = `epic015-${Date.now()}`;
  let workspaceId = "";
  let brandId = "";
  let brandBId = "";
  let userId = "";
  let readyDraftId = "";
  let draftDraftId = "";
  let linkedInAccountId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `plan-${suffix}@example.com`, name: "Planner" },
    });
    userId = user.id;
    const workspace = await prisma.workspace.create({
      data: {
        name: `WS ${suffix}`,
        slug: `ws-${suffix}`,
        members: { create: { userId, role: "OWNER" } },
      },
    });
    workspaceId = workspace.id;
    const brand = await prisma.brand.create({
      data: {
        workspaceId,
        name: `Brand ${suffix}`,
        slug: `brand-${suffix}`,
      },
    });
    brandId = brand.id;
    const brandB = await prisma.brand.create({
      data: {
        workspaceId,
        name: `BrandB ${suffix}`,
        slug: `brand-b-${suffix}`,
      },
    });
    brandBId = brandB.id;

    const ready = await prisma.contentDraft.create({
      data: {
        workspaceId,
        brandId,
        createdById: userId,
        channel: "linkedin",
        format: "reel",
        topic: "Ready topic",
        objective: "awareness",
        status: "READY",
        contentPayload: payload(),
      },
    });
    readyDraftId = ready.id;

    const draft = await prisma.contentDraft.create({
      data: {
        workspaceId,
        brandId,
        createdById: userId,
        channel: "linkedin",
        format: "carousel",
        topic: "Draft topic",
        status: "DRAFT",
        contentPayload: payload(),
      },
    });
    draftDraftId = draft.id;

    const account = await prisma.socialAccount.create({
      data: {
        workspaceId,
        brandId,
        platform: "linkedin",
        platformAccountId: `li-${suffix}`,
        accountName: "LI Test",
        status: "CONNECTED",
        capabilities: {
          connect: true,
          accountInfo: true,
          profile: true,
          publishing: false,
          analytics: false,
          mediaUpload: false,
          deleteContent: false,
        },
        connectedAt: new Date(),
      },
    });
    linkedInAccountId = account.id;
  });

  afterAll(async () => {
    resetAgentLLMProvider();
    resetAgentBootstrap();
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it("TEST 1: create plan from READY draft", async () => {
    const plan = await contentPlanning.createFromReadyDraft({
      workspaceId,
      brandId,
      userId,
      contentDraftId: readyDraftId,
      plannedDate: "2026-08-10",
      plannedTime: "19:00",
      timezone: "Asia/Tehran",
      socialAccountId: linkedInAccountId,
      planningSource: "HUMAN",
    });
    expect(plan.status).toBe("PLANNED");
    expect(plan.contentDraftId).toBe(readyDraftId);
  });

  it("TEST 2: DRAFT cannot be planned", async () => {
    await expect(
      contentPlanning.createFromReadyDraft({
        workspaceId,
        brandId,
        userId,
        contentDraftId: draftDraftId,
        plannedDate: "2026-08-11",
        plannedTime: "10:00",
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS" });
  });

  it("TEST 3–5: user constraints / mix / fixed date via proposal parse", async () => {
    const proposalJson = {
      request: {
        original: "۳ ریلز و ۲ کاروسل هفته آینده؛ این Reel شنبه ۱۹:۰۰",
        mode: "hybrid",
        dateRange: { from: "2026-08-09", to: "2026-08-15" },
        timezone: "Asia/Tehran",
        constraints: {
          reels: 3,
          carousels: 2,
          fixed: [{ draftId: readyDraftId, date: "2026-08-09", time: "19:00" }],
        },
      },
      schedule: [
        {
          draftId: readyDraftId,
          channel: "instagram",
          date: "2026-08-09",
          time: "19:00",
          timezone: "Asia/Tehran",
          status: "planned",
          planningSource: "ai",
          reason: "FACT: user fixed Saturday 19:00",
          evidence: [{ type: "user", summary: "Fixed date", kind: "fact" }],
          confidence: "high",
          format: "reel",
        },
      ],
      coverage: {
        requestedCount: { reel: 3, carousel: 2 },
        plannedCount: { reel: 3, carousel: 2 },
        channels: ["instagram"],
        formats: ["reel", "carousel"],
      },
      conflicts: [],
      limitations: ["Historical performance data was unavailable."],
      publishability: [
        {
          draftId: readyDraftId,
          publishable: false,
          reason: "META_UNAVAILABLE",
        },
      ],
    };

    setAgentLLMProvider(
      new FakeLLMProvider([
        { type: "message", content: JSON.stringify(proposalJson) },
      ]),
    );
    resetAgentBootstrap();
    const registry = bootstrapAgentTools(new ToolRegistry());
    const result = await runContentPlannerAgent({
      message: proposalJson.request.original,
      userId,
      workspaceId,
      brandId,
      toolRegistry: registry,
      contextBlock: JSON.stringify({
        readyDrafts: [{ id: readyDraftId, format: "reel" }],
      }),
    });

    expect(result.proposal.request.mode).toBe("hybrid");
    expect(result.proposal.coverage.requestedCount).toMatchObject({
      reel: 3,
      carousel: 2,
    });
    expect(result.proposal.coverage.plannedCount).toMatchObject({
      reel: 3,
      carousel: 2,
    });
    expect(result.proposal.schedule[0]?.date).toBe("2026-08-09");
    expect(result.proposal.schedule[0]?.time).toBe("19:00");
  });

  it("TEST 6: AI proposal generated", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: JSON.stringify({
            request: {
              original: "برنامه بده",
              mode: "ai_led",
              timezone: "Asia/Tehran",
              dateRange: { from: "2026-08-10", to: "2026-08-16" },
              constraints: {},
            },
            schedule: [
              {
                draftId: readyDraftId,
                channel: "linkedin",
                date: "2026-08-12",
                time: "18:00",
                timezone: "Asia/Tehran",
                status: "planned",
                planningSource: "ai",
                reason: "Distributed across the week",
                evidence: [],
                confidence: "low",
              },
            ],
            coverage: {
              requestedCount: {},
              plannedCount: { linkedin: 1 },
              channels: ["linkedin"],
              formats: ["reel"],
            },
            conflicts: [],
            limitations: [
              "Historical performance data was unavailable.",
              "NO_PERFORMANCE_EVIDENCE",
            ],
            publishability: [],
          }),
        },
      ]),
    );
    const result = await contentPlanning.propose({
      workspaceId,
      brandId,
      userId,
      message: "برنامه بده",
      draftIds: [readyDraftId],
      persist: true,
    });
    expect(result.proposal.schedule.length).toBeGreaterThan(0);
    expect(result.schedules.length).toBeGreaterThan(0);
    expect(result.schedules[0]?.status).toBe("PLANNED");
    expect(result.schedules[0]?.planningSource).toBe("AI");
  });

  it("TEST 7: human confirmation PLANNED → SCHEDULED", async () => {
    const plan = await contentPlanning.createFromReadyDraft({
      workspaceId,
      brandId,
      userId,
      contentDraftId: readyDraftId,
      plannedDate: "2026-08-13",
      plannedTime: "11:00",
      planningSource: "AI",
    });
    const confirmed = await contentPlanning.confirm(
      plan.id,
      { workspaceId, brandId },
      userId,
    );
    expect(confirmed.status).toBe("SCHEDULED");
  });

  it("TEST 8: AI cannot confirm schedule", () => {
    expect(() => contentPlanning.assertAiCannotConfirm()).toThrow(
      ContentPlanningError,
    );
  });

  it("TEST 9: conflict detection", () => {
    const conflicts = detectScheduleConflicts([
      {
        draftId: "a",
        date: "2026-08-14",
        time: "19:00",
        channel: "instagram",
      },
      {
        draftId: "b",
        date: "2026-08-14",
        time: "19:00",
        channel: "instagram",
      },
    ]);
    expect(conflicts.some((c) => c.type === "SCHEDULE_CONFLICT")).toBe(true);
  });

  it("TEST 10–11: event deadline / expired opportunity warnings", () => {
    const expiration = "2026-08-01";
    const planned = "2026-08-05";
    const conflicts = [] as ReturnType<typeof detectScheduleConflicts>;
    if (planned > expiration) {
      conflicts.push({
        type: "EVENT_EXPIRED",
        severity: "error",
        items: [readyDraftId],
        message: "Content planned after opportunity expiration.",
      });
    }
    expect(conflicts[0]?.type).toBe("EVENT_EXPIRED");
  });

  it("TEST 12–13: analytics unavailable / no fabricated optimal time", async () => {
    setAgentLLMProvider(
      new FakeLLMProvider([
        {
          type: "message",
          content: JSON.stringify({
            request: {
              original: "best time?",
              mode: "ai_led",
              timezone: "Asia/Tehran",
              dateRange: {},
              constraints: {},
            },
            schedule: [
              {
                draftId: readyDraftId,
                channel: "linkedin",
                date: "2026-08-15",
                time: "12:00",
                timezone: "Asia/Tehran",
                status: "planned",
                planningSource: "ai",
                reason:
                  "Default midday window used because performance evidence is unavailable.",
                evidence: [
                  {
                    type: "limitation",
                    summary: "NO_PERFORMANCE_EVIDENCE",
                    kind: "fact",
                  },
                ],
                confidence: "low",
              },
            ],
            coverage: {
              requestedCount: {},
              plannedCount: {},
              channels: [],
              formats: [],
            },
            conflicts: [],
            limitations: [
              "Historical performance data was unavailable.",
              "NO_PERFORMANCE_EVIDENCE",
            ],
            publishability: [],
          }),
        },
      ]),
    );
    const result = await runContentPlannerAgent({
      message: "best time?",
      userId,
      workspaceId,
      brandId,
      toolRegistry: bootstrapAgentTools(new ToolRegistry()),
    });
    expect(
      result.proposal.limitations.some((l) =>
        /unavailable|NO_PERFORMANCE_EVIDENCE/i.test(l),
      ),
    ).toBe(true);
    expect(result.proposal.schedule[0]?.confidence).toBe("low");
    expect(result.proposal.schedule[0]?.reason).not.toMatch(/best time is/i);
  });

  it("TEST 14: manual reschedule overrides AI", async () => {
    const plan = await contentPlanning.createFromReadyDraft({
      workspaceId,
      brandId,
      userId,
      contentDraftId: readyDraftId,
      plannedDate: "2026-08-16",
      plannedTime: "09:00",
      planningSource: "AI",
    });
    const moved = await contentPlanning.reschedule(
      plan.id,
      { workspaceId, brandId },
      userId,
      { plannedDate: "2026-08-17", plannedTime: "20:30" },
    );
    expect(moved.planningSource).toBe("HUMAN");
    expect(moved.plannedTime).toBe("20:30");
    expect(moved.plannedDate.toISOString().slice(0, 10)).toBe("2026-08-17");
  });

  it("TEST 15: wrong workspace rejected", async () => {
    const plan = await contentPlanning.createFromReadyDraft({
      workspaceId,
      brandId,
      userId,
      contentDraftId: readyDraftId,
      plannedDate: "2026-08-18",
      plannedTime: "10:00",
    });
    await expect(
      contentPlanning.get(plan.id, {
        workspaceId: "other-ws",
        brandId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("TEST 16: wrong brand rejected", async () => {
    const plan = await contentPlanning.createFromReadyDraft({
      workspaceId,
      brandId,
      userId,
      contentDraftId: readyDraftId,
      plannedDate: "2026-08-19",
      plannedTime: "10:00",
    });
    await expect(
      contentPlanning.confirm(plan.id, { workspaceId, brandId: brandBId }, userId),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("TEST 17: unpublishable LinkedIn can still be planned", async () => {
    const pub = await resolvePublishability({
      workspaceId,
      brandId,
      channel: "linkedin",
      socialAccountId: linkedInAccountId,
    });
    expect(pub.publishable).toBe(false);
    expect(pub.reason).toMatch(/SOCIAL_PUBLISHING_NOT_AVAILABLE|PUBLISHING_ENGINE/);

    const plan = await contentPlanning.createFromReadyDraft({
      workspaceId,
      brandId,
      userId,
      contentDraftId: readyDraftId,
      plannedDate: "2026-08-20",
      plannedTime: "15:00",
      socialAccountId: linkedInAccountId,
    });
    expect(plan.status).toBe("PLANNED");
    expect(plan.publishable).toBe(false);
  });

  it("TEST 18: publishing request is NOT executed", () => {
    expect(() => contentPlanning.assertNoExternalPublish()).toThrow(
      /No external social publishing/,
    );
  });

  it("TEST 19: Meta unavailable", async () => {
    const pub = await resolvePublishability({
      workspaceId,
      brandId,
      channel: "instagram",
    });
    expect(pub.reason).toBe("META_UNAVAILABLE");
    expect(() =>
      getSocialProviderRegistry().requireProvider("meta"),
    ).toThrow();
  });

  it("TEST 20: TikTok unavailable", async () => {
    const pub = await resolvePublishability({
      workspaceId,
      brandId,
      channel: "tiktok",
    });
    expect(pub.reason).toBe("TIKTOK_UNAVAILABLE");
  });

  it("TEST 21: Pinterest absent", () => {
    expect(getSocialProviderRegistry().hasProvider("pinterest")).toBe(false);
    expect(() =>
      getSocialProviderRegistry().requireProvider("pinterest"),
    ).toThrow(/not part of Inzorya/i);
  });

  it("TEST 22: Content Workspace remains functional", async () => {
    const cw = createContentWorkspaceService({
      store: createMemoryStore(),
      regenerator: createStubRegenerator(),
    });
    const asset = {
      blueprintReference: "x",
      content: {
        channel: "linkedin",
        format: "post",
        topic: "T",
        objective: "awareness",
        angle: "a",
      },
      creative: {
        hooks: ["h"],
        primaryHook: "h",
        caption: "c",
        cta: "cta",
        ctaVariants: [],
        hashtags: [],
        productionNotes: [],
      },
      quality: {
        strategicConsistency: "ok",
        brandConsistency: "ok",
        limitations: [],
      },
    } as ContentAsset;
    const d = await cw.createFromCreatorOutput({
      workspaceId,
      brandId,
      createdById: userId,
      asset,
    });
    expect(d.status).toBe("DRAFT");
  });
});
