import type { SocialAnalyticsProvider } from "@/server/social-analytics-ingestion/provider";
import type {
  AccountMetricsResult,
  AnalyticsCapabilityFlags,
  AnalyticsProviderDescriptor,
  AudienceMetricsResult,
  PostMetricsResult,
} from "@/server/social-analytics-ingestion/types";
import { getLinkedInConfig } from "@/server/social/providers/linkedin";

/**
 * LinkedIn member analytics require scopes such as r_member_postAnalytics /
 * organization admin analytics — NOT present in current OAuth:
 * openid, profile, email, w_member_social.
 *
 * OAuth connection ≠ analytics access.
 * Live status: CAPABILITY_NOT_AVAILABLE (do not request scopes silently).
 */
export const LINKEDIN_ANALYTICS_CAPABILITIES: AnalyticsCapabilityFlags = {
  postMetrics: false,
  accountMetrics: false,
  audienceMetrics: false,
};

export const LINKEDIN_ANALYTICS_SOURCE = "LINKEDIN_API";

function capabilityUnavailable(
  limitation: string,
): PostMetricsResult & AccountMetricsResult & AudienceMetricsResult {
  return {
    available: false,
    source: null,
    reason: "CAPABILITY_NOT_AVAILABLE",
    limitations: [limitation],
  };
}

export const linkedInAnalyticsProvider: SocialAnalyticsProvider = {
  platform: "linkedin",
  displayName: "LinkedIn",

  declaredCapabilities() {
    return { ...LINKEDIN_ANALYTICS_CAPABILITIES };
  },

  isConfigured() {
    return getLinkedInConfig().configured;
  },

  descriptor(): AnalyticsProviderDescriptor {
    const configured = getLinkedInConfig().configured;
    return {
      platform: "linkedin",
      displayName: "LinkedIn",
      capabilities: { ...LINKEDIN_ANALYTICS_CAPABILITIES },
      configured,
      verificationStatus: configured
        ? "CAPABILITY_NOT_AVAILABLE"
        : "UNAVAILABLE",
    };
  },

  async getPostMetrics(): Promise<PostMetricsResult> {
    return capabilityUnavailable(
      "Current LinkedIn OAuth scopes (openid/profile/email/w_member_social) do not include post analytics. Additional permissions were not requested.",
    );
  },

  async getAccountMetrics(): Promise<AccountMetricsResult> {
    return capabilityUnavailable(
      "LinkedIn account analytics are not available with the current authorized scopes.",
    );
  },

  async getAudienceMetrics(): Promise<AudienceMetricsResult> {
    return capabilityUnavailable(
      "LinkedIn audience analytics are not available with the current authorized scopes.",
    );
  },
};
