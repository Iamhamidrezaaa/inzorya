import type {
  CompleteConnectResult,
  ProviderHealthResult,
  RefreshResult,
  SocialPlatformProvider,
  StartConnectResult,
} from "@/server/social/provider";
import type {
  SocialCapabilityFlags,
  SocialProviderDescriptor,
  SocialTokenBundle,
} from "@/server/social/types";
import { SocialIntegrationError } from "@/server/social/types";

export type LinkedInHttpClient = {
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
  }): Promise<SocialTokenBundle>;
  refresh(input: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<SocialTokenBundle>;
  fetchProfile(accessToken: string): Promise<{
    platformAccountId: string;
    accountName?: string | null;
    username?: string | null;
    profileUrl?: string | null;
    profileImageUrl?: string | null;
  }>;
};

/** Declared capabilities — text publishing path implemented (MOCK_VERIFIED). */
export const LINKEDIN_CAPABILITIES: SocialCapabilityFlags = {
  connect: true,
  accountInfo: true,
  profile: true,
  publishing: true,
  analytics: false,
  mediaUpload: false,
  deleteContent: false,
};

export const LINKEDIN_SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
] as const;

export function linkedInCapabilitiesFromScopes(
  scopes: string[],
): SocialCapabilityFlags {
  const normalized = scopes.map((s) => s.toLowerCase());
  const canPublish = normalized.some((s) => s.includes("w_member_social"));
  return {
    ...LINKEDIN_CAPABILITIES,
    publishing: canPublish,
  };
}

export function getLinkedInConfig() {
  const clientId = (process.env.LINKEDIN_CLIENT_ID || "").trim();
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET || "").trim();
  const base =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  const redirectUri = (
    process.env.LINKEDIN_OAUTH_REDIRECT_URI ||
    `${base.replace(/\/$/, "")}/api/social/accounts/linkedin/callback`
  ).trim();
  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret),
  };
}

function mapLinkedInHttpError(status: number, body: string): never {
  if (status === 401 || status === 403) {
    throw new SocialIntegrationError(
      "AUTH_ERROR",
      `LinkedIn auth failed (${status}): ${body.slice(0, 200)}`,
    );
  }
  if (status === 429) {
    throw new SocialIntegrationError(
      "RATE_LIMIT",
      `LinkedIn rate limit: ${body.slice(0, 200)}`,
    );
  }
  throw new SocialIntegrationError(
    "PROVIDER_ERROR",
    `LinkedIn request failed (${status}): ${body.slice(0, 200)}`,
  );
}

export const liveLinkedInHttpClient: LinkedInHttpClient = {
  async exchangeCode(input) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    });
    let res: Response;
    try {
      res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (e) {
      throw new SocialIntegrationError(
        "NETWORK_ERROR",
        e instanceof Error ? e.message : "LinkedIn network error",
      );
    }
    const text = await res.text();
    if (!res.ok) mapLinkedInHttpError(res.status, text);
    const json = JSON.parse(text) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_token_expires_in?: number;
      scope?: string;
      token_type?: string;
    };
    if (!json.access_token) {
      throw new SocialIntegrationError(
        "PROVIDER_ERROR",
        "LinkedIn token response missing access_token",
      );
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      tokenType: json.token_type || "Bearer",
      scopes: (json.scope || LINKEDIN_SCOPES.join(" ")).split(/[ ,]+/).filter(Boolean),
      accessExpiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000)
        : null,
      refreshExpiresAt: json.refresh_token_expires_in
        ? new Date(Date.now() + json.refresh_token_expires_in * 1000)
        : null,
    };
  },

  async refresh(input) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    });
    let res: Response;
    try {
      res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (e) {
      throw new SocialIntegrationError(
        "NETWORK_ERROR",
        e instanceof Error ? e.message : "LinkedIn network error",
      );
    }
    const text = await res.text();
    if (!res.ok) mapLinkedInHttpError(res.status, text);
    const json = JSON.parse(text) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_token_expires_in?: number;
      scope?: string;
      token_type?: string;
    };
    if (!json.access_token) {
      throw new SocialIntegrationError(
        "REAUTH_REQUIRED",
        "LinkedIn refresh did not return access_token",
      );
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? input.refreshToken,
      tokenType: json.token_type || "Bearer",
      scopes: (json.scope || LINKEDIN_SCOPES.join(" ")).split(/[ ,]+/).filter(Boolean),
      accessExpiresAt: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000)
        : null,
      refreshExpiresAt: json.refresh_token_expires_in
        ? new Date(Date.now() + json.refresh_token_expires_in * 1000)
        : null,
    };
  },

  async fetchProfile(accessToken) {
    let res: Response;
    try {
      res = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (e) {
      throw new SocialIntegrationError(
        "NETWORK_ERROR",
        e instanceof Error ? e.message : "LinkedIn network error",
      );
    }
    const text = await res.text();
    if (!res.ok) mapLinkedInHttpError(res.status, text);
    const json = JSON.parse(text) as {
      sub?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      email?: string;
      picture?: string;
    };
    if (!json.sub) {
      throw new SocialIntegrationError(
        "PROVIDER_ERROR",
        "LinkedIn profile missing sub",
      );
    }
    const name =
      json.name ||
      [json.given_name, json.family_name].filter(Boolean).join(" ") ||
      json.email ||
      null;
    return {
      platformAccountId: json.sub,
      accountName: name,
      username: json.email ?? null,
      profileUrl: null,
      profileImageUrl: json.picture ?? null,
    };
  },
};

export function createLinkedInProvider(
  http: LinkedInHttpClient = liveLinkedInHttpClient,
): SocialPlatformProvider {
  return {
    platform: "linkedin",
    displayName: "LinkedIn",
    authType: "oauth2",

    declaredCapabilities() {
      return { ...LINKEDIN_CAPABILITIES };
    },

    isConfigured() {
      return getLinkedInConfig().configured;
    },

    descriptor(): SocialProviderDescriptor {
      const configured = this.isConfigured();
      return {
        platform: "linkedin",
        displayName: "LinkedIn",
        authType: "oauth2",
        configured,
        capabilities: {
          ...LINKEDIN_CAPABILITIES,
          // Connect only when credentials exist
          connect: configured && LINKEDIN_CAPABILITIES.connect,
        },
      };
    },

    async startConnect(input): Promise<StartConnectResult> {
      const config = getLinkedInConfig();
      if (!config.configured) {
        throw new SocialIntegrationError(
          "VALIDATION_ERROR",
          "LinkedIn credentials are not configured",
          "LinkedIn is not configured yet.",
        );
      }
      const scopes = (input.scopes?.length
        ? input.scopes
        : [...LINKEDIN_SCOPES]
      ).join(" ");
      const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", input.redirectUri || config.redirectUri);
      url.searchParams.set("state", input.state);
      url.searchParams.set("scope", scopes);
      return { authorizationUrl: url.toString(), state: input.state };
    },

    async completeConnect(input): Promise<CompleteConnectResult> {
      const config = getLinkedInConfig();
      if (!config.configured) {
        throw new SocialIntegrationError(
          "VALIDATION_ERROR",
          "LinkedIn credentials are not configured",
        );
      }
      const tokens = await http.exchangeCode({
        code: input.code,
        redirectUri: input.redirectUri || config.redirectUri,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
      const profile = await http.fetchProfile(tokens.accessToken);
      return { tokens, profile };
    },

    async refreshTokens(tokens: SocialTokenBundle): Promise<RefreshResult> {
      const config = getLinkedInConfig();
      if (!tokens.refreshToken) {
        throw new SocialIntegrationError(
          "REAUTH_REQUIRED",
          "No LinkedIn refresh token available",
        );
      }
      const refreshed = await http.refresh({
        refreshToken: tokens.refreshToken,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
      return { tokens: refreshed };
    },

    async fetchAccountInfo(tokens: SocialTokenBundle) {
      return http.fetchProfile(tokens.accessToken);
    },

    async healthCheck(tokens: SocialTokenBundle): Promise<ProviderHealthResult> {
      try {
        await http.fetchProfile(tokens.accessToken);
        return { healthy: true };
      } catch (e) {
        if (e instanceof SocialIntegrationError) {
          if (e.code === "AUTH_ERROR" || e.code === "REAUTH_REQUIRED") {
            return { healthy: false, requiresReauth: true, message: e.message };
          }
          return { healthy: false, message: e.message };
        }
        return {
          healthy: false,
          message: e instanceof Error ? e.message : "health check failed",
        };
      }
    },
  };
}

export const linkedInProvider = createLinkedInProvider();
