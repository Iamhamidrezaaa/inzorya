import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ToolRegistry,
  bootstrapAgentTools,
  executeTool,
  resetAgentBootstrap,
} from "@/server/agent";
import type { ToolContext } from "@/server/agent/types";
import {
  SocialAnalyticsProviderRegistry,
  createFakeAnalyticsProvider,
  createSocialAnalyticsIngestionService,
  createUnavailableCapabilityProvider,
  getSocialAnalyticsProviderRegistry,
  isAnalyticsPlatformRemoved,
  isAnalyticsPlatformUnavailable,
  linkedInAnalyticsProvider,
  resetSocialAnalyticsProviderRegistry,
  setSocialAnalyticsProviderRegistryForTests,
} from "@/server/social-analytics-ingestion";
import { SocialAnalyticsError } from "@/server/social-analytics-ingestion/types";
import { availabilityFromMetrics, EMPTY_METRICS } from "@/server/social-analytics-ingestion/types";
import { encryptTokenBundle } from "@/server/social/credentials";
import {
  SocialProviderRegistry,
  setSocialProviderRegistryForTests,
} from "@/server/social/registry";
import type { SocialPlatformProvider } from "@/server/social/provider";

vi.mock("@/lib/db", () => ({
  prisma: {
    brand: { findFirst: vi.fn() },
    analyticsSnapshot: { findFirst: vi.fn() },
    contentItem: { findMany: vi.fn() },
    contentMetric: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    socialPublication: { findFirst: vi.fn(), findMany: vi.fn() },
    socialAccount: { findFirst: vi.fn(), update: vi.fn() },
    socialAccountCredential: { update: vi.fn() },
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
    upsert: ReturnType<typeof vi.fn>;
  };
  socialPublication: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  socialAccount: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  socialAccountCredential: { update: ReturnType<typeof vi.fn> };
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

function makeCred(accessToken = "tok_live") {
  return encryptTokenBundle({
    accessToken,
    refreshToken: "refresh_live",
    scopes: ["openid", "profile", "email", "w_member_social"],
    accessExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
}

function publishedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pub_1",
    workspaceId: "ws_1",
    brandId: "brand_1",
    contentDraftId: "draft_1",
    contentScheduleId: "sched_1",
    socialAccountId: "sa_1",
    platform: "linkedin",
    status: "PUBLISHED",
    externalPostId: "urn:li:share:111",
    publishedAt: new Date("2026-07-01T12:00:00Z"),
    contentDraft: { format: "POST", topic: "Launch" },
    socialAccount: {
      id: "sa_1",
      platform: "linkedin",
      platformAccountId: "li_person_1",
      status: "CONNECTED",
      workspaceId: "ws_1",
      brandId: "brand_1",
      credential: makeCred(),
    },
    ...overrides,
  };
}

describe("EPIC-017 — Social Analytics Ingestion & Attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSocialAnalyticsProviderRegistry();
    setSocialProviderRegistryForTests(null);
    db.brand.findFirst.mockResolvedValue({ id: "brand_1" });
    db.analyticsSnapshot.findFirst.mockResolvedValue(null);
    db.contentItem.findMany.mockResolvedValue([]);
    db.contentMetric.count.mockResolvedValue(0);
    db.contentMetric.findFirst.mockResolvedValue(null);
    db.contentMetric.findMany.mockResolvedValue([]);
    db.contentMetric.upsert.mockImplementation(async ({ create, update, where }: {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
      where: { brandId_externalId: { brandId: string; externalId: string } };
    }) => ({
      id: "cm_1",
      ...create,
      ...update,
      brandId: where.brandId_externalId.brandId,
      externalId: where.brandId_externalId.externalId,
      updatedAt: new Date(),
      collectedAt: create.collectedAt ?? update.collectedAt ?? new Date(),
    }));
  });

  it("TEST 1: provider registry lists LinkedIn and excludes Meta/TikTok/Pinterest", () => {
    const registry = getSocialAnalyticsProviderRegistry();
    expect(registry.hasAnalyticsProvider("linkedin")).toBe(true);
    expect(registry.hasAnalyticsProvider("meta")).toBe(false);
    expect(registry.hasAnalyticsProvider("tiktok")).toBe(false);
    expect(registry.hasAnalyticsProvider("pinterest")).toBe(false);
    expect(isAnalyticsPlatformUnavailable("meta")).toBe(true);
    expect(isAnalyticsPlatformUnavailable("tiktok")).toBe(true);
    expect(isAnalyticsPlatformRemoved("pinterest")).toBe(true);
  });

  it("TEST 2: connected account with analytics capability (fake)", () => {
    const fake = createFakeAnalyticsProvider({
      capabilities: { postMetrics: true },
    });
    expect(fake.declaredCapabilities().postMetrics).toBe(true);
    expect(fake.descriptor().verificationStatus).toBe("MOCK_VERIFIED");
  });

  it("TEST 3: analytics capability unavailable", async () => {
    const provider = createUnavailableCapabilityProvider();
    const result = await provider.getPostMetrics({
      accessToken: "x",
      externalPostId: "p1",
    });
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe("CAPABILITY_NOT_AVAILABLE");
    }
    expect(linkedInAnalyticsProvider.declaredCapabilities().postMetrics).toBe(
      false,
    );
  });

  it("TEST 4–8: fetch, normalize, null metrics, no fake zeros, attribution", async () => {
    const fake = createFakeAnalyticsProvider({
      posts: [
        {
          externalPostId: "urn:li:share:111",
          metrics: {
            impressions: 2430,
            likes: 82,
            comments: 14,
            reach: null,
            views: null,
            shares: null,
            clicks: null,
            engagements: 96,
            saves: null,
          },
        },
      ],
    });
    const analyticsRegistry = new SocialAnalyticsProviderRegistry();
    analyticsRegistry.registerProvider(fake);
    setSocialAnalyticsProviderRegistryForTests(analyticsRegistry);

    db.socialPublication.findFirst.mockResolvedValue(publishedRow());

    const service = createSocialAnalyticsIngestionService({
      analyticsRegistry,
    });
    const result = await service.ingestPublication("pub_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    });

    expect(result.available).toBe(true);
    expect(result.source).toBe("LINKEDIN_API");
    expect(result.metrics?.impressions).toBe(2430);
    expect(result.metrics?.likes).toBe(82);
    expect(result.metrics?.reach).toBeNull();
    expect(result.metrics?.views).toBeNull();
    expect(result.availability?.reach).toBe(false);
    expect(result.metrics?.impressions).not.toBe(0);
    expect(db.contentMetric.upsert).toHaveBeenCalled();
    const upsertArg = db.contentMetric.upsert.mock.calls[0][0];
    expect(upsertArg.create.externalPostId).toBe("urn:li:share:111");
    expect(upsertArg.create.socialPublicationId).toBe("pub_1");
    expect(upsertArg.create.source).toBe("LINKEDIN_API");
    expect(upsertArg.create.source).not.toBe("MOCK");
  });

  it("TEST 6–7: normalize + missing stays null (unit)", () => {
    const metrics = { ...EMPTY_METRICS, likes: 5, impressions: null };
    const availability = availabilityFromMetrics(metrics);
    expect(availability.likes).toBe(true);
    expect(availability.impressions).toBe(false);
    expect(metrics.impressions).toBeNull();
    expect(metrics.impressions).not.toBe(0);
  });

  it("TEST 9: wrong externalPostId does not attribute", async () => {
    const fake = createFakeAnalyticsProvider({
      posts: [{ externalPostId: "other-id", metrics: { likes: 1 } }],
    });
    const analyticsRegistry = new SocialAnalyticsProviderRegistry();
    analyticsRegistry.registerProvider(fake);
    db.socialPublication.findFirst.mockResolvedValue(publishedRow());

    const service = createSocialAnalyticsIngestionService({
      analyticsRegistry,
    });
    const result = await service.ingestPublication("pub_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe("NOT_FOUND");
    expect(db.contentMetric.upsert).not.toHaveBeenCalled();
  });

  it("TEST 10–11: wrong workspace / brand rejected", async () => {
    db.socialPublication.findFirst.mockResolvedValue(null);
    const service = createSocialAnalyticsIngestionService();
    await expect(
      service.ingestPublication("pub_1", {
        workspaceId: "ws_other",
        brandId: "brand_1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    db.socialAccount.findFirst.mockResolvedValue(null);
    await expect(
      service.syncAccount({
        socialAccountId: "sa_1",
        from: "2026-07-01T00:00:00Z",
        to: "2026-07-07T00:00:00Z",
        scope: { workspaceId: "ws_1", brandId: "brand_other" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("TEST 12: token refresh reused on expiry", async () => {
    const refreshTokens = vi.fn(async () => ({
      tokens: {
        accessToken: "new_tok",
        refreshToken: "refresh_live",
        scopes: ["openid", "w_member_social"],
        accessExpiresAt: new Date(Date.now() + 3600_000),
      },
    }));
    const socialRegistry = new SocialProviderRegistry();
    socialRegistry.registerProvider({
      platform: "linkedin",
      displayName: "LinkedIn",
      authType: "oauth2",
      declaredCapabilities: () => ({
        connect: true,
        accountInfo: true,
        profile: true,
        publishing: true,
        analytics: false,
        mediaUpload: false,
        deleteContent: false,
      }),
      isConfigured: () => true,
      descriptor: () => ({
        platform: "linkedin",
        displayName: "LinkedIn",
        authType: "oauth2",
        capabilities: {
          connect: true,
          accountInfo: true,
          profile: true,
          publishing: true,
          analytics: false,
          mediaUpload: false,
          deleteContent: false,
        },
        configured: true,
      }),
      startConnect: async () => ({ authorizationUrl: "", state: "" }),
      completeConnect: async () => {
        throw new Error("n/a");
      },
      refreshTokens,
      fetchAccountInfo: async () => ({ platformAccountId: "li_person_1" }),
    } as SocialPlatformProvider);
    setSocialProviderRegistryForTests(socialRegistry);

    const expiredCred = encryptTokenBundle({
      accessToken: "old",
      refreshToken: "refresh_live",
      scopes: ["w_member_social"],
      accessExpiresAt: new Date(Date.now() - 10_000),
    });

    const fake = createFakeAnalyticsProvider({
      posts: [
        {
          externalPostId: "urn:li:share:111",
          metrics: { likes: 3, impressions: 10 },
        },
      ],
    });
    const analyticsRegistry = new SocialAnalyticsProviderRegistry();
    analyticsRegistry.registerProvider(fake);

    db.socialPublication.findFirst.mockResolvedValue(
      publishedRow({
        socialAccount: {
          id: "sa_1",
          platform: "linkedin",
          platformAccountId: "li_person_1",
          status: "CONNECTED",
          workspaceId: "ws_1",
          brandId: "brand_1",
          credential: expiredCred,
        },
      }),
    );
    db.socialAccountCredential.update.mockResolvedValue({});
    db.socialAccount.update.mockResolvedValue({});

    const service = createSocialAnalyticsIngestionService({
      analyticsRegistry,
      socialRegistry,
    });
    const result = await service.ingestPublication("pub_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    });
    expect(refreshTokens).toHaveBeenCalled();
    expect(result.available).toBe(true);
  });

  it("TEST 13–15: AUTH_ERROR / RATE_LIMIT / NETWORK_ERROR", async () => {
    for (const failWith of ["AUTH_ERROR", "RATE_LIMIT", "NETWORK_ERROR"] as const) {
      const fake = createFakeAnalyticsProvider({
        posts: [{ externalPostId: "urn:li:share:111", failWith }],
      });
      const analyticsRegistry = new SocialAnalyticsProviderRegistry();
      analyticsRegistry.registerProvider(fake);
      db.socialPublication.findFirst.mockResolvedValue(publishedRow());
      const service = createSocialAnalyticsIngestionService({
        analyticsRegistry,
      });
      const result = await service.ingestPublication("pub_1", {
        workspaceId: "ws_1",
        brandId: "brand_1",
      });
      expect(result.available).toBe(false);
      expect(result.reason).toBe(failWith);
    }
  });

  it("TEST 16: idempotent repeated sync upserts same key", async () => {
    const fake = createFakeAnalyticsProvider({
      posts: [
        {
          externalPostId: "urn:li:share:111",
          metrics: { likes: 1, impressions: 10 },
        },
      ],
    });
    const analyticsRegistry = new SocialAnalyticsProviderRegistry();
    analyticsRegistry.registerProvider(fake);
    db.socialPublication.findFirst.mockResolvedValue(publishedRow());
    const service = createSocialAnalyticsIngestionService({
      analyticsRegistry,
    });
    const metricDate = new Date("2026-07-30T15:00:00Z");
    await service.ingestPublication("pub_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    }, { metricDate });
    await service.ingestPublication("pub_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    }, { metricDate });
    expect(db.contentMetric.upsert).toHaveBeenCalledTimes(2);
    const key1 =
      db.contentMetric.upsert.mock.calls[0][0].where.brandId_externalId
        .externalId;
    const key2 =
      db.contentMetric.upsert.mock.calls[1][0].where.brandId_externalId
        .externalId;
    expect(key1).toBe(key2);
    expect(key1).toContain("urn:li:share:111");
    expect(key1).toContain("LINKEDIN_API");
  });

  it("TEST 17: bounded historical sync rejects >90 days", async () => {
    const service = createSocialAnalyticsIngestionService();
    db.socialAccount.findFirst.mockResolvedValue({
      id: "sa_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      platform: "linkedin",
    });
    await expect(
      service.syncAccount({
        socialAccountId: "sa_1",
        from: "2026-01-01T00:00:00Z",
        to: "2026-07-01T00:00:00Z",
        scope: { workspaceId: "ws_1", brandId: "brand_1" },
      }),
    ).rejects.toBeInstanceOf(SocialAnalyticsError);
  });

  it("TEST 18: data freshness reported", async () => {
    db.socialPublication.findFirst.mockResolvedValue(publishedRow());
    db.contentMetric.findMany.mockResolvedValue([
      {
        id: "cm_1",
        source: "LINKEDIN_API",
        collectedAt: new Date("2026-07-29T12:00:00Z"),
        updatedAt: new Date("2026-07-29T12:00:00Z"),
        availability: { impressions: true, likes: true },
        impressions: 100,
        likes: 5,
        reach: null,
        views: null,
        comments: null,
        shares: null,
        clicks: null,
        engagement: null,
        saves: null,
        metricDate: new Date("2026-07-29"),
      },
    ]);
    const service = createSocialAnalyticsIngestionService();
    const data = await service.getPublicationAnalytics("pub_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    });
    expect(data.available).toBe(true);
    expect(data.lastUpdatedAt).toBeTruthy();
    expect(typeof data.dataAgeMs).toBe("number");
  });

  it("TEST 19: ContentMetric source is real provider", async () => {
    const fake = createFakeAnalyticsProvider({
      posts: [
        {
          externalPostId: "urn:li:share:111",
          metrics: { likes: 2 },
        },
      ],
    });
    const analyticsRegistry = new SocialAnalyticsProviderRegistry();
    analyticsRegistry.registerProvider(fake);
    db.socialPublication.findFirst.mockResolvedValue(publishedRow());
    const service = createSocialAnalyticsIngestionService({
      analyticsRegistry,
    });
    await service.ingestPublication("pub_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    });
    expect(db.contentMetric.upsert.mock.calls[0][0].create.source).toBe(
      "LINKEDIN_API",
    );
  });

  it("TEST 20–23: social.analytics tools consume ingested data + small sample + no prediction fields", async () => {
    resetAgentBootstrap();
    const registry = bootstrapAgentTools(new ToolRegistry());

    db.contentMetric.findFirst.mockResolvedValue({
      source: "LINKEDIN_API",
      collectedAt: new Date(),
      updatedAt: new Date(),
    });
    db.contentMetric.count.mockResolvedValue(3);
    db.socialPublication.findMany.mockResolvedValue([
      { id: "pub_1", externalPostId: "urn:li:share:111" },
    ]);
    db.contentMetric.findMany.mockResolvedValue([
      {
        externalId: "linkedin:urn:li:share:111:2026-07-30:LINKEDIN_API",
        externalPostId: "urn:li:share:111",
        title: "Launch",
        platform: "linkedin",
        contentType: "POST",
        publishedAt: new Date("2026-07-01"),
        reach: null,
        impressions: 2430,
        likes: 82,
        comments: 14,
        shares: null,
        saves: null,
        engagement: 96,
        ctr: null,
        collectedAt: new Date(),
        updatedAt: new Date(),
        source: "LINKEDIN_API",
      },
      {
        externalId: "x2",
        externalPostId: "urn:li:share:222",
        title: "B",
        platform: "linkedin",
        contentType: "CAROUSEL",
        publishedAt: new Date("2026-07-02"),
        reach: 10,
        impressions: 20,
        likes: 1,
        comments: 0,
        shares: 0,
        saves: 0,
        engagement: 1,
        ctr: null,
        collectedAt: new Date(),
        updatedAt: new Date(),
        source: "LINKEDIN_API",
      },
      {
        externalId: "x3",
        externalPostId: "urn:li:share:333",
        title: "C",
        platform: "linkedin",
        contentType: "POST",
        publishedAt: new Date("2026-07-03"),
        reach: 5,
        impressions: 8,
        likes: 1,
        comments: 0,
        shares: 0,
        saves: 0,
        engagement: 1,
        ctr: null,
        collectedAt: new Date(),
        updatedAt: new Date(),
        source: "LINKEDIN_API",
      },
    ]);

    const perf = await executeTool(registry, {
      toolId: "analytics.getPerformance",
      input: {},
      context: ctx(),
    });
    expect(perf.success).toBe(true);
    expect(perf.data).toMatchObject({
      available: true,
      source: "LINKEDIN_API",
    });
    expect(JSON.stringify(perf.data)).not.toMatch(/will go viral|forecast|predict/i);
    const perfData = perf.data as {
      content?: Array<{ metrics: { reach: number | null } }>;
      metrics?: { reach: number | null };
    };
    expect(perfData.content?.[0]?.metrics.reach).toBeNull();
    expect(perfData.metrics?.reach).toBe(15);

    const top = await executeTool(registry, {
      toolId: "analytics.getTopContent",
      input: {},
      context: ctx(),
    });
    expect(top.data).toMatchObject({
      available: true,
      rankingMetric: "engagement",
    });
    expect((top.data as { limitations?: string[] }).limitations?.join(" ")).toMatch(
      /SMALL_SAMPLE|Top by engagement/i,
    );

    const compare = await executeTool(registry, {
      toolId: "analytics.compareContentTypes",
      input: {},
      context: ctx(),
    });
    expect(compare.data).toMatchObject({ available: true });
    expect(
      (compare.data as { limitations?: string[] }).limitations?.some((l) =>
        /SMALL_SAMPLE|causal/i.test(l),
      ),
    ).toBe(true);
  });

  it("TEST 24–26: no strategy/publish side effects; agent tools have no credentials", async () => {
    resetAgentBootstrap();
    const registry = bootstrapAgentTools(new ToolRegistry());
    db.contentMetric.findFirst.mockResolvedValue({
      source: "LINKEDIN_API",
      collectedAt: new Date(),
      updatedAt: new Date(),
    });
    db.contentMetric.count.mockResolvedValue(1);
    db.socialPublication.findMany.mockResolvedValue([
      { id: "pub_1", externalPostId: "urn:li:share:111" },
    ]);
    db.contentMetric.findMany.mockResolvedValue([
      {
        externalId: "e1",
        externalPostId: "urn:li:share:111",
        title: "A",
        platform: "linkedin",
        contentType: "POST",
        publishedAt: new Date(),
        reach: 1,
        impressions: 2,
        likes: 1,
        comments: 0,
        shares: 0,
        saves: 0,
        engagement: 1,
        ctr: null,
        collectedAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const result = await executeTool(registry, {
      toolId: "analytics.getPerformance",
      input: {},
      context: ctx(),
    });
    const blob = JSON.stringify(result.data);
    expect(blob).not.toMatch(/accessToken|refreshToken|Bearer /i);
    expect(db.socialAccount.update).not.toHaveBeenCalled();
  });

  it("TEST 27–29: Meta unavailable, TikTok unavailable, Pinterest absent", () => {
    expect(isAnalyticsPlatformUnavailable("meta")).toBe(true);
    expect(isAnalyticsPlatformUnavailable("instagram")).toBe(true);
    expect(isAnalyticsPlatformUnavailable("tiktok")).toBe(true);
    expect(isAnalyticsPlatformRemoved("pinterest")).toBe(true);
    const registry = new SocialAnalyticsProviderRegistry();
    expect(() =>
      registry.registerProvider(
        createFakeAnalyticsProvider({ platform: "pinterest" }),
      ),
    ).toThrow();
  });

  it("TEST EXTERNAL_POST_ID_MISSING", async () => {
    db.socialPublication.findFirst.mockResolvedValue(
      publishedRow({ externalPostId: null }),
    );
    const service = createSocialAnalyticsIngestionService();
    const result = await service.ingestPublication("pub_1", {
      workspaceId: "ws_1",
      brandId: "brand_1",
    });
    expect(result.reason).toBe("EXTERNAL_POST_ID_MISSING");
  });

  it("LinkedIn live provider reports CAPABILITY_NOT_AVAILABLE", async () => {
    const d = linkedInAnalyticsProvider.descriptor();
    expect(d.capabilities.postMetrics).toBe(false);
    expect(d.verificationStatus).toMatch(
      /CAPABILITY_NOT_AVAILABLE|UNAVAILABLE/,
    );
    const r = await linkedInAnalyticsProvider.getPostMetrics({
      accessToken: "x",
      externalPostId: "y",
    });
    expect(r.available).toBe(false);
    if (!r.available) expect(r.reason).toBe("CAPABILITY_NOT_AVAILABLE");
  });
});
