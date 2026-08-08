/** EPIC-017 — Social Analytics Ingestion types (normalized, no credentials). */

export type AnalyticsCapabilityFlags = {
  postMetrics: boolean;
  accountMetrics: boolean;
  audienceMetrics: boolean;
};

export type NormalizedProviderErrorCode =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "NETWORK_ERROR"
  | "CAPABILITY_NOT_AVAILABLE"
  | "INVALID_REQUEST"
  | "PROVIDER_ERROR"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "REAUTH_REQUIRED"
  | "EXTERNAL_POST_ID_MISSING"
  | "FORBIDDEN"
  | "VALIDATION_ERROR";

export class SocialAnalyticsError extends Error {
  readonly code: NormalizedProviderErrorCode;
  readonly retryAfterMs?: number;
  readonly userMessage: string;

  constructor(
    code: NormalizedProviderErrorCode,
    message: string,
    opts?: { retryAfterMs?: number; userMessage?: string },
  ) {
    super(message);
    this.name = "SocialAnalyticsError";
    this.code = code;
    this.retryAfterMs = opts?.retryAfterMs;
    this.userMessage = opts?.userMessage ?? defaultUserMessage(code);
  }
}

function defaultUserMessage(code: NormalizedProviderErrorCode): string {
  switch (code) {
    case "CAPABILITY_NOT_AVAILABLE":
      return "Analytics are not available for this platform with the current connection.";
    case "EXTERNAL_POST_ID_MISSING":
      return "This publication has no external post id to attribute metrics.";
    case "RATE_LIMIT":
      return "The analytics provider is rate-limiting requests. Try again later.";
    case "AUTH_ERROR":
    case "REAUTH_REQUIRED":
      return "Reconnect the social account to continue analytics sync.";
    case "PERMISSION_DENIED":
      return "The connected account does not have permission for analytics.";
    case "NOT_FOUND":
      return "The requested post or account was not found.";
    case "NETWORK_ERROR":
      return "Could not reach the analytics provider.";
    case "FORBIDDEN":
      return "You do not have access to this resource.";
    case "INVALID_REQUEST":
    case "VALIDATION_ERROR":
      return "The analytics request could not be validated.";
    default:
      return "Analytics provider error.";
  }
}

export type NormalizedPostMetrics = {
  impressions: number | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  clicks: number | null;
  engagements: number | null;
  saves: number | null;
};

export type MetricAvailabilityMap = {
  impressions: boolean;
  reach: boolean;
  views: boolean;
  likes: boolean;
  comments: boolean;
  shares: boolean;
  clicks: boolean;
  engagements: boolean;
  saves: boolean;
};

export type PostMetricsResult =
  | {
      available: true;
      source: string;
      collectedAt: string;
      platform: string;
      externalPostId: string;
      publishedAt?: string | null;
      metrics: NormalizedPostMetrics;
      availability: MetricAvailabilityMap;
      limitations: string[];
      /** Sanitized raw extras — never credentials */
      rawSanitized?: Record<string, unknown> | null;
    }
  | {
      available: false;
      source: null;
      reason: NormalizedProviderErrorCode;
      limitations: string[];
      collectedAt?: string;
    };

export type AccountMetricsResult =
  | {
      available: true;
      source: string;
      collectedAt: string;
      platform: string;
      metrics: {
        followers: number | null;
        profileViews: number | null;
        accountImpressions: number | null;
      };
      limitations: string[];
    }
  | {
      available: false;
      source: null;
      reason: NormalizedProviderErrorCode;
      limitations: string[];
    };

export type AudienceMetricsResult =
  | {
      available: true;
      source: string;
      collectedAt: string;
      platform: string;
      segments: Record<string, unknown>;
      limitations: string[];
    }
  | {
      available: false;
      source: null;
      reason: NormalizedProviderErrorCode;
      limitations: string[];
    };

export type AnalyticsProviderDescriptor = {
  platform: string;
  displayName: string;
  capabilities: AnalyticsCapabilityFlags;
  /** True when env credentials exist (does NOT imply analytics access). */
  configured: boolean;
  /** LIVE_VERIFIED | MOCK_VERIFIED | CONFIGURED_BUT_NOT_AVAILABLE | CAPABILITY_NOT_AVAILABLE | UNAVAILABLE | REMOVED */
  verificationStatus: string;
};

export const EMPTY_METRICS: NormalizedPostMetrics = {
  impressions: null,
  reach: null,
  views: null,
  likes: null,
  comments: null,
  shares: null,
  clicks: null,
  engagements: null,
  saves: null,
};

export const EMPTY_AVAILABILITY: MetricAvailabilityMap = {
  impressions: false,
  reach: false,
  views: false,
  likes: false,
  comments: false,
  shares: false,
  clicks: false,
  engagements: false,
  saves: false,
};

export function availabilityFromMetrics(
  metrics: NormalizedPostMetrics,
): MetricAvailabilityMap {
  return {
    impressions: metrics.impressions != null,
    reach: metrics.reach != null,
    views: metrics.views != null,
    likes: metrics.likes != null,
    comments: metrics.comments != null,
    shares: metrics.shares != null,
    clicks: metrics.clicks != null,
    engagements: metrics.engagements != null,
    saves: metrics.saves != null,
  };
}

export const MAX_SYNC_RANGE_DAYS = 90;
export const MAX_BULK_PAGE_SIZE = 50;
