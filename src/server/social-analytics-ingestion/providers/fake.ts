import type { SocialAnalyticsProvider } from "@/server/social-analytics-ingestion/provider";
import type {
  AccountMetricsResult,
  AnalyticsCapabilityFlags,
  PostMetricsResult,
} from "@/server/social-analytics-ingestion/types";
import {
  EMPTY_METRICS,
  SocialAnalyticsError,
  availabilityFromMetrics,
} from "@/server/social-analytics-ingestion/types";

export type FakePostMetricSeed = {
  externalPostId: string;
  metrics?: Partial<{
    impressions: number | null;
    reach: number | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    clicks: number | null;
    engagements: number | null;
    saves: number | null;
  }>;
  failWith?: "AUTH_ERROR" | "RATE_LIMIT" | "NETWORK_ERROR" | "NOT_FOUND";
  retryAfterMs?: number;
};

/**
 * Test-only analytics provider. Never used for production ingestion.
 * Source label remains a real-looking API source so tools can distinguish
 * MOCK path via registry injection, not stored source="MOCK".
 */
export function createFakeAnalyticsProvider(opts?: {
  platform?: string;
  capabilities?: Partial<AnalyticsCapabilityFlags>;
  posts?: FakePostMetricSeed[];
  accountFollowers?: number | null;
  source?: string;
}): SocialAnalyticsProvider {
  const platform = opts?.platform ?? "linkedin";
  const capabilities: AnalyticsCapabilityFlags = {
    postMetrics: opts?.capabilities?.postMetrics ?? true,
    accountMetrics: opts?.capabilities?.accountMetrics ?? false,
    audienceMetrics: opts?.capabilities?.audienceMetrics ?? false,
  };
  const posts = new Map(
    (opts?.posts ?? []).map((p) => [p.externalPostId, p] as const),
  );
  const source = opts?.source ?? "LINKEDIN_API";

  return {
    platform,
    displayName: `Fake ${platform}`,
    declaredCapabilities: () => ({ ...capabilities }),
    isConfigured: () => true,
    descriptor: () => ({
      platform,
      displayName: `Fake ${platform}`,
      capabilities: { ...capabilities },
      configured: true,
      verificationStatus: "MOCK_VERIFIED",
    }),
    async getPostMetrics(input): Promise<PostMetricsResult> {
      if (!capabilities.postMetrics) {
        return {
          available: false,
          source: null,
          reason: "CAPABILITY_NOT_AVAILABLE",
          limitations: ["postMetrics capability disabled on fake provider"],
        };
      }
      const seed = posts.get(input.externalPostId);
      if (seed?.failWith) {
        throw new SocialAnalyticsError(seed.failWith, `Fake ${seed.failWith}`, {
          retryAfterMs: seed.retryAfterMs,
        });
      }
      if (!seed) {
        throw new SocialAnalyticsError(
          "NOT_FOUND",
          `No fake metrics for ${input.externalPostId}`,
        );
      }
      const metrics = { ...EMPTY_METRICS, ...seed.metrics };
      return {
        available: true,
        source,
        collectedAt: new Date().toISOString(),
        platform,
        externalPostId: input.externalPostId,
        metrics,
        availability: availabilityFromMetrics(metrics),
        limitations: [],
        rawSanitized: { fake: true },
      };
    },
    async getAccountMetrics(): Promise<AccountMetricsResult> {
      if (!capabilities.accountMetrics) {
        return {
          available: false,
          source: null,
          reason: "CAPABILITY_NOT_AVAILABLE",
          limitations: ["accountMetrics capability disabled"],
        };
      }
      return {
        available: true,
        source,
        collectedAt: new Date().toISOString(),
        platform,
        metrics: {
          followers: opts?.accountFollowers ?? null,
          profileViews: null,
          accountImpressions: null,
        },
        limitations: ["Only followers seeded in fake provider"],
      };
    },
  };
}

/** Provider that always reports capability unavailable (for TEST 3). */
export function createUnavailableCapabilityProvider(
  platform = "linkedin",
): SocialAnalyticsProvider {
  return {
    platform,
    displayName: platform,
    declaredCapabilities: () => ({
      postMetrics: false,
      accountMetrics: false,
      audienceMetrics: false,
    }),
    isConfigured: () => true,
    descriptor: () => ({
      platform,
      displayName: platform,
      capabilities: {
        postMetrics: false,
        accountMetrics: false,
        audienceMetrics: false,
      },
      configured: true,
      verificationStatus: "CAPABILITY_NOT_AVAILABLE",
    }),
    async getPostMetrics(): Promise<PostMetricsResult> {
      return {
        available: false,
        source: null,
        reason: "CAPABILITY_NOT_AVAILABLE",
        limitations: ["Analytics capability not available"],
      };
    },
  };
}
