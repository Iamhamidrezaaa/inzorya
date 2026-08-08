export type { SocialAnalyticsProvider } from "@/server/social-analytics-ingestion/provider";
export {
  SocialAnalyticsProviderRegistry,
  createDefaultSocialAnalyticsProviderRegistry,
  getSocialAnalyticsProviderRegistry,
  resetSocialAnalyticsProviderRegistry,
  setSocialAnalyticsProviderRegistryForTests,
  isAnalyticsPlatformUnavailable,
  isAnalyticsPlatformRemoved,
} from "@/server/social-analytics-ingestion/registry";
export {
  createSocialAnalyticsIngestionService,
  getSocialAnalyticsIngestionService,
  resetSocialAnalyticsIngestionService,
  setSocialAnalyticsIngestionServiceForTests,
} from "@/server/social-analytics-ingestion/service";
export type {
  IngestPublicationResult,
  SyncResult,
  IngestionScope,
} from "@/server/social-analytics-ingestion/service";
export {
  SocialAnalyticsError,
  MAX_SYNC_RANGE_DAYS,
  EMPTY_METRICS,
} from "@/server/social-analytics-ingestion/types";
export { linkedInAnalyticsProvider } from "@/server/social-analytics-ingestion/providers/linkedin";
export {
  createFakeAnalyticsProvider,
  createUnavailableCapabilityProvider,
} from "@/server/social-analytics-ingestion/providers/fake";
export { socialAnalyticsErrorResponse } from "@/server/social-analytics-ingestion/http";
