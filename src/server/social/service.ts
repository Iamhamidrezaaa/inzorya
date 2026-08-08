import type { Prisma, SocialAccountStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createOAuthStateToken,
  decryptTokenBundle,
  encryptTokenBundle,
  hashOAuthState,
} from "@/server/social/credentials";
import type { SocialPlatformProvider } from "@/server/social/provider";
import {
  getSocialProviderRegistry,
  type SocialProviderRegistry,
} from "@/server/social/registry";
import {
  publicCapabilities,
  SocialIntegrationError,
  type SocialCapabilityFlags,
  type SocialPublicAccount,
  type SocialTokenBundle,
} from "@/server/social/types";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseCapabilities(raw: unknown): SocialCapabilityFlags {
  const c = (raw || {}) as Partial<SocialCapabilityFlags>;
  return {
    connect: Boolean(c.connect),
    accountInfo: Boolean(c.accountInfo),
    profile: Boolean(c.profile),
    publishing: Boolean(c.publishing),
    analytics: Boolean(c.analytics),
    mediaUpload: Boolean(c.mediaUpload),
    deleteContent: Boolean(c.deleteContent),
  };
}

function toPublicAccount(row: {
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
  capabilities: unknown;
  scopes: string[];
  tokenExpiresAt: Date | null;
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
}): SocialPublicAccount {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    brandId: row.brandId,
    platform: row.platform,
    platformAccountId: row.platformAccountId,
    accountName: row.accountName,
    username: row.username,
    profileUrl: row.profileUrl,
    profileImageUrl: row.profileImageUrl,
    status: row.status,
    capabilities: parseCapabilities(row.capabilities),
    scopes: row.scopes,
    tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}

export type SocialAccountsServiceOptions = {
  registry?: SocialProviderRegistry;
  prismaClient?: typeof prisma;
};

export function createSocialAccountsService(
  options: SocialAccountsServiceOptions = {},
) {
  const db = options.prismaClient ?? prisma;
  const registry = options.registry ?? getSocialProviderRegistry();

  async function requireScopedAccount(
    id: string,
    scope: { workspaceId: string; brandId: string },
  ) {
    const account = await db.socialAccount.findUnique({
      where: { id },
      include: { credential: true },
    });
    if (!account || account.disconnectedAt) {
      throw new SocialIntegrationError("NOT_FOUND", "Social account not found.");
    }
    if (
      account.workspaceId !== scope.workspaceId ||
      account.brandId !== scope.brandId
    ) {
      throw new SocialIntegrationError(
        "FORBIDDEN",
        "Social account is outside workspace/brand scope.",
      );
    }
    return account;
  }

  async function persistCredentials(
    socialAccountId: string,
    tokens: SocialTokenBundle,
  ) {
    const enc = encryptTokenBundle(tokens);
    await db.socialAccountCredential.upsert({
      where: { socialAccountId },
      create: {
        socialAccountId,
        ...enc,
      },
      update: {
        ...enc,
      },
    });
  }

  return {
    listProviders() {
      return registry.listProviders().map((p) => p.descriptor());
    },

    async listAccounts(scope: { workspaceId: string; brandId: string }) {
      const rows = await db.socialAccount.findMany({
        where: {
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
          disconnectedAt: null,
          status: { not: "DISCONNECTED" },
        },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toPublicAccount);
    },

    async getAccount(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const account = await requireScopedAccount(id, scope);
      return toPublicAccount(account);
    },

    async getCapabilities(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const account = await requireScopedAccount(id, scope);
      const caps = parseCapabilities(account.capabilities);
      return {
        platform: account.platform,
        account: account.accountName || account.username || account.platformAccountId,
        capabilities: publicCapabilities(caps),
      };
    },

    async startConnect(input: {
      platform: string;
      userId: string;
      workspaceId: string;
      brandId: string;
    }) {
      const provider = registry.requireProvider(input.platform);
      if (!provider.isConfigured()) {
        throw new SocialIntegrationError(
          "VALIDATION_ERROR",
          `${provider.displayName} is not configured`,
          `${provider.displayName} is not configured yet.`,
        );
      }

      const state = createOAuthStateToken();
      const redirectUri =
        provider.platform === "linkedin"
          ? (process.env.LINKEDIN_OAUTH_REDIRECT_URI ||
              `${(process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")}/api/social/accounts/linkedin/callback`)
          : "";

      await db.socialOAuthState.create({
        data: {
          stateHash: hashOAuthState(state),
          userId: input.userId,
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          platform: provider.platform,
          redirectUri,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          status: "PENDING",
        },
      });

      const started = await provider.startConnect({
        redirectUri,
        state,
      });

      return {
        authorizationUrl: started.authorizationUrl,
        platform: provider.platform,
        state,
      };
    },

    /**
     * Completes OAuth. Scope comes from stored state — never from client.
     */
    async completeConnect(input: {
      platform: string;
      code: string;
      state: string;
      userId: string;
    }) {
      const provider = registry.requireProvider(input.platform);
      const stateHash = hashOAuthState(input.state);
      const oauthState = await db.socialOAuthState.findUnique({
        where: { stateHash },
      });

      if (!oauthState) {
        throw new SocialIntegrationError(
          "VALIDATION_ERROR",
          "Invalid OAuth state",
          "Connection could not be verified. Please try again.",
        );
      }
      if (oauthState.status !== "PENDING") {
        throw new SocialIntegrationError(
          "VALIDATION_ERROR",
          "OAuth state already used",
          "Connection could not be verified. Please try again.",
        );
      }
      if (oauthState.expiresAt.getTime() < Date.now()) {
        await db.socialOAuthState.update({
          where: { id: oauthState.id },
          data: { status: "EXPIRED" },
        });
        throw new SocialIntegrationError(
          "VALIDATION_ERROR",
          "OAuth state expired",
          "Connection timed out. Please try again.",
        );
      }
      if (oauthState.userId !== input.userId) {
        throw new SocialIntegrationError(
          "FORBIDDEN",
          "OAuth state user mismatch",
          "Connection could not be verified.",
        );
      }
      if (oauthState.platform !== provider.platform) {
        throw new SocialIntegrationError(
          "VALIDATION_ERROR",
          "OAuth state platform mismatch",
        );
      }

      // Consume state (single-use)
      await db.socialOAuthState.update({
        where: { id: oauthState.id },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });

      let completed;
      try {
        completed = await provider.completeConnect({
          code: input.code,
          redirectUri: oauthState.redirectUri,
        });
      } catch (e) {
        await db.socialOAuthState.update({
          where: { id: oauthState.id },
          data: {
            status: "FAILED",
            error: e instanceof Error ? e.message.slice(0, 500) : "connect failed",
          },
        });
        throw e;
      }

      const caps =
        provider.platform === "linkedin"
          ? (
              await import("@/server/social/providers/linkedin")
            ).linkedInCapabilitiesFromScopes(completed.tokens.scopes)
          : provider.declaredCapabilities();
      const existing = await db.socialAccount.findFirst({
        where: {
          brandId: oauthState.brandId,
          platform: provider.platform,
          platformAccountId: completed.profile.platformAccountId,
        },
      });

      const account = existing
        ? await db.socialAccount.update({
            where: { id: existing.id },
            data: {
              workspaceId: oauthState.workspaceId,
              accountName: completed.profile.accountName ?? null,
              username: completed.profile.username ?? null,
              profileUrl: completed.profile.profileUrl ?? null,
              profileImageUrl: completed.profile.profileImageUrl ?? null,
              status: "CONNECTED",
              capabilities: asJson(caps),
              scopes: completed.tokens.scopes,
              tokenExpiresAt: completed.tokens.accessExpiresAt ?? null,
              connectedAt: existing.connectedAt ?? new Date(),
              lastSyncedAt: new Date(),
              lastError: null,
              disconnectedAt: null,
            },
          })
        : await db.socialAccount.create({
            data: {
              workspaceId: oauthState.workspaceId,
              brandId: oauthState.brandId,
              platform: provider.platform,
              platformAccountId: completed.profile.platformAccountId,
              accountName: completed.profile.accountName ?? null,
              username: completed.profile.username ?? null,
              profileUrl: completed.profile.profileUrl ?? null,
              profileImageUrl: completed.profile.profileImageUrl ?? null,
              status: "CONNECTED",
              capabilities: asJson(caps),
              scopes: completed.tokens.scopes,
              tokenExpiresAt: completed.tokens.accessExpiresAt ?? null,
              connectedAt: new Date(),
              lastSyncedAt: new Date(),
            },
          });

      await persistCredentials(account.id, completed.tokens);
      return toPublicAccount(account);
    },

    /** Test/helper: create connected account without live OAuth. */
    async upsertConnectedAccountForTests(input: {
      workspaceId: string;
      brandId: string;
      platform: string;
      profile: {
        platformAccountId: string;
        accountName?: string | null;
        username?: string | null;
        profileUrl?: string | null;
        profileImageUrl?: string | null;
      };
      tokens: SocialTokenBundle;
      status?: SocialAccountStatus;
      capabilities?: SocialCapabilityFlags;
    }) {
      const provider = registry.requireProvider(input.platform);
      const caps = input.capabilities ?? provider.declaredCapabilities();
      const account = await db.socialAccount.upsert({
        where: {
          brandId_platform_platformAccountId: {
            brandId: input.brandId,
            platform: provider.platform,
            platformAccountId: input.profile.platformAccountId,
          },
        },
        create: {
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          platform: provider.platform,
          platformAccountId: input.profile.platformAccountId,
          accountName: input.profile.accountName ?? null,
          username: input.profile.username ?? null,
          profileUrl: input.profile.profileUrl ?? null,
          profileImageUrl: input.profile.profileImageUrl ?? null,
          status: input.status ?? "CONNECTED",
          capabilities: asJson(caps),
          scopes: input.tokens.scopes,
          tokenExpiresAt: input.tokens.accessExpiresAt ?? null,
          connectedAt: new Date(),
          lastSyncedAt: new Date(),
        },
        update: {
          status: input.status ?? "CONNECTED",
          capabilities: asJson(caps),
          scopes: input.tokens.scopes,
          tokenExpiresAt: input.tokens.accessExpiresAt ?? null,
          lastSyncedAt: new Date(),
          lastError: null,
          disconnectedAt: null,
        },
      });
      await persistCredentials(account.id, input.tokens);
      return toPublicAccount(account);
    },

    async refreshAccount(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const account = await requireScopedAccount(id, scope);
      if (!account.credential) {
        await db.socialAccount.update({
          where: { id },
          data: { status: "REAUTH_REQUIRED", lastError: "Missing credentials" },
        });
        throw new SocialIntegrationError(
          "REAUTH_REQUIRED",
          "Missing credentials",
        );
      }

      const provider = registry.requireProvider(account.platform);
      const tokens = decryptTokenBundle(account.credential);

      const expired =
        tokens.accessExpiresAt &&
        tokens.accessExpiresAt.getTime() <= Date.now();

      if (expired && !tokens.refreshToken) {
        const updated = await db.socialAccount.update({
          where: { id },
          data: {
            status: "REAUTH_REQUIRED",
            lastError: "Access token expired",
          },
        });
        return toPublicAccount(updated);
      }

      if (!provider.refreshTokens) {
        if (expired) {
          const updated = await db.socialAccount.update({
            where: { id },
            data: {
              status: "REAUTH_REQUIRED",
              lastError: "Token expired and refresh not supported",
            },
          });
          return toPublicAccount(updated);
        }
        return toPublicAccount(account);
      }

      try {
        const refreshed = await provider.refreshTokens(tokens);
        await persistCredentials(id, refreshed.tokens);
        const profile = await provider.fetchAccountInfo(refreshed.tokens);
        const updated = await db.socialAccount.update({
          where: { id },
          data: {
            status: "CONNECTED",
            accountName: profile.accountName ?? account.accountName,
            username: profile.username ?? account.username,
            profileUrl: profile.profileUrl ?? account.profileUrl,
            profileImageUrl: profile.profileImageUrl ?? account.profileImageUrl,
            scopes: refreshed.tokens.scopes,
            tokenExpiresAt: refreshed.tokens.accessExpiresAt ?? null,
            lastSyncedAt: new Date(),
            lastError: null,
          },
        });
        return toPublicAccount(updated);
      } catch (e) {
        const requiresReauth =
          e instanceof SocialIntegrationError &&
          (e.code === "AUTH_ERROR" || e.code === "REAUTH_REQUIRED");
        const updated = await db.socialAccount.update({
          where: { id },
          data: {
            status: requiresReauth ? "REAUTH_REQUIRED" : "ERROR",
            lastError:
              e instanceof Error ? e.message.slice(0, 500) : "Refresh failed",
          },
        });
        return toPublicAccount(updated);
      }
    },

    async syncHealth(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const account = await requireScopedAccount(id, scope);
      if (!account.credential) {
        const updated = await db.socialAccount.update({
          where: { id },
          data: { status: "ERROR", lastError: "Missing credentials" },
        });
        return toPublicAccount(updated);
      }
      const provider = registry.requireProvider(account.platform);
      const tokens = decryptTokenBundle(account.credential);

      if (
        tokens.accessExpiresAt &&
        tokens.accessExpiresAt.getTime() <= Date.now()
      ) {
        return this.refreshAccount(id, scope);
      }

      if (!provider.healthCheck) {
        return toPublicAccount(account);
      }

      const health = await provider.healthCheck(tokens);
      if (health.healthy) {
        const updated = await db.socialAccount.update({
          where: { id },
          data: {
            status: "CONNECTED",
            lastSyncedAt: new Date(),
            lastError: null,
          },
        });
        return toPublicAccount(updated);
      }
      const updated = await db.socialAccount.update({
        where: { id },
        data: {
          status: health.requiresReauth ? "REAUTH_REQUIRED" : "ERROR",
          lastError: health.message?.slice(0, 500) ?? "Provider unhealthy",
        },
      });
      return toPublicAccount(updated);
    },

    async disconnect(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const account = await requireScopedAccount(id, scope);
      await db.socialAccountCredential.deleteMany({
        where: { socialAccountId: account.id },
      });
      const updated = await db.socialAccount.update({
        where: { id },
        data: {
          status: "DISCONNECTED",
          disconnectedAt: new Date(),
          lastError: null,
        },
      });
      return toPublicAccount(updated);
    },

    /** Internal only — never expose via API/Agent. */
    async getDecryptedTokensForTests(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const account = await requireScopedAccount(id, scope);
      if (!account.credential) return null;
      return decryptTokenBundle(account.credential);
    },
  };
}

export type SocialAccountsService = ReturnType<typeof createSocialAccountsService>;

export const socialAccounts = createSocialAccountsService();

export function createMockLinkedInProvider(
  overrides?: Partial<SocialPlatformProvider>,
): SocialPlatformProvider {
  const base: SocialPlatformProvider = {
    platform: "linkedin",
    displayName: "LinkedIn",
    authType: "oauth2",
    declaredCapabilities: () => ({
      connect: true,
      accountInfo: true,
      profile: true,
      publishing: false,
      analytics: false,
      mediaUpload: false,
      deleteContent: false,
    }),
    isConfigured: () => true,
    descriptor: () => ({
      platform: "linkedin",
      displayName: "LinkedIn",
      authType: "oauth2",
      configured: true,
      capabilities: {
        connect: true,
        accountInfo: true,
        profile: true,
        publishing: false,
        analytics: false,
        mediaUpload: false,
        deleteContent: false,
      },
    }),
    async startConnect({ state, redirectUri }) {
      return {
        state,
        authorizationUrl: `https://example.test/oauth?state=${state}&redirect=${encodeURIComponent(redirectUri)}`,
      };
    },
    async completeConnect() {
      return {
        tokens: {
          accessToken: "test-access-token-value-123456",
          refreshToken: "test-refresh-token-value-123456",
          scopes: ["openid", "profile", "email"],
          accessExpiresAt: new Date(Date.now() + 3600_000),
          tokenType: "Bearer",
        },
        profile: {
          platformAccountId: "li-user-1",
          accountName: "Test User",
          username: "test@example.com",
          profileUrl: "https://linkedin.com/in/test",
          profileImageUrl: null,
        },
      };
    },
    async refreshTokens(tokens) {
      return {
        tokens: {
          ...tokens,
          accessToken: "refreshed-access-token-value-123456",
          accessExpiresAt: new Date(Date.now() + 3600_000),
        },
      };
    },
    async fetchAccountInfo() {
      return {
        platformAccountId: "li-user-1",
        accountName: "Test User",
        username: "test@example.com",
      };
    },
    async healthCheck() {
      return { healthy: true };
    },
  };
  return { ...base, ...overrides };
}
