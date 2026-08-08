import type {
  SocialAccountProfile,
  SocialAuthType,
  SocialCapabilityFlags,
  SocialProviderDescriptor,
  SocialTokenBundle,
} from "@/server/social/types";

export type StartConnectResult = {
  authorizationUrl: string;
  state: string;
};

export type CompleteConnectResult = {
  tokens: SocialTokenBundle;
  profile: SocialAccountProfile;
};

export type RefreshResult = {
  tokens: SocialTokenBundle;
};

export type ProviderHealthResult = {
  healthy: boolean;
  requiresReauth?: boolean;
  message?: string;
};

/**
 * Platform-neutral social provider contract.
 * Capabilities must reflect verified support — never inferred from API keys alone.
 */
export interface SocialPlatformProvider {
  readonly platform: string;
  readonly displayName: string;
  readonly authType: SocialAuthType;
  /** Static declared capabilities for this provider implementation. */
  declaredCapabilities(): SocialCapabilityFlags;
  /** True when env/config needed for live OAuth/API is present. */
  isConfigured(): boolean;
  descriptor(): SocialProviderDescriptor;
  startConnect(input: {
    redirectUri: string;
    state: string;
    scopes?: string[];
  }): Promise<StartConnectResult>;
  completeConnect(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
  }): Promise<CompleteConnectResult>;
  refreshTokens?(tokens: SocialTokenBundle): Promise<RefreshResult>;
  fetchAccountInfo(tokens: SocialTokenBundle): Promise<SocialAccountProfile>;
  healthCheck?(tokens: SocialTokenBundle): Promise<ProviderHealthResult>;
}

/** Optional future publisher — not auto-wired to UI actions in this EPIC. */
export interface SocialPublisher {
  validate(input: unknown): Promise<{ ok: boolean; errors: string[] }>;
  uploadMedia?(input: unknown): Promise<{ mediaId: string }>;
  publish?(input: unknown): Promise<{ externalPostId: string }>;
}
