import { describe, expect, it } from "vitest";
import type { ContentAsset } from "@/server/agent/content-creator/output";
import {
  canTransition,
  ContentWorkspaceError,
  createContentWorkspaceService,
  createMemoryStore,
  createStubRegenerator,
} from "@/server/content-workspace";

function sampleAsset(overrides?: Partial<ContentAsset["content"]>): ContentAsset {
  return {
    blueprintReference: "plan-item-1",
    content: {
      channel: "instagram",
      format: "reel",
      topic: "Behind the scenes",
      objective: "awareness",
      audience: "founders",
      angle: "honest process",
      pillar: "brand story",
      ...overrides,
    },
    creative: {
      hooks: ["Stop scrolling if you build in public"],
      primaryHook: "Stop scrolling if you build in public",
      script: {
        scenes: [
          { order: 1, voiceover: "Day one chaos", visual: "desk" },
          { order: 2, voiceover: "Ship anyway", visual: "screen" },
        ],
        ending: "Follow for the launch",
      },
      caption: "We ship imperfectly. Here's why.",
      cta: "Save this for your next build day",
      ctaVariants: ["Save this"],
      cover: { concept: "messy desk", text: "Build in public" },
      hashtags: ["#buildinpublic"],
      productionNotes: ["Natural light"],
    },
    quality: {
      strategicConsistency: "aligned",
      brandConsistency: "ok",
      limitations: [],
    },
  };
}

describe("EPIC-013 Content Workspace", () => {
  function makeService() {
    return createContentWorkspaceService({
      store: createMemoryStore(),
      regenerator: createStubRegenerator(),
    });
  }

  const scopeA = { workspaceId: "ws-a", brandId: "brand-a" };
  const scopeB = { workspaceId: "ws-b", brandId: "brand-b" };

  it("TEST 1: create ContentDraft from valid Creator output", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
      evidence: [
        { type: "trend", summary: "Build-in-public rising" },
        { type: "brand", summary: "Authenticity pillar" },
      ],
      whyNow: "Launch week",
      blueprintReference: {
        planItemId: "plan-item-1",
        summary: "Reel for awareness",
      },
    });

    expect(draft.status).toBe("DRAFT");
    expect(draft.topic).toBe("Behind the scenes");
    expect(draft.contentPayload.primaryHook).toContain("build in public");
    expect(draft.contentPayload.caption).toContain("imperfectly");
    expect(draft.currentVersion).toBe(1);
    expect(draft.blueprintReference?.planItemId).toBe("plan-item-1");
  });

  it("TEST 2: workspace/brand scoping", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });

    await expect(svc.get(draft.id, scopeB)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const listed = await svc.list({ ...scopeB });
    expect(listed).toHaveLength(0);
  });

  it("TEST 3: DRAFT → IN_REVIEW", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    const next = await svc.review(draft.id, scopeA, "user-1", "send_for_review");
    expect(next.status).toBe("IN_REVIEW");
  });

  it("TEST 4: IN_REVIEW → APPROVED", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    await svc.review(draft.id, scopeA, "user-1", "send_for_review");
    const next = await svc.review(draft.id, scopeA, "user-1", "approve");
    expect(next.status).toBe("APPROVED");
  });

  it("TEST 5: IN_REVIEW → CHANGES_REQUESTED", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    await svc.review(draft.id, scopeA, "user-1", "send_for_review");
    const next = await svc.review(
      draft.id,
      scopeA,
      "user-1",
      "request_changes",
      "لحنش زیادی رسمی است.",
    );
    expect(next.status).toBe("CHANGES_REQUESTED");
  });

  it("TEST 6: invalid transition rejected", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });

    await expect(
      svc.review(draft.id, scopeA, "user-1", "approve"),
    ).rejects.toBeInstanceOf(ContentWorkspaceError);

    await expect(
      svc.review(draft.id, scopeA, "user-1", "mark_ready"),
    ).rejects.toBeInstanceOf(ContentWorkspaceError);

    expect(canTransition("DRAFT", "READY")).toBe(false);
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
  });

  it("TEST 7: human edit creates new version", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    const edited = await svc.humanEdit(draft.id, scopeA, "user-1", {
      caption: "Human rewritten caption",
    });
    expect(edited.currentVersion).toBe(2);
    expect(edited.contentPayload.caption).toBe("Human rewritten caption");
    const versions = await svc.listVersions(draft.id, scopeA);
    expect(versions[0]?.source).toBe("HUMAN_EDIT");
    expect(versions).toHaveLength(2);
  });

  it("TEST 8: AI regeneration creates new version", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    const next = await svc.regenerateComponent(
      draft.id,
      scopeA,
      "user-1",
      "caption",
      "رسمی‌تر",
    );
    expect(next.currentVersion).toBe(2);
    const versions = await svc.listVersions(draft.id, scopeA);
    expect(versions[0]?.source).toBe("AI_REGENERATE");
    expect(versions[0]?.component).toBe("caption");
  });

  it("TEST 9: regenerate caption does not change hook/script", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    const hookBefore = draft.contentPayload.primaryHook;
    const scriptBefore = JSON.stringify(draft.contentPayload.script);
    const next = await svc.regenerateComponent(
      draft.id,
      scopeA,
      "user-1",
      "caption",
    );
    expect(next.contentPayload.primaryHook).toBe(hookBefore);
    expect(JSON.stringify(next.contentPayload.script)).toBe(scriptBefore);
    expect(next.contentPayload.caption).toContain("Regenerated caption");
  });

  it("TEST 10: blueprint fields remain unchanged after regeneration", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
      blueprintReference: {
        planItemId: "bp-9",
        summary: "Keep me",
        primaryObjective: "awareness",
      },
      whyNow: "Calendar spike",
    });
    const next = await svc.regenerateComponent(draft.id, scopeA, "user-1", "hook");
    expect(next.channel).toBe(draft.channel);
    expect(next.format).toBe(draft.format);
    expect(next.topic).toBe(draft.topic);
    expect(next.objective).toBe(draft.objective);
    expect(next.angle).toBe(draft.angle);
    expect(next.pillar).toBe(draft.pillar);
    expect(next.whyNow).toBe("Calendar spike");
    expect(next.blueprintReference?.planItemId).toBe("bp-9");
    expect(next.blueprintReference?.summary).toBe("Keep me");
  });

  it("TEST 11: review note is stored", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    await svc.review(
      draft.id,
      scopeA,
      "user-1",
      "note",
      "CTA فروش مستقیم نباشد.",
    );
    const reviews = await svc.listReviews(draft.id, scopeA);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.status).toBe("NOTE");
    expect(reviews[0]?.note).toContain("CTA");
  });

  it("TEST 12: version history is retrievable", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    await svc.humanEdit(draft.id, scopeA, "user-1", { cta: "New CTA" });
    await svc.regenerateComponent(draft.id, scopeA, "user-1", "hook");
    const versions = await svc.listVersions(draft.id, scopeA);
    expect(versions.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(versions.map((v) => v.source)).toEqual([
      "AI_REGENERATE",
      "HUMAN_EDIT",
      "AI_CREATE",
    ]);
  });

  it("TEST 13: no approval without human action / no DRAFT→READY", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    await expect(
      svc.review(draft.id, scopeA, "user-1", "mark_ready"),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    await svc.review(draft.id, scopeA, "user-1", "send_for_review");
    await svc.review(draft.id, scopeA, "user-1", "approve");
    const ready = await svc.review(draft.id, scopeA, "user-1", "mark_ready");
    expect(ready.status).toBe("READY");
  });

  it("TEST 14: publish action rejected", async () => {
    const svc = makeService();
    expect(() => svc.assertNoPublish()).toThrowError(ContentWorkspaceError);
    try {
      svc.assertNoPublish();
    } catch (e) {
      expect(e).toMatchObject({ code: "PUBLISH_NOT_ALLOWED" });
    }
  });

  it("TEST 15: unauthorized workspace access rejected", async () => {
    const svc = makeService();
    const draft = await svc.createFromCreatorOutput({
      ...scopeA,
      createdById: "user-1",
      asset: sampleAsset(),
    });
    await expect(
      svc.humanEdit(draft.id, scopeB, "user-2", { caption: "hack" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      svc.listVersions(draft.id, scopeB),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
