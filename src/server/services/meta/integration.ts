import type { Prisma } from "@prisma/client";
import {
  ChannelPlatform,
  ChannelStatus,
  ConnectionHealth,
  IntegrationAuditKind,
  OAuthSessionStatus,
  SyncJobStatus,
  TokenCredentialStatus,
  WebhookSubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  decryptSecret,
  encryptSecret,
  hashToken,
  randomUrlSafeToken,
} from "@/lib/crypto/token-vault";
import {
  META_PRODUCTS,
  buildMetaAuthorizeUrl,
  createMetaGraphClient,
  getMetaConfig,
  getMetaProduct,
  type MetaProduct,
} from "@/lib/meta/config";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function writeIntegrationAudit(input: {
  brandId?: string | null;
  userId?: string | null;
  kind: IntegrationAuditKind;
  message: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await prisma.integrationAuditLog.create({
    data: {
      brandId: input.brandId || null,
      userId: input.userId || null,
      kind: input.kind,
      message: input.message,
      meta: input.meta ? asJson(input.meta) : undefined,
      ip: input.ip || null,
      userAgent: input.userAgent || null,
    },
  });
}

export async function startMetaOAuth(input: {
  brandId: string;
  userId: string;
  product: MetaProduct;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const product = getMetaProduct(input.product);
  if (!product) throw new Error("UNKNOWN_PRODUCT");

  const config = getMetaConfig();
  const state = randomUrlSafeToken(24);
  const scopes = product.permissions.map((p) => p.scope);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.oAuthSession.create({
    data: {
      brandId: input.brandId,
      userId: input.userId,
      platform: product.platform,
      product: product.product,
      stateHash: hashToken(state),
      redirectUri: config.redirectUri,
      scopes,
      expiresAt,
      status: OAuthSessionStatus.PENDING,
    },
  });

  await writeIntegrationAudit({
    brandId: input.brandId,
    userId: input.userId,
    kind: IntegrationAuditKind.OAUTH_START,
    message: `OAuth start for ${product.name}`,
    meta: { product: product.product, sandbox: config.sandbox, configured: config.configured },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  if (!config.configured) {
    return {
      mode: "sandbox_required" as const,
      reason: "META_APP_ID / META_APP_SECRET not configured",
      product: product.product,
      state,
    };
  }

  const authorizeUrl = buildMetaAuthorizeUrl({
    clientId: config.appId,
    redirectUri: config.redirectUri,
    state,
    scopes,
    apiVersion: config.apiVersion,
  });

  return {
    mode: "redirect" as const,
    authorizeUrl,
    product: product.product,
    state,
  };
}

export async function completeSandboxConnect(input: {
  brandId: string;
  workspaceId: string;
  userId: string;
  product: MetaProduct;
  workspaceSlug: string;
  brandSlug: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const config = getMetaConfig();
  if (!config.sandbox) {
    throw new Error("SANDBOX_DISABLED");
  }

  const product = getMetaProduct(input.product);
  if (!product) throw new Error("UNKNOWN_PRODUCT");

  const result = await persistConnectedAccount({
    brandId: input.brandId,
    userId: input.userId,
    platform: product.platform,
    product: product.product,
    businessName: `Sandbox ${product.name}`,
    username:
      product.product === "instagram"
        ? "@sandbox.brand"
        : product.product === "messenger"
          ? "sandbox.messenger"
          : "sandbox.page",
    profilePictureUrl: null,
    externalAccountId: `sandbox_${product.product}_${input.brandId.slice(0, 8)}`,
    accessToken: `sandbox_access_${randomUrlSafeToken(16)}`,
    refreshToken: `sandbox_refresh_${randomUrlSafeToken(16)}`,
    expiresIn: 60 * 60 * 24 * 60,
    scopes: product.permissions.map((p) => p.scope),
    grantedScopes: product.permissions.filter((p) => p.required).map((p) => p.scope),
    source: "sandbox",
  });

  await writeIntegrationAudit({
    brandId: input.brandId,
    userId: input.userId,
    kind: IntegrationAuditKind.OAUTH_SUCCESS,
    message: `Sandbox connect completed for ${product.name}`,
    meta: { product: product.product, mode: "sandbox" },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return result;
}

export async function handleMetaOAuthCallback(input: {
  state: string;
  code?: string | null;
  error?: string | null;
  errorDescription?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const session = await prisma.oAuthSession.findFirst({
    where: {
      stateHash: hashToken(input.state),
      status: OAuthSessionStatus.PENDING,
    },
  });

  if (!session) {
    await writeIntegrationAudit({
      kind: IntegrationAuditKind.SECURITY,
      message: "OAuth callback with invalid or unknown state",
      meta: { statePresent: Boolean(input.state) },
      ip: input.ip,
      userAgent: input.userAgent,
    });
    throw new Error("INVALID_STATE");
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.oAuthSession.update({
      where: { id: session.id },
      data: { status: OAuthSessionStatus.EXPIRED, error: "Session expired" },
    });
    throw new Error("SESSION_EXPIRED");
  }

  if (input.error) {
    await prisma.oAuthSession.update({
      where: { id: session.id },
      data: {
        status: OAuthSessionStatus.FAILED,
        error: input.errorDescription || input.error,
        consumedAt: new Date(),
      },
    });
    await writeIntegrationAudit({
      brandId: session.brandId,
      userId: session.userId,
      kind: IntegrationAuditKind.OAUTH_FAILURE,
      message: `OAuth denied: ${input.error}`,
      meta: { product: session.product, error: input.error },
      ip: input.ip,
      userAgent: input.userAgent,
    });
    throw new Error("OAUTH_DENIED");
  }

  if (!input.code) throw new Error("MISSING_CODE");

  const config = getMetaConfig();
  const client = createMetaGraphClient();

  try {
    if (!config.apiEnabled) {
      await prisma.oAuthSession.update({
        where: { id: session.id },
        data: {
          status: OAuthSessionStatus.FAILED,
          error: "META_API_ENABLED is false — cannot exchange authorization code",
          consumedAt: new Date(),
        },
      });
      await writeIntegrationAudit({
        brandId: session.brandId,
        userId: session.userId,
        kind: IntegrationAuditKind.OAUTH_FAILURE,
        message: "Callback received but Meta API calls are disabled",
        meta: { product: session.product, hasCode: true },
        ip: input.ip,
        userAgent: input.userAgent,
      });
      throw new Error("META_API_DISABLED");
    }

    const tokens = await client.exchangeCode({
      code: input.code,
      redirectUri: session.redirectUri,
    });

    const account = await persistConnectedAccount({
      brandId: session.brandId,
      userId: session.userId,
      platform: session.platform,
      product: session.product,
      businessName: tokens.businessName,
      username: tokens.username,
      profilePictureUrl: tokens.profilePictureUrl || null,
      externalAccountId: tokens.externalAccountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || null,
      expiresIn: tokens.expiresIn || null,
      scopes: tokens.scopes,
      grantedScopes: tokens.scopes,
      source: "oauth",
    });

    await prisma.oAuthSession.update({
      where: { id: session.id },
      data: {
        status: OAuthSessionStatus.COMPLETED,
        consumedAt: new Date(),
      },
    });

    await writeIntegrationAudit({
      brandId: session.brandId,
      userId: session.userId,
      kind: IntegrationAuditKind.OAUTH_SUCCESS,
      message: "OAuth callback completed",
      meta: { product: session.product, accountId: account.id },
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return { account, brandId: session.brandId };
  } catch (error) {
    if (error instanceof Error && error.message === "META_API_DISABLED") throw error;
    await prisma.oAuthSession.update({
      where: { id: session.id },
      data: {
        status: OAuthSessionStatus.FAILED,
        error: error instanceof Error ? error.message : "Callback failed",
        consumedAt: new Date(),
      },
    });
    throw error;
  }
}

async function persistConnectedAccount(input: {
  brandId: string;
  userId: string;
  platform: ChannelPlatform;
  product: string;
  businessName: string;
  username: string;
  profilePictureUrl: string | null;
  externalAccountId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scopes: string[];
  grantedScopes: string[];
  source: "sandbox" | "oauth";
}) {
  const product = getMetaProduct(input.product);
  const social = await prisma.socialChannel.findUnique({
    where: { platform: input.platform },
  });
  if (!social) throw new Error("SOCIAL_CHANNEL_MISSING");

  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000)
    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const connection = await prisma.channelConnection.upsert({
    where: {
      brandId_socialChannelId: {
        brandId: input.brandId,
        socialChannelId: social.id,
      },
    },
    create: {
      brandId: input.brandId,
      socialChannelId: social.id,
      status: ChannelStatus.CONNECTED,
      health: ConnectionHealth.HEALTHY,
      accountName: input.businessName,
      accountHandle: input.username,
      profilePictureUrl: input.profilePictureUrl,
      externalAccountId: input.externalAccountId,
      connectedAt: new Date(),
      lastSyncAt: null,
      nextSyncAt: new Date(Date.now() + 60 * 60 * 1000),
      providerMeta: asJson({
        source: input.source,
        product: input.product,
        tokenStorage: "encrypted",
      }),
    },
    update: {
      status: ChannelStatus.CONNECTED,
      health: ConnectionHealth.HEALTHY,
      accountName: input.businessName,
      accountHandle: input.username,
      profilePictureUrl: input.profilePictureUrl,
      externalAccountId: input.externalAccountId,
      connectedAt: new Date(),
      lastError: null,
      nextSyncAt: new Date(Date.now() + 60 * 60 * 1000),
      providerMeta: asJson({
        source: input.source,
        product: input.product,
        tokenStorage: "encrypted",
      }),
    },
  });

  // Clear old channel permissions and rewrite
  await prisma.channelPermission.deleteMany({ where: { connectionId: connection.id } });
  if (product) {
    await prisma.channelPermission.createMany({
      data: product.permissions.map((p) => ({
        connectionId: connection.id,
        scope: p.scope,
        label: p.label,
        granted: input.grantedScopes.includes(p.scope),
      })),
    });
  }

  const existing = await prisma.connectedAccount.findFirst({
    where: {
      brandId: input.brandId,
      product: input.product,
      disconnectedAt: null,
    },
  });

  const account = existing
    ? await prisma.connectedAccount.update({
        where: { id: existing.id },
        data: {
          connectionId: connection.id,
          businessName: input.businessName,
          username: input.username,
          profilePictureUrl: input.profilePictureUrl,
          externalAccountId: input.externalAccountId,
          health: ConnectionHealth.HEALTHY,
          scopes: input.scopes,
          connectedAt: new Date(),
          disconnectedAt: null,
          lastError: null,
          nextSyncAt: new Date(Date.now() + 60 * 60 * 1000),
          providerMeta: asJson({ source: input.source }),
        },
      })
    : await prisma.connectedAccount.create({
        data: {
          brandId: input.brandId,
          connectionId: connection.id,
          platform: input.platform,
          product: input.product,
          businessName: input.businessName,
          username: input.username,
          profilePictureUrl: input.profilePictureUrl,
          externalAccountId: input.externalAccountId,
          health: ConnectionHealth.HEALTHY,
          scopes: input.scopes,
          connectedAt: new Date(),
          nextSyncAt: new Date(Date.now() + 60 * 60 * 1000),
          providerMeta: asJson({ source: input.source }),
        },
      });

  // Revoke previous active tokens
  await prisma.accessToken.updateMany({
    where: { connectedAccountId: account.id, status: TokenCredentialStatus.ACTIVE },
    data: { status: TokenCredentialStatus.REVOKED, revokedAt: new Date() },
  });
  await prisma.refreshToken.updateMany({
    where: { connectedAccountId: account.id, status: TokenCredentialStatus.ACTIVE },
    data: { status: TokenCredentialStatus.REVOKED, revokedAt: new Date() },
  });

  const accessEnc = encryptSecret(input.accessToken);
  await prisma.accessToken.create({
    data: {
      connectedAccountId: account.id,
      ciphertext: accessEnc.ciphertext,
      iv: accessEnc.iv,
      authTag: accessEnc.authTag,
      keyVersion: accessEnc.keyVersion,
      expiresAt,
      scopes: input.scopes,
      status: TokenCredentialStatus.ACTIVE,
    },
  });

  if (input.refreshToken) {
    const refreshEnc = encryptSecret(input.refreshToken);
    await prisma.refreshToken.create({
      data: {
        connectedAccountId: account.id,
        ciphertext: refreshEnc.ciphertext,
        iv: refreshEnc.iv,
        authTag: refreshEnc.authTag,
        keyVersion: refreshEnc.keyVersion,
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        status: TokenCredentialStatus.ACTIVE,
      },
    });
  }

  await prisma.integrationPermission.deleteMany({
    where: { connectedAccountId: account.id },
  });
  if (product) {
    await prisma.integrationPermission.createMany({
      data: product.permissions.map((p) => ({
        connectedAccountId: account.id,
        scope: p.scope,
        label: p.label,
        description: p.description,
        required: p.required,
        granted: input.grantedScopes.includes(p.scope),
      })),
    });
  }

  await writeIntegrationAudit({
    brandId: input.brandId,
    userId: input.userId,
    kind: IntegrationAuditKind.TOKEN_STORED,
    message: "Access/refresh tokens encrypted and stored",
    meta: { accountId: account.id, product: input.product },
  });

  return account;
}

export async function disconnectConnectedAccount(input: {
  brandId: string;
  userId: string;
  accountId: string;
}) {
  const account = await prisma.connectedAccount.findFirst({
    where: { id: input.accountId, brandId: input.brandId },
  });
  if (!account) throw new Error("NOT_FOUND");

  await prisma.accessToken.updateMany({
    where: { connectedAccountId: account.id, status: TokenCredentialStatus.ACTIVE },
    data: { status: TokenCredentialStatus.REVOKED, revokedAt: new Date() },
  });
  await prisma.refreshToken.updateMany({
    where: { connectedAccountId: account.id, status: TokenCredentialStatus.ACTIVE },
    data: { status: TokenCredentialStatus.REVOKED, revokedAt: new Date() },
  });

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: {
      health: ConnectionHealth.RECONNECT_REQUIRED,
      disconnectedAt: new Date(),
      lastError: "Disconnected by user",
    },
  });

  if (account.connectionId) {
    const siblings = await prisma.connectedAccount.count({
      where: {
        connectionId: account.connectionId,
        disconnectedAt: null,
        id: { not: account.id },
      },
    });
    if (siblings === 0) {
      await prisma.channelConnection.update({
        where: { id: account.connectionId },
        data: {
          status: ChannelStatus.DISCONNECTED,
          health: ConnectionHealth.RECONNECT_REQUIRED,
          lastError: "Disconnected by user",
        },
      });
      await prisma.channelPermission.updateMany({
        where: { connectionId: account.connectionId },
        data: { granted: false },
      });
    }
  }

  await writeIntegrationAudit({
    brandId: input.brandId,
    userId: input.userId,
    kind: IntegrationAuditKind.DISCONNECT,
    message: `Disconnected ${account.product}`,
    meta: { accountId: account.id },
  });

  // Local revoke only — Graph revoke when META_API_ENABLED
  try {
    const client = createMetaGraphClient();
    const token = await prisma.accessToken.findFirst({
      where: { connectedAccountId: account.id },
      orderBy: { createdAt: "desc" },
    });
    if (token) {
      const plaintext = decryptSecret(token);
      await client.revokeToken(plaintext);
    }
  } catch {
    // Expected while API disabled
  }

  return { ok: true };
}

export async function queueSyncJob(input: {
  brandId: string;
  userId: string;
  accountId: string;
  jobType?: string;
}) {
  const account = await prisma.connectedAccount.findFirst({
    where: {
      id: input.accountId,
      brandId: input.brandId,
      disconnectedAt: null,
    },
  });
  if (!account) throw new Error("NOT_FOUND");

  const job = await prisma.syncJob.create({
    data: {
      brandId: input.brandId,
      connectedAccountId: account.id,
      jobType: input.jobType || "manual",
      status: SyncJobStatus.QUEUED,
      progress: 0,
      scheduledAt: new Date(),
      meta: asJson({ requestedBy: input.userId, apiCalls: false }),
    },
  });

  // Framework only — mark as succeeded skeleton without Meta API
  const finished = await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      status: SyncJobStatus.SUCCEEDED,
      progress: 100,
      startedAt: new Date(),
      finishedAt: new Date(),
      meta: asJson({
        requestedBy: input.userId,
        apiCalls: false,
        note: "Sync framework dry-run — Meta Graph not called",
      }),
    },
  });

  await prisma.syncHistory.create({
    data: {
      connectedAccountId: account.id,
      syncJobId: finished.id,
      status: SyncJobStatus.SUCCEEDED,
      message: "Manual sync framework completed (no Meta API calls).",
    },
  });

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: {
      lastSyncAt: new Date(),
      nextSyncAt: new Date(Date.now() + 60 * 60 * 1000),
      health: ConnectionHealth.HEALTHY,
    },
  });

  if (account.connectionId) {
    await prisma.channelConnection.update({
      where: { id: account.connectionId },
      data: {
        lastSyncAt: new Date(),
        nextSyncAt: new Date(Date.now() + 60 * 60 * 1000),
        health: ConnectionHealth.HEALTHY,
      },
    });
  }

  await writeIntegrationAudit({
    brandId: input.brandId,
    userId: input.userId,
    kind: IntegrationAuditKind.SYNC_COMPLETED,
    message: "Sync job framework completed",
    meta: { jobId: finished.id, accountId: account.id },
  });

  return finished;
}

export async function ensureWebhookFoundation(brandId?: string) {
  for (const product of META_PRODUCTS) {
    const existing = await prisma.webhookSubscription.findFirst({
      where: {
        platform: product.platform,
        objectType: product.product,
        brandId: brandId || null,
      },
    });
    if (existing) continue;
    await prisma.webhookSubscription.create({
      data: {
        brandId: brandId || null,
        platform: product.platform,
        objectType: product.product,
        fields: ["messages", "messaging_postbacks", "feed"],
        callbackPath: "/api/webhooks/meta",
        status: WebhookSubscriptionStatus.DRAFT,
        meta: asJson({
          note: "Subscription draft only — not registered with Meta yet",
          retryStrategy: {
            maxAttempts: 5,
            backoff: "exponential",
            baseMs: 1000,
          },
          eventRegistry: [
            "messages",
            "messaging_postbacks",
            "feed",
            "comments",
          ],
        }),
      },
    });
  }
}

export function getIntegrationDiagnostics() {
  const config = getMetaConfig();
  return {
    oauth: {
      configured: config.configured,
      appIdPresent: Boolean(config.appId),
      appSecretPresent: config.appSecretConfigured,
      redirectUri: config.redirectUri,
      apiVersion: config.apiVersion,
      apiEnabled: config.apiEnabled,
      sandbox: config.sandbox,
    },
    encryption: {
      configured: Boolean(process.env.TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET),
      keySource: process.env.TOKEN_ENCRYPTION_KEY
        ? "TOKEN_ENCRYPTION_KEY"
        : process.env.AUTH_SECRET
          ? "AUTH_SECRET"
          : "fallback-dev",
    },
    webhook: {
      endpoint: "/api/webhooks/meta",
      verifyReady: true,
      subscribed: false,
    },
  };
}

export { META_PRODUCTS };
