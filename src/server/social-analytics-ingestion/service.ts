import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import type { SocialAnalyticsProvider } from "@/server/social-analytics-ingestion/provider";
import {
  getSocialAnalyticsProviderRegistry,
  type SocialAnalyticsProviderRegistry,
} from "@/server/social-analytics-ingestion/registry";
import type {
  MetricAvailabilityMap,
  NormalizedPostMetrics,
  PostMetricsResult,
} from "@/server/social-analytics-ingestion/types";
import {
  MAX_BULK_PAGE_SIZE,
  MAX_SYNC_RANGE_DAYS,
  SocialAnalyticsError,
} from "@/server/social-analytics-ingestion/types";
import { decryptTokenBundle, encryptTokenBundle } from "@/server/social/credentials";
import type { SocialPlatformProvider } from "@/server/social/provider";
import {
  getSocialProviderRegistry,
  type SocialProviderRegistry,
} from "@/server/social/registry";
import { SocialIntegrationError } from "@/server/social/types";

type Db = PrismaClient;

export type IngestionScope = {
  workspaceId: string;
  brandId: string;
};

export type IngestPublicationResult = {
  publicationId: string;
  available: boolean;
  reason?: string;
  source?: string | null;
  contentMetricId?: string;
  metrics?: NormalizedPostMetrics;
  availability?: MetricAvailabilityMap;
  collectedAt?: string;
  limitations: string[];
  lastUpdatedAt?: string | null;
};

export type SyncResult = {
  socialAccountId: string;
  from: string;
  to: string;
  processed: number;
  succeeded: number;
  failed: number;
  results: IngestPublicationResult[];
  limitations: string[];
};

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function metricSnapshotExternalId(
  platform: string,
  externalPostId: string,
  metricDate: Date,
  source: string,
): string {
  const day = metricDate.toISOString().slice(0, 10);
  return `${platform}:${externalPostId}:${day}:${source}`;
}

function assertBoundedRange(from: Date, to: Date): void {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new SocialAnalyticsError("VALIDATION_ERROR", "Invalid date range");
  }
  if (from > to) {
    throw new SocialAnalyticsError(
      "VALIDATION_ERROR",
      "`from` must be <= `to`",
    );
  }
  const days =
    (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (days > MAX_SYNC_RANGE_DAYS) {
    throw new SocialAnalyticsError(
      "VALIDATION_ERROR",
      `Date range must be <= ${MAX_SYNC_RANGE_DAYS} days`,
    );
  }
}

async function resolveAccessToken(
  db: Db,
  socialRegistry: SocialProviderRegistry,
  account: {
    id: string;
    platform: string;
    status: string;
    credential: {
      accessCiphertext: string;
      accessIv: string;
      accessAuthTag: string;
      refreshCiphertext: string | null;
      refreshIv: string | null;
      refreshAuthTag: string | null;
      tokenType: string;
      scopes: string[];
      accessExpiresAt: Date | null;
      refreshExpiresAt: Date | null;
    } | null;
  },
): Promise<string> {
  if (!account.credential) {
    await db.socialAccount.update({
      where: { id: account.id },
      data: { status: "REAUTH_REQUIRED", lastError: "Missing credentials" },
    });
    throw new SocialAnalyticsError("REAUTH_REQUIRED", "Missing credentials");
  }

  let tokens = decryptTokenBundle(account.credential);
  const expired =
    tokens.accessExpiresAt &&
    tokens.accessExpiresAt.getTime() <= Date.now() + 60_000;

  if (expired) {
    const platformProvider = socialRegistry.getProvider(account.platform) as
      | SocialPlatformProvider
      | null;
    if (!platformProvider?.refreshTokens || !tokens.refreshToken) {
      await db.socialAccount.update({
        where: { id: account.id },
        data: {
          status: "REAUTH_REQUIRED",
          lastError: "Access token expired",
        },
      });
      throw new SocialAnalyticsError("REAUTH_REQUIRED", "Token expired");
    }
    try {
      const refreshed = await platformProvider.refreshTokens(tokens);
      tokens = refreshed.tokens;
      const encrypted = encryptTokenBundle(tokens);
      await db.socialAccountCredential.update({
        where: { socialAccountId: account.id },
        data: {
          accessCiphertext: encrypted.accessCiphertext,
          accessIv: encrypted.accessIv,
          accessAuthTag: encrypted.accessAuthTag,
          refreshCiphertext: encrypted.refreshCiphertext,
          refreshIv: encrypted.refreshIv,
          refreshAuthTag: encrypted.refreshAuthTag,
          scopes: encrypted.scopes,
          accessExpiresAt: encrypted.accessExpiresAt,
          refreshExpiresAt: encrypted.refreshExpiresAt,
          keyVersion: encrypted.keyVersion,
        },
      });
      await db.socialAccount.update({
        where: { id: account.id },
        data: {
          status: "CONNECTED",
          tokenExpiresAt: tokens.accessExpiresAt ?? null,
          lastError: null,
        },
      });
    } catch (e) {
      const code =
        e instanceof SocialIntegrationError
          ? e.code
          : e instanceof SocialAnalyticsError
            ? e.code
            : "AUTH_ERROR";
      await db.socialAccount.update({
        where: { id: account.id },
        data: {
          status: "REAUTH_REQUIRED",
          lastError:
            e instanceof Error ? e.message.slice(0, 500) : "Refresh failed",
        },
      });
      throw new SocialAnalyticsError(
        code === "RATE_LIMIT" ? "RATE_LIMIT" : "REAUTH_REQUIRED",
        e instanceof Error ? e.message : "Refresh failed",
      );
    }
  }

  return tokens.accessToken;
}

function mapProviderFailure(e: unknown): IngestPublicationResult["reason"] {
  if (e instanceof SocialAnalyticsError) return e.code;
  if (e instanceof SocialIntegrationError) {
    if (e.code === "AUTH_ERROR" || e.code === "REAUTH_REQUIRED")
      return e.code === "REAUTH_REQUIRED" ? "REAUTH_REQUIRED" : "AUTH_ERROR";
    if (e.code === "RATE_LIMIT") return "RATE_LIMIT";
    if (e.code === "NETWORK_ERROR") return "NETWORK_ERROR";
    if (e.code === "NOT_FOUND") return "NOT_FOUND";
    if (e.code === "FORBIDDEN") return "PERMISSION_DENIED";
  }
  return "PROVIDER_ERROR";
}

async function persistPostMetrics(
  db: Db,
  input: {
    scope: IngestionScope;
    publication: {
      id: string;
      platform: string;
      externalPostId: string;
      publishedAt: Date | null;
      socialAccountId: string;
      contentDraftId: string;
      contentDraft?: { format?: string | null; topic?: string | null } | null;
    };
    result: Extract<PostMetricsResult, { available: true }>;
    metricDate: Date;
  },
): Promise<{ id: string; collectedAt: Date }> {
  const metricDate = utcDateOnly(input.metricDate);
  const externalId = metricSnapshotExternalId(
    input.publication.platform,
    input.publication.externalPostId,
    metricDate,
    input.result.source,
  );
  const collectedAt = new Date(input.result.collectedAt);
  const title =
    input.publication.contentDraft?.topic ||
    input.publication.externalPostId;
  const contentType =
    input.publication.contentDraft?.format || "UNKNOWN";

  const row = await db.contentMetric.upsert({
    where: {
      brandId_externalId: {
        brandId: input.scope.brandId,
        externalId,
      },
    },
    create: {
      brandId: input.scope.brandId,
      workspaceId: input.scope.workspaceId,
      externalId,
      externalPostId: input.publication.externalPostId,
      socialPublicationId: input.publication.id,
      socialAccountId: input.publication.socialAccountId,
      contentDraftId: input.publication.contentDraftId,
      title,
      platform: input.publication.platform,
      contentType,
      status: "published",
      publishedAt: input.publication.publishedAt ?? collectedAt,
      metricDate,
      collectedAt,
      source: input.result.source,
      availability: input.result.availability as Prisma.InputJsonValue,
      rawSanitized: (input.result.rawSanitized ??
        undefined) as Prisma.InputJsonValue | undefined,
      impressions: input.result.metrics.impressions,
      reach: input.result.metrics.reach,
      views: input.result.metrics.views,
      likes: input.result.metrics.likes,
      comments: input.result.metrics.comments,
      shares: input.result.metrics.shares,
      clicks: input.result.metrics.clicks,
      saves: input.result.metrics.saves,
      engagement: input.result.metrics.engagements,
      ctr: null,
    },
    update: {
      collectedAt,
      availability: input.result.availability as Prisma.InputJsonValue,
      rawSanitized: (input.result.rawSanitized ??
        undefined) as Prisma.InputJsonValue | undefined,
      impressions: input.result.metrics.impressions,
      reach: input.result.metrics.reach,
      views: input.result.metrics.views,
      likes: input.result.metrics.likes,
      comments: input.result.metrics.comments,
      shares: input.result.metrics.shares,
      clicks: input.result.metrics.clicks,
      saves: input.result.metrics.saves,
      engagement: input.result.metrics.engagements,
      socialPublicationId: input.publication.id,
      socialAccountId: input.publication.socialAccountId,
      contentDraftId: input.publication.contentDraftId,
      externalPostId: input.publication.externalPostId,
      title,
      contentType,
      source: input.result.source,
    },
  });

  return { id: row.id, collectedAt };
}

export function createSocialAnalyticsIngestionService(deps?: {
  db?: Db;
  analyticsRegistry?: SocialAnalyticsProviderRegistry;
  socialRegistry?: SocialProviderRegistry;
}) {
  const db = deps?.db ?? defaultPrisma;
  const analyticsRegistry =
    deps?.analyticsRegistry ?? getSocialAnalyticsProviderRegistry();
  const socialRegistry =
    deps?.socialRegistry ?? getSocialProviderRegistry();

  async function loadScopedPublication(
    publicationId: string,
    scope: IngestionScope,
  ) {
    const publication = await db.socialPublication.findFirst({
      where: {
        id: publicationId,
        workspaceId: scope.workspaceId,
        brandId: scope.brandId,
      },
      include: {
        contentDraft: { select: { format: true, topic: true } },
        socialAccount: { include: { credential: true } },
      },
    });
    if (!publication) {
      throw new SocialAnalyticsError("NOT_FOUND", "Publication not found", {
        userMessage: "Publication not found.",
      });
    }
    return publication;
  }

  return {
    async ingestPublication(
      publicationId: string,
      scope: IngestionScope,
      opts?: { metricDate?: Date; provider?: SocialAnalyticsProvider },
    ): Promise<IngestPublicationResult> {
      const publication = await loadScopedPublication(publicationId, scope);

      if (!publication.externalPostId) {
        return {
          publicationId,
          available: false,
          reason: "EXTERNAL_POST_ID_MISSING",
          source: null,
          limitations: ["SocialPublication.externalPostId is required"],
        };
      }

      const provider =
        opts?.provider ??
        analyticsRegistry.requireAnalyticsProvider(publication.platform);
      const caps = provider.declaredCapabilities();
      if (!caps.postMetrics) {
        return {
          publicationId,
          available: false,
          reason: "CAPABILITY_NOT_AVAILABLE",
          source: null,
          limitations: [
            `postMetrics not supported for ${publication.platform} with current provider capabilities`,
          ],
        };
      }

      let accessToken: string;
      try {
        accessToken = await resolveAccessToken(
          db,
          socialRegistry,
          publication.socialAccount,
        );
      } catch (e) {
        return {
          publicationId,
          available: false,
          reason: mapProviderFailure(e),
          source: null,
          limitations: [
            e instanceof Error ? e.message.slice(0, 200) : "auth failure",
          ],
        };
      }

      let providerResult: PostMetricsResult;
      try {
        providerResult = await provider.getPostMetrics({
          accessToken,
          externalPostId: publication.externalPostId,
          platformAccountId: publication.socialAccount.platformAccountId,
        });
      } catch (e) {
        return {
          publicationId,
          available: false,
          reason: mapProviderFailure(e),
          source: null,
          limitations: [
            e instanceof Error ? e.message.slice(0, 200) : "provider failure",
          ],
        };
      }

      if (!providerResult.available) {
        return {
          publicationId,
          available: false,
          reason: providerResult.reason,
          source: null,
          limitations: providerResult.limitations,
          collectedAt: providerResult.collectedAt,
        };
      }

      const metricDate = opts?.metricDate ?? new Date();
      const saved = await persistPostMetrics(db, {
        scope,
        publication: {
          id: publication.id,
          platform: publication.platform,
          externalPostId: publication.externalPostId,
          publishedAt: publication.publishedAt,
          socialAccountId: publication.socialAccountId,
          contentDraftId: publication.contentDraftId,
          contentDraft: publication.contentDraft,
        },
        result: providerResult,
        metricDate,
      });

      return {
        publicationId,
        available: true,
        source: providerResult.source,
        contentMetricId: saved.id,
        metrics: providerResult.metrics,
        availability: providerResult.availability,
        collectedAt: saved.collectedAt.toISOString(),
        lastUpdatedAt: saved.collectedAt.toISOString(),
        limitations: providerResult.limitations,
      };
    },

    async syncAccount(input: {
      socialAccountId: string;
      from: string;
      to: string;
      scope: IngestionScope;
      page?: number;
      pageSize?: number;
      provider?: SocialAnalyticsProvider;
    }): Promise<SyncResult> {
      const from = new Date(input.from);
      const to = new Date(input.to);
      assertBoundedRange(from, to);

      const account = await db.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          workspaceId: input.scope.workspaceId,
          brandId: input.scope.brandId,
        },
      });
      if (!account) {
        throw new SocialAnalyticsError("NOT_FOUND", "Social account not found");
      }
      if (account.workspaceId !== input.scope.workspaceId) {
        throw new SocialAnalyticsError("FORBIDDEN", "Wrong workspace");
      }
      if (account.brandId !== input.scope.brandId) {
        throw new SocialAnalyticsError("FORBIDDEN", "Wrong brand");
      }

      const provider =
        input.provider ??
        analyticsRegistry.requireAnalyticsProvider(account.platform);
      const caps = provider.declaredCapabilities();
      if (!caps.postMetrics) {
        return {
          socialAccountId: account.id,
          from: from.toISOString(),
          to: to.toISOString(),
          processed: 0,
          succeeded: 0,
          failed: 0,
          results: [],
          limitations: [
            "CAPABILITY_NOT_AVAILABLE: postMetrics not supported for this account/provider",
          ],
        };
      }

      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.min(
        MAX_BULK_PAGE_SIZE,
        Math.max(1, input.pageSize ?? 20),
      );

      const publications = await db.socialPublication.findMany({
        where: {
          socialAccountId: account.id,
          workspaceId: input.scope.workspaceId,
          brandId: input.scope.brandId,
          status: "PUBLISHED",
          publishedAt: { gte: from, lte: to },
        },
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      const results: IngestPublicationResult[] = [];
      let succeeded = 0;
      let failed = 0;

      for (const pub of publications) {
        const r = await this.ingestPublication(pub.id, input.scope, {
          provider,
          metricDate: new Date(),
        });
        results.push(r);
        if (r.available) succeeded += 1;
        else failed += 1;
      }

      return {
        socialAccountId: account.id,
        from: from.toISOString(),
        to: to.toISOString(),
        processed: publications.length,
        succeeded,
        failed,
        results,
        limitations: [],
      };
    },

    /**
     * Safe entry point for a future scheduler/worker.
     * Manual/API execution is the intended path for now.
     */
    async processAnalyticsSync(input: {
      socialAccountId: string;
      from: string;
      to: string;
      scope: IngestionScope;
    }): Promise<SyncResult> {
      return this.syncAccount(input);
    },

    async getPublicationAnalytics(
      publicationId: string,
      scope: IngestionScope,
    ) {
      const publication = await loadScopedPublication(publicationId, scope);
      const metrics = await db.contentMetric.findMany({
        where: {
          brandId: scope.brandId,
          OR: [
            { socialPublicationId: publicationId },
            ...(publication.externalPostId
              ? [{ externalPostId: publication.externalPostId }]
              : []),
          ],
          NOT: { source: "mock" },
        },
        orderBy: [{ collectedAt: "desc" }, { metricDate: "desc" }],
        take: 30,
      });

      const latest = metrics[0] ?? null;
      if (!latest) {
        const provider = analyticsRegistry.getAnalyticsProvider(
          publication.platform,
        );
        const caps = provider?.declaredCapabilities();
        return {
          available: false,
          reason: !publication.externalPostId
            ? "EXTERNAL_POST_ID_MISSING"
            : caps && !caps.postMetrics
              ? "CAPABILITY_NOT_AVAILABLE"
              : "NO_METRICS",
          publicationId,
          platform: publication.platform,
          externalPostId: publication.externalPostId,
          lastUpdatedAt: null,
          limitations: [
            !publication.externalPostId
              ? "Missing externalPostId"
              : "No ingested metrics yet",
          ],
          metrics: null,
        };
      }

      const availability = (latest.availability ?? {}) as Partial<MetricAvailabilityMap>;
      return {
        available: true,
        source: latest.source,
        publicationId,
        platform: publication.platform,
        externalPostId: publication.externalPostId,
        lastUpdatedAt: (latest.collectedAt ?? latest.updatedAt).toISOString(),
        dataAgeMs: Date.now() - (latest.collectedAt ?? latest.updatedAt).getTime(),
        limitations: [],
        metrics: {
          impressions: availability.impressions === false ? null : latest.impressions,
          reach: availability.reach === false ? null : latest.reach,
          views: availability.views === false ? null : latest.views,
          likes: availability.likes === false ? null : latest.likes,
          comments: availability.comments === false ? null : latest.comments,
          shares: availability.shares === false ? null : latest.shares,
          clicks: availability.clicks === false ? null : latest.clicks,
          engagements:
            availability.engagements === false ? null : latest.engagement,
          saves: availability.saves === false ? null : latest.saves,
        },
        snapshots: metrics.map((m) => ({
          id: m.id,
          metricDate: m.metricDate?.toISOString() ?? null,
          collectedAt: m.collectedAt?.toISOString() ?? null,
          source: m.source,
        })),
      };
    },

    async listBrandAnalytics(scope: IngestionScope, opts?: { limit?: number }) {
      const limit = Math.min(100, Math.max(1, opts?.limit ?? 40));
      const rows = await db.contentMetric.findMany({
        where: {
          brandId: scope.brandId,
          workspaceId: scope.workspaceId,
          NOT: { source: { in: ["mock", "legacy"] } },
          socialPublicationId: { not: null },
        },
        orderBy: { collectedAt: "desc" },
        take: limit,
      });
      const lastUpdatedAt = rows[0]?.collectedAt?.toISOString() ?? null;
      return {
        available: rows.length > 0,
        reason: rows.length === 0 ? "NO_INGESTED_METRICS" : undefined,
        lastUpdatedAt,
        dataAgeMs: lastUpdatedAt
          ? Date.now() - new Date(lastUpdatedAt).getTime()
          : null,
        sampleSize: rows.length,
        items: rows.map((r) => ({
          id: r.id,
          socialPublicationId: r.socialPublicationId,
          externalPostId: r.externalPostId,
          platform: r.platform,
          source: r.source,
          collectedAt: r.collectedAt?.toISOString() ?? null,
          metrics: {
            impressions: r.impressions,
            reach: r.reach,
            views: r.views,
            likes: r.likes,
            comments: r.comments,
            shares: r.shares,
            clicks: r.clicks,
            engagements: r.engagement,
            saves: r.saves,
          },
        })),
      };
    },
  };
}

export type SocialAnalyticsIngestionService = ReturnType<
  typeof createSocialAnalyticsIngestionService
>;

let defaultService: SocialAnalyticsIngestionService | null = null;

export function getSocialAnalyticsIngestionService(): SocialAnalyticsIngestionService {
  if (!defaultService) {
    defaultService = createSocialAnalyticsIngestionService();
  }
  return defaultService;
}

export function resetSocialAnalyticsIngestionService(): void {
  defaultService = null;
}

export function setSocialAnalyticsIngestionServiceForTests(
  service: SocialAnalyticsIngestionService | null,
): void {
  defaultService = service;
}
