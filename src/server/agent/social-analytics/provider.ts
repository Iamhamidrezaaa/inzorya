/**
 * Platform-neutral social analytics concepts for Inzorya.
 * Production connectivity is derived from real stored metrics / Tools —
 * never from fabricated providers.
 */

export const SOCIAL_ANALYTICS_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "tiktok",
  "youtube",
] as const;

export type SocialAnalyticsPlatform =
  (typeof SOCIAL_ANALYTICS_PLATFORMS)[number];

export type PlatformConnectionStatus =
  | "connected"
  | "partially_connected"
  | "not_connected"
  | "error";

export type NormalizedContentMetrics = {
  reach?: number | null;
  impressions?: number | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
  engagement?: number | null;
  /** Platform-specific extras preserved as-is (never invented). */
  extras?: Record<string, number | null>;
};

export type NormalizedContentPerformance = {
  id: string;
  publishedAt?: string | null;
  format?: string | null;
  topic?: string | null;
  channel?: string | null;
  title?: string | null;
  metrics: NormalizedContentMetrics;
};

export type NormalizedPlatformAnalytics = {
  platform: string;
  status: PlatformConnectionStatus;
  period?: { from?: string | null; to?: string | null };
  account?: { name?: string | null; followers?: number | null };
  content: NormalizedContentPerformance[];
  limitations: string[];
};

/**
 * Abstraction over platform-specific analytics.
 * Implementations must only return real connected data or explicit not_connected.
 */
export interface SocialAnalyticsProvider {
  readonly id: string;
  isConfigured(): boolean;
  /**
   * Optional future hook for live platform pulls.
   * Current Inzorya path uses Tool-backed ContentMetric / snapshots instead.
   */
  getNormalized?(input: {
    brandId: string;
    platform?: string;
    from?: string;
    to?: string;
  }): Promise<NormalizedPlatformAnalytics>;
}

/**
 * Default provider: no live social API. Connectivity comes from Agent Tools
 * (analytics.* → ContentMetric / non-mock snapshots).
 */
export class ToolBackedSocialAnalyticsProvider
  implements SocialAnalyticsProvider
{
  readonly id = "tool_backed_content_metrics";

  isConfigured(): boolean {
    // Configured as an abstraction layer; actual data availability is per-brand via Tools.
    return true;
  }
}

let defaultProvider: SocialAnalyticsProvider | null = null;

export function getSocialAnalyticsProvider(): SocialAnalyticsProvider {
  if (!defaultProvider) {
    defaultProvider = new ToolBackedSocialAnalyticsProvider();
  }
  return defaultProvider;
}

export function setSocialAnalyticsProvider(
  provider: SocialAnalyticsProvider | null,
): void {
  defaultProvider = provider;
}

export function resetSocialAnalyticsProvider(): void {
  defaultProvider = null;
}

/**
 * Map Tool availability into platform connection status language.
 * Does not invent connected platforms.
 */
export function statusFromToolAvailability(input: {
  available?: boolean;
  reason?: string;
  platform?: string;
}): {
  platform: string;
  status: PlatformConnectionStatus;
  limitations: string[];
} {
  const platform = (input.platform || "unknown").toLowerCase();
  if (input.available === true) {
    return {
      platform,
      status: "connected",
      limitations: [],
    };
  }
  if (input.reason === "SOCIAL_ANALYTICS_NOT_CONNECTED") {
    return {
      platform,
      status: "not_connected",
      limitations: ["SOCIAL_ANALYTICS_NOT_CONNECTED"],
    };
  }
  if (input.reason) {
    return {
      platform,
      status: "error",
      limitations: [input.reason],
    };
  }
  return {
    platform,
    status: "not_connected",
    limitations: ["SOCIAL_ANALYTICS_NOT_CONNECTED"],
  };
}
