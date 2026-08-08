import type { SocialAccountStatus } from "@prisma/client";

export type SocialPlatformId = string;

export type SocialAuthType = "oauth2" | "api_key" | "none";

export type SocialCapabilityFlags = {
  connect: boolean;
  accountInfo: boolean;
  profile: boolean;
  publishing: boolean;
  analytics: boolean;
  mediaUpload: boolean;
  deleteContent: boolean;
};

export type SocialProviderDescriptor = {
  platform: SocialPlatformId;
  displayName: string;
  authType: SocialAuthType;
  capabilities: SocialCapabilityFlags;
  /** True only when credentials/config exist for live use. */
  configured: boolean;
};

export type NormalizedSocialErrorCode =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "VALIDATION_ERROR"
  | "PROVIDER_ERROR"
  | "NETWORK_ERROR"
  | "UNSUPPORTED_CAPABILITY"
  | "UNSUPPORTED_PLATFORM"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "PUBLISH_REQUIRES_APPROVAL"
  | "REAUTH_REQUIRED";

export class SocialIntegrationError extends Error {
  readonly code: NormalizedSocialErrorCode;
  readonly userMessage: string;

  constructor(
    code: NormalizedSocialErrorCode,
    message: string,
    userMessage?: string,
  ) {
    super(message);
    this.name = "SocialIntegrationError";
    this.code = code;
    this.userMessage = userMessage ?? defaultUserMessage(code);
  }
}

function defaultUserMessage(code: NormalizedSocialErrorCode): string {
  switch (code) {
    case "AUTH_ERROR":
    case "REAUTH_REQUIRED":
      return "Connection expired. Reconnect to continue.";
    case "RATE_LIMIT":
      return "The platform is rate-limiting requests. Try again later.";
    case "VALIDATION_ERROR":
      return "This action could not be validated.";
    case "UNSUPPORTED_CAPABILITY":
      return "This capability is not available for this account.";
    case "UNSUPPORTED_PLATFORM":
      return "This platform is not available in Inzorya yet.";
    case "PUBLISH_REQUIRES_APPROVAL":
      return "Content must be approved and marked Ready before publishing.";
    case "FORBIDDEN":
      return "You do not have access to this account.";
    case "NOT_FOUND":
      return "Social account not found.";
    case "NETWORK_ERROR":
      return "Could not reach the platform. Try again later.";
    default:
      return "Something went wrong with this social connection.";
  }
}

export type SocialAccountProfile = {
  platformAccountId: string;
  accountName?: string | null;
  username?: string | null;
  profileUrl?: string | null;
  profileImageUrl?: string | null;
};

export type SocialTokenBundle = {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string;
  scopes: string[];
  accessExpiresAt?: Date | null;
  refreshExpiresAt?: Date | null;
};

export type SocialPublicAccount = {
  id: string;
  workspaceId: string;
  brandId: string;
  platform: string;
  platformAccountId: string;
  accountName: string | null;
  username: string | null;
  profileUrl: string | null;
  profileImageUrl: string | null;
  status: SocialAccountStatus;
  capabilities: SocialCapabilityFlags;
  scopes: string[];
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** Never includes tokens */
};

export type PublishRequest = {
  draftId: string;
  socialAccountId: string;
  platform: string;
  media?: unknown[];
  caption?: string;
  scheduledAt?: string | null;
};

export type PublishValidationResult = {
  ok: boolean;
  errors: Array<{ code: NormalizedSocialErrorCode; message: string }>;
};

/** Safe public capability view for API/UI/Agents. */
export function publicCapabilities(
  flags: SocialCapabilityFlags,
): Record<string, boolean> {
  return {
    accountInfo: flags.accountInfo,
    profile: flags.profile,
    publishing: flags.publishing,
    analytics: flags.analytics,
    mediaUpload: flags.mediaUpload,
    deleteContent: flags.deleteContent,
    connect: flags.connect,
  };
}
