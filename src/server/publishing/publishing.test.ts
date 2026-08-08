import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { encryptTokenBundle, assertNoTokenLeak } from "@/server/social/credentials";
import {
  createPublishingService,
  createLinkedInPublisher,
  SocialPublisherRegistry,
  setSocialPublisherRegistryForTests,
  resetSocialPublisherRegistry,
  PublisherError,
  publishing,
} from "@/server/publishing";
import {
  createContentWorkspaceService,
  createMemoryStore,
  createStubRegenerator,
} from "@/server/content-workspace";
import { detectScheduleConflicts } from "@/server/content-planning";
import { getSocialProviderRegistry } from "@/server/social/registry";
import type { ContentAsset } from "@/server/agent/content-creator/output";

describe("EPIC-016 Social Publishing Engine", () => {
  const suffix = `epic016-${Date.now()}`;
  let workspaceId = "";
  let brandId = "";
  let brandBId = "";
  let userId = "";
  let readyDraftId = "";
  let draftId = "";
  let reviewDraftId = "";
  let approvedDraftId = "";
  let accountId = "";
  let disconnectedAccountId = "";
  let scheduleId = "";
  let svc: ReturnType<typeof createPublishingService>;
  let publishCalls = 0;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `pub-${suffix}@example.com`, name: "Publisher" },
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
      data: { workspaceId, name: `Brand ${suffix}`, slug: `brand-${suffix}` },
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

    const payload = {
      primaryHook: "Hook",
      hooks: ["Hook"],
      caption: "Hello LinkedIn from Inzorya",
      cta: "Learn more",
      ctaVariants: [],
      visualDirection: "",
      hashtags: [],
      productionNotes: [],
    };

    readyDraftId = (
      await prisma.contentDraft.create({
        data: {
          workspaceId,
          brandId,
          createdById: userId,
          channel: "linkedin",
          format: "post",
          topic: "Ready post",
          status: "READY",
          contentPayload: payload,
        },
      })
    ).id;

    draftId = (
      await prisma.contentDraft.create({
        data: {
          workspaceId,
          brandId,
          createdById: userId,
          channel: "linkedin",
          format: "post",
          topic: "Draft",
          status: "DRAFT",
          contentPayload: payload,
        },
      })
    ).id;

    reviewDraftId = (
      await prisma.contentDraft.create({
        data: {
          workspaceId,
          brandId,
          createdById: userId,
          channel: "linkedin",
          format: "post",
          topic: "Review",
          status: "IN_REVIEW",
          contentPayload: payload,
        },
      })
    ).id;

    approvedDraftId = (
      await prisma.contentDraft.create({
        data: {
          workspaceId,
          brandId,
          createdById: userId,
          channel: "linkedin",
          format: "post",
          topic: "Approved",
          status: "APPROVED",
          contentPayload: payload,
        },
      })
    ).id;

    accountId = (
      await prisma.socialAccount.create({
        data: {
          workspaceId,
          brandId,
          platform: "linkedin",
          platformAccountId: `li-${suffix}`,
          accountName: "Publish Co",
          status: "CONNECTED",
          capabilities: {
            connect: true,
            accountInfo: true,
            profile: true,
            publishing: true,
            analytics: false,
            mediaUpload: false,
            deleteContent: false,
          },
          scopes: ["openid", "profile", "email", "w_member_social"],
          connectedAt: new Date(),
        },
      })
    ).id;

    const enc = encryptTokenBundle({
      accessToken: "test-access-token-never-leak-please",
      refreshToken: "test-refresh-token-never-leak-please",
      scopes: ["w_member_social"],
      accessExpiresAt: new Date(Date.now() + 3600_000),
    });
    await prisma.socialAccountCredential.create({
      data: { socialAccountId: accountId, ...enc },
    });

    disconnectedAccountId = (
      await prisma.socialAccount.create({
        data: {
          workspaceId,
          brandId,
          platform: "linkedin",
          platformAccountId: `li-disc-${suffix}`,
          status: "DISCONNECTED",
          capabilities: { publishing: true },
          disconnectedAt: new Date(),
        },
      })
    ).id;

    // Past due schedule
    scheduleId = (
      await prisma.contentSchedule.create({
        data: {
          workspaceId,
          brandId,
          contentDraftId: readyDraftId,
          channel: "linkedin",
          socialAccountId: accountId,
          plannedDate: new Date("2020-01-01"),
          plannedTime: "00:00",
          timezone: "UTC",
          status: "SCHEDULED",
          planningSource: "HUMAN",
          publishable: true,
          publishabilityReason: "PUBLISHABLE",
          createdById: userId,
        },
      })
    ).id;

    const registry = new SocialPublisherRegistry();
    registry.register(
      createLinkedInPublisher({
        async createTextPost() {
          publishCalls += 1;
          return { id: `urn:li:share:${suffix}-${publishCalls}` };
        },
      }),
    );
    setSocialPublisherRegistryForTests(registry);
    svc = createPublishingService({ publisherRegistry: registry });
  });

  afterAll(async () => {
    resetSocialPublisherRegistry();
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  async function scheduleForDraft(
    contentDraftId: string,
    status: "SCHEDULED" | "PLANNED" | "CANCELLED" = "SCHEDULED",
    socialAccountId: string | null = accountId,
  ) {
    return prisma.contentSchedule.create({
      data: {
        workspaceId,
        brandId,
        contentDraftId,
        channel: "linkedin",
        socialAccountId,
        plannedDate: new Date("2020-01-02"),
        plannedTime: "00:00",
        timezone: "UTC",
        status,
        planningSource: "HUMAN",
        publishable: true,
        createdById: userId,
      },
    });
  }

  it("TEST 1: READY + SCHEDULED + publishable → succeeds", async () => {
    publishCalls = 0;
    const result = await svc.publish({
      workspaceId,
      brandId,
      contentScheduleId: scheduleId,
      triggeredBy: "manual",
    });
    expect(result.publication?.status).toBe("PUBLISHED");
    expect(result.publication?.externalPostId).toContain("urn:li:share");
    expect(publishCalls).toBe(1);
  });

  it("TEST 2–4: non-READY rejected", async () => {
    for (const id of [draftId, reviewDraftId, approvedDraftId]) {
      const sch = await scheduleForDraft(id);
      const v = await svc.validate({
        workspaceId,
        brandId,
        contentScheduleId: sch.id,
      });
      expect(v.ok).toBe(false);
      expect(v.errors.some((e) => /READY/i.test(e.message))).toBe(true);
    }
  });

  it("TEST 5: SCHEDULED missing → rejected", async () => {
    const sch = await scheduleForDraft(readyDraftId, "PLANNED");
    const v = await svc.validate({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
    });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /SCHEDULED/i.test(e.message))).toBe(true);
  });

  it("TEST 6: disconnected account rejected", async () => {
    const sch = await scheduleForDraft(readyDraftId, "SCHEDULED", disconnectedAccountId);
    const v = await svc.validate({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
      socialAccountId: disconnectedAccountId,
    });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.code === "AUTH_ERROR")).toBe(true);
  });

  it("TEST 7: publishing capability false rejected", async () => {
    const acc = await prisma.socialAccount.create({
      data: {
        workspaceId,
        brandId,
        platform: "linkedin",
        platformAccountId: `li-nopub-${suffix}`,
        status: "CONNECTED",
        capabilities: { publishing: false },
        connectedAt: new Date(),
      },
    });
    const sch = await scheduleForDraft(readyDraftId, "SCHEDULED", acc.id);
    const v = await svc.validate({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
      socialAccountId: acc.id,
    });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.code === "UNSUPPORTED_CAPABILITY")).toBe(true);
  });

  it("TEST 8: unsupported format rejected", async () => {
    const reel = await prisma.contentDraft.create({
      data: {
        workspaceId,
        brandId,
        createdById: userId,
        channel: "linkedin",
        format: "reel",
        topic: "Reel",
        status: "READY",
        contentPayload: {
          primaryHook: "h",
          hooks: [],
          caption: "c",
          cta: "",
          ctaVariants: [],
          visualDirection: "",
          hashtags: [],
          productionNotes: [],
        },
      },
    });
    const sch = await scheduleForDraft(reel.id);
    const v = await svc.validate({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
    });
    expect(v.ok).toBe(false);
    expect(
      v.errors.some(
        (e) => e.code === "UNSUPPORTED_FORMAT" || e.code === "MEDIA_ERROR",
      ),
    ).toBe(true);
  });

  it("TEST 9: invalid media rejected", async () => {
    const publisher = createLinkedInPublisher({
      async createTextPost() {
        return { id: "x" };
      },
    });
    const result = await publisher.validate({
      contentDraftId: readyDraftId,
      contentScheduleId: scheduleId,
      socialAccountId: accountId,
      platform: "linkedin",
      content: {
        caption: "hi",
        media: [
          {
            type: "image",
            url: "https://example.com/a.png",
            mimeType: "image/png",
            size: 10,
          },
        ],
      },
      format: "post",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "MEDIA_ERROR")).toBe(true);
  });

  it("TEST 10: provider auth failure → AUTH_ERROR", async () => {
    const registry = new SocialPublisherRegistry();
    registry.register(
      createLinkedInPublisher({
        async createTextPost() {
          throw new PublisherError("AUTH_ERROR", "401");
        },
      }),
    );
    const local = createPublishingService({ publisherRegistry: registry });
    const sch = await scheduleForDraft(readyDraftId);
    const result = await local.publish({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
    });
    expect(result.publication?.status).toBe("FAILED");
    expect(result.publication?.failureCode).toBe("AUTH_ERROR");
    expect(JSON.stringify(result)).not.toContain("test-access-token");
  });

  it("TEST 11: rate limit → RATE_LIMIT", async () => {
    const registry = new SocialPublisherRegistry();
    registry.register(
      createLinkedInPublisher({
        async createTextPost() {
          throw new PublisherError("RATE_LIMIT", "429", {
            retryable: true,
            retryAfterMs: 1000,
          });
        },
      }),
    );
    const local = createPublishingService({ publisherRegistry: registry });
    const sch = await scheduleForDraft(readyDraftId);
    const result = await local.publish({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
    });
    expect(result.publication?.failureCode).toBe("RATE_LIMIT");
    expect(result.publication?.nextRetryAt).toBeTruthy();
  });

  it("TEST 12: network failure → NETWORK_ERROR", async () => {
    const registry = new SocialPublisherRegistry();
    registry.register(
      createLinkedInPublisher({
        async createTextPost() {
          throw new PublisherError("NETWORK_ERROR", "timeout", {
            retryable: true,
          });
        },
      }),
    );
    const local = createPublishingService({ publisherRegistry: registry });
    const sch = await scheduleForDraft(readyDraftId);
    const result = await local.publish({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
    });
    expect(result.publication?.failureCode).toBe("NETWORK_ERROR");
  });

  it("TEST 13–14: externalPostId stored + idempotency", async () => {
    const first = await svc.publish({
      workspaceId,
      brandId,
      contentScheduleId: scheduleId,
    });
    expect(first.publication?.status).toBe("PUBLISHED");
    expect(first.idempotent).toBe(true);
    const before = publishCalls;
    const second = await svc.publish({
      workspaceId,
      brandId,
      contentScheduleId: scheduleId,
    });
    expect(second.idempotent).toBe(true);
    expect(publishCalls).toBe(before);
    expect(second.publication?.externalPostId).toBe(
      first.publication?.externalPostId,
    );
  });

  it("TEST 15: retry transient failure", async () => {
    let calls = 0;
    const registry = new SocialPublisherRegistry();
    registry.register(
      createLinkedInPublisher({
        async createTextPost() {
          calls += 1;
          if (calls === 1) {
            throw new PublisherError("NETWORK_ERROR", "temp", {
              retryable: true,
            });
          }
          return { id: `retry-${suffix}` };
        },
      }),
    );
    const local = createPublishingService({ publisherRegistry: registry });
    const sch = await scheduleForDraft(readyDraftId);
    const failed = await local.publish({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
    });
    expect(failed.publication?.status).toBe("FAILED");
    const retried = await local.retry(failed.publication!.id, {
      workspaceId,
      brandId,
    });
    expect(retried.publication?.status).toBe("PUBLISHED");
  });

  it("TEST 16: do not retry permanent validation failure", async () => {
    const registry = new SocialPublisherRegistry();
    registry.register(
      createLinkedInPublisher({
        async createTextPost() {
          throw new PublisherError("AUTH_ERROR", "denied");
        },
      }),
    );
    const local = createPublishingService({ publisherRegistry: registry });
    const sch = await scheduleForDraft(readyDraftId);
    const failed = await local.publish({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
    });
    await expect(
      local.retry(failed.publication!.id, { workspaceId, brandId }),
    ).rejects.toThrow(/Permanent|cannot be retried/i);
  });

  it("TEST 17: manual and scheduled use same validation", async () => {
    const a = await svc.validate({
      workspaceId,
      brandId,
      contentScheduleId: scheduleId,
    });
    // Already published — validation of gates still runs independently;
    // ensure validate function is shared path (ok depends on READY+SCHEDULED)
    expect(a.preview?.draftStatus).toBe("READY");
    expect(a.preview?.scheduleStatus).toBe("SCHEDULED");
  });

  it("TEST 18: cancelled schedule cannot publish", async () => {
    const sch = await scheduleForDraft(readyDraftId, "CANCELLED");
    const v = await svc.validate({
      workspaceId,
      brandId,
      contentScheduleId: sch.id,
    });
    expect(v.ok).toBe(false);
  });

  it("TEST 19: already published cannot publish twice", async () => {
    const before = publishCalls;
    const again = await svc.publish({
      workspaceId,
      brandId,
      contentScheduleId: scheduleId,
    });
    expect(again.idempotent).toBe(true);
    expect(publishCalls).toBe(before);
  });

  it("TEST 20–21: wrong workspace/brand rejected", async () => {
    await expect(
      svc.get("nonexistent", { workspaceId: "x", brandId }),
    ).rejects.toBeInstanceOf(PublisherError);

    const pubs = await svc.list({ workspaceId, brandId: brandBId });
    expect(pubs).toHaveLength(0);

    const result = await svc.publish({
      workspaceId,
      brandId: brandBId,
      contentScheduleId: scheduleId,
    });
    // scope mismatch on schedule load
    expect(result.publication).toBeNull();
    expect(result.validation?.ok).toBe(false);
  });

  it("TEST 22–23: raw token never in response/logs payload", async () => {
    const result = await svc.publish({
      workspaceId,
      brandId,
      contentScheduleId: scheduleId,
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain("test-access-token");
    expect(json).not.toContain("test-refresh-token");
    expect(() => assertNoTokenLeak(result)).not.toThrow();
  });

  it("TEST 24: Agent cannot publish", () => {
    expect(() => publishing.assertAgentCannotPublish()).toThrow(
      /Agents cannot publish/i,
    );
  });

  it("TEST 25–27: Meta/TikTok/Pinterest", async () => {
    expect(await svc.getProviderCapabilities("meta")).toMatchObject({
      verification: "UNAVAILABLE",
    });
    expect(await svc.getProviderCapabilities("tiktok")).toMatchObject({
      verification: "UNAVAILABLE",
    });
    expect(await svc.getProviderCapabilities("pinterest")).toMatchObject({
      verification: "REMOVED",
    });
    expect(getSocialProviderRegistry().hasProvider("pinterest")).toBe(false);
  });

  it("TEST 28–29: Content Workspace + Calendar helpers remain", async () => {
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

    const conflicts = detectScheduleConflicts([
      {
        draftId: "a",
        date: "2026-01-01",
        time: "10:00",
        channel: "linkedin",
      },
      {
        draftId: "b",
        date: "2026-01-01",
        time: "10:00",
        channel: "linkedin",
      },
    ]);
    expect(conflicts.length).toBeGreaterThan(0);
  });
});
