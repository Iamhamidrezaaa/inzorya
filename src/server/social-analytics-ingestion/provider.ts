import type {
  AccountMetricsResult,
  AnalyticsCapabilityFlags,
  AnalyticsProviderDescriptor,
  AudienceMetricsResult,
  PostMetricsResult,
} from "@/server/social-analytics-ingestion/types";

/**
 * EPIC-017 — SocialAnalyticsProvider for metrics ingestion.
 * Distinct from the agent-layer conceptual provider in social-analytics/provider.ts
 * (which reads stored ContentMetric via Tools). This interface talks to platforms.
 */
export interface SocialAnalyticsProvider {
  readonly platform: string;
  readonly displayName: string;
  declaredCapabilities(): AnalyticsCapabilityFlags;
  isConfigured(): boolean;
  descriptor(): AnalyticsProviderDescriptor;
  getPostMetrics(input: {
    accessToken: string;
    externalPostId: string;
    platformAccountId?: string;
  }): Promise<PostMetricsResult>;
  getAccountMetrics?(input: {
    accessToken: string;
    platformAccountId: string;
  }): Promise<AccountMetricsResult>;
  getAudienceMetrics?(input: {
    accessToken: string;
    platformAccountId: string;
  }): Promise<AudienceMetricsResult>;
}
