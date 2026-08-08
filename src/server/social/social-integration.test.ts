import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  assertNoTokenLeak,
  encryptTokenBundle,
  decryptTokenBundle,
  hashOAuthState,
  createOAuthStateToken,
  redactSecrets,
} from "@/server/social/credentials";
import {
  createContentWorkspaceService,
  createMemoryStore,
  createStubRegenerator,
} from "@/server/content-workspace";
import {
  SocialProviderRegistry,
  setSocialProviderRegistryForTests,
} from "@/server/social/registry";
import {
  createMockLinkedInProvider,
  createSocialAccountsService,
} from "@/server/social/service";
import { validatePublishRequest } from "@/server/social/publish-validation";
import { SocialIntegrationError } from "@/server/social/types";
import { linkedInProvider } from "@/server/social/providers/linkedin";
import {
  socialGetCapabilitiesTool,
  socialGetConnectedAccountsTool,
} from "@/server/agent/tools/social-accounts";
import type { ContentAsset } from "@/server/agent/content-creator/output";

describe("EPIC-014 Social Account Integration", () => {
  const suffix = `epic014-${Date.now()}`;
  let workspaceId = "";
  let brandId = "";
  let brandBId = "";
  let userId = "";
  let registry: SocialProviderRegistry;
  let svc: ReturnType<typeof createSocialAccountsService>;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `social-${suffix}@example.com`,
        name: "Social Tester",
      },
    });
    userId = user.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `WS ${suffix}`,
        slug: `ws-${suffix}`,
        members: { create: { userId, role: "OWNER" } },
      },
    });
    workspaceId = workspace.id;

    const brand = await prisma.brand.create({
      data: {
        workspaceId,
        name: `Brand ${suffix}`,
        slug: `brand-${suffix}`,
      },
    });
    brandId = brand.id;

    const brandB = await prisma.brand.create({
      data: {
        workspaceId,
        name: `BrandB ${suffix}`,
        slug: `brand-b-${suffix}`,
      },
    });
    brandBId = brandB.id;

    registry = new SocialProviderRegistry();
    registry.registerProvider(createMockLinkedInProvider());
    setSocialProviderRegistryForTests(registry);
    svc = createSocialAccountsService({ registry });
  });

  afterAll(async () => {
    setSocialProviderRegistryForTests(null);
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it("TEST 1: provider registry", () => {
    expect(registry.hasProvider("linkedin")).toBe(true);
    expect(registry.listProviders().map((p) => p.platform)).toEqual(["linkedin"]);
    expect(registry.getProvider("linkedin")?.displayName).toBe("LinkedIn");
  });

  it("TEST 2: unsupported platform rejected", () => {
    expect(() => registry.requireProvider("x")).toThrow(SocialIntegrationError);
  });

  it("TEST 3: OAuth state validation", async () => {
    const started = await svc.startConnect({
      platform: "linkedin",
      userId,
      workspaceId,
      brandId,
    });
    expect(started.state).toBeTruthy();
    expect(hashOAuthState(started.state)).toHaveLength(64);

    await expect(
      svc.completeConnect({
        platform: "linkedin",
        code: "code",
        state: createOAuthStateToken(),
        userId,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    // Wrong user
    await expect(
      svc.completeConnect({
        platform: "linkedin",
        code: "code",
        state: started.state,
        userId: "someone-else",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("TEST 4: workspace/brand scope validation", async () => {
    const account = await svc.upsertConnectedAccountForTests({
      workspaceId,
      brandId,
      platform: "linkedin",
      profile: { platformAccountId: `scope-${suffix}`, accountName: "Scope" },
      tokens: {
        accessToken: "access-token-scope-test-0001",
        refreshToken: "refresh-token-scope-test-0001",
        scopes: ["openid"],
        accessExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    await expect(
      svc.getAccount(account.id, { workspaceId, brandId: brandBId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("TEST 5: account creation after successful connection", async () => {
    const started = await svc.startConnect({
      platform: "linkedin",
      userId,
      workspaceId,
      brandId,
    });
    const account = await svc.completeConnect({
      platform: "linkedin",
      code: "auth-code",
      state: started.state,
      userId,
    });
    expect(account.status).toBe("CONNECTED");
    expect(account.platform).toBe("linkedin");
    expect(account.platformAccountId).toBe("li-user-1");
    expect(account.accountName).toBe("Test User");
  });

  it("TEST 6: token encryption/storage abstraction", () => {
    const enc = encryptTokenBundle({
      accessToken: "plain-access-secret-value",
      refreshToken: "plain-refresh-secret-value",
      scopes: ["openid"],
      tokenType: "Bearer",
      accessExpiresAt: new Date(),
    });
    expect(enc.accessCiphertext).not.toContain("plain-access");
    expect(enc.refreshCiphertext).not.toContain("plain-refresh");
    const dec = decryptTokenBundle(enc);
    expect(dec.accessToken).toBe("plain-access-secret-value");
    expect(dec.refreshToken).toBe("plain-refresh-secret-value");
  });

  it("TEST 7: token never appears in API output", async () => {
    const account = await svc.upsertConnectedAccountForTests({
      workspaceId,
      brandId,
      platform: "linkedin",
      profile: { platformAccountId: `leak-${suffix}`, accountName: "Leak Check" },
      tokens: {
        accessToken: "super-secret-access-token-xyz",
        refreshToken: "super-secret-refresh-token-xyz",
        scopes: ["openid"],
      },
    });
    const publicAccount = await svc.getAccount(account.id, {
      workspaceId,
      brandId,
    });
    const json = JSON.stringify(publicAccount);
    expect(json).not.toContain("super-secret");
    expect(json).not.toContain("accessToken");
    expect(json).not.toContain("refreshToken");
    expect(() => assertNoTokenLeak(publicAccount)).not.toThrow();
  });

  it("TEST 8: expired token → REAUTH_REQUIRED", async () => {
    const localRegistry = new SocialProviderRegistry();
    localRegistry.registerProvider(
      createMockLinkedInProvider({
        refreshTokens: undefined,
      }),
    );
    const localSvc = createSocialAccountsService({ registry: localRegistry });
    const account = await localSvc.upsertConnectedAccountForTests({
      workspaceId,
      brandId,
      platform: "linkedin",
      profile: { platformAccountId: `exp-${suffix}` },
      tokens: {
        accessToken: "expired-access-token-value-1",
        refreshToken: null,
        scopes: ["openid"],
        accessExpiresAt: new Date(Date.now() - 1000),
      },
    });
    const refreshed = await localSvc.refreshAccount(account.id, {
      workspaceId,
      brandId,
    });
    expect(refreshed.status).toBe("REAUTH_REQUIRED");
  });

  it("TEST 9: refreshable token → refresh flow", async () => {
    const account = await svc.upsertConnectedAccountForTests({
      workspaceId,
      brandId,
      platform: "linkedin",
      profile: { platformAccountId: `ref-${suffix}` },
      tokens: {
        accessToken: "old-access-token-value-123456",
        refreshToken: "old-refresh-token-value-123456",
        scopes: ["openid", "profile"],
        accessExpiresAt: new Date(Date.now() - 1000),
      },
    });
    const refreshed = await svc.refreshAccount(account.id, {
      workspaceId,
      brandId,
    });
    expect(refreshed.status).toBe("CONNECTED");
    const tokens = await svc.getDecryptedTokensForTests(account.id, {
      workspaceId,
      brandId,
    });
    expect(tokens?.accessToken).toContain("refreshed-access");
  });

  it("TEST 10: capability discovery", async () => {
    const account = await svc.upsertConnectedAccountForTests({
      workspaceId,
      brandId,
      platform: "linkedin",
      profile: { platformAccountId: `caps-${suffix}`, accountName: "Caps" },
      tokens: {
        accessToken: "caps-access-token-value-1234",
        scopes: ["openid"],
      },
    });
    const caps = await svc.getCapabilities(account.id, { workspaceId, brandId });
    expect(caps.platform).toBe("linkedin");
    expect(caps.capabilities.accountInfo).toBe(true);
    expect(caps.capabilities.publishing).toBe(false);
    expect(caps.capabilities.analytics).toBe(false);
  });

  it("TEST 11: provider unavailable → ERROR", async () => {
    const localRegistry = new SocialProviderRegistry();
    localRegistry.registerProvider(
      createMockLinkedInProvider({
        async healthCheck() {
          return { healthy: false, message: "provider down" };
        },
      }),
    );
    const localSvc = createSocialAccountsService({ registry: localRegistry });
    const account = await localSvc.upsertConnectedAccountForTests({
      workspaceId,
      brandId,
      platform: "linkedin",
      profile: { platformAccountId: `err-${suffix}` },
      tokens: {
        accessToken: "err-access-token-value-123456",
        scopes: ["openid"],
        accessExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const synced = await localSvc.syncHealth(account.id, { workspaceId, brandId });
    expect(synced.status).toBe("ERROR");
  });

  it("TEST 12: READY validation succeeds (when publishing capability true)", () => {
    const result = validatePublishRequest({
      request: {
        draftId: "d1",
        socialAccountId: "a1",
        platform: "linkedin",
        caption: "hi",
      },
      draft: {
        id: "d1",
        status: "READY",
        workspaceId,
        brandId,
      },
      account: {
        id: "a1",
        workspaceId,
        brandId,
        platform: "linkedin",
        status: "CONNECTED",
        capabilities: {
          connect: true,
          accountInfo: true,
          profile: true,
          publishing: true,
          analytics: false,
          mediaUpload: false,
          deleteContent: false,
        },
      },
    });
    expect(result.ok).toBe(true);
  });

  it("TEST 13: DRAFT publishing validation fails", () => {
    const result = validatePublishRequest({
      request: {
        draftId: "d1",
        socialAccountId: "a1",
        platform: "linkedin",
      },
      draft: {
        id: "d1",
        status: "DRAFT",
        workspaceId,
        brandId,
      },
      account: {
        id: "a1",
        workspaceId,
        brandId,
        platform: "linkedin",
        status: "CONNECTED",
        capabilities: {
          connect: true,
          accountInfo: true,
          profile: true,
          publishing: true,
          analytics: false,
          mediaUpload: false,
          deleteContent: false,
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "PUBLISH_REQUIRES_APPROVAL")).toBe(
      true,
    );
  });

  it("TEST 14: wrong brand account rejected", () => {
    const result = validatePublishRequest({
      request: {
        draftId: "d1",
        socialAccountId: "a1",
        platform: "linkedin",
      },
      draft: {
        id: "d1",
        status: "READY",
        workspaceId,
        brandId,
      },
      account: {
        id: "a1",
        workspaceId,
        brandId: brandBId,
        platform: "linkedin",
        status: "CONNECTED",
        capabilities: {
          connect: true,
          accountInfo: true,
          profile: true,
          publishing: true,
          analytics: false,
          mediaUpload: false,
          deleteContent: false,
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "FORBIDDEN")).toBe(true);
  });

  it("TEST 15: Agent cannot access raw credentials", async () => {
    await svc.upsertConnectedAccountForTests({
      workspaceId,
      brandId,
      platform: "linkedin",
      profile: { platformAccountId: `agent-${suffix}`, accountName: "Agent" },
      tokens: {
        accessToken: "agent-must-not-see-this-token",
        refreshToken: "agent-must-not-see-refresh",
        scopes: ["openid"],
      },
    });

    // Temporarily point default service usage — tools use singleton.
    // Execute tools with scoped context; they call socialAccounts singleton.
    // Re-bind by ensuring singleton registry and that list works against same DB.
    setSocialProviderRegistryForTests(registry);

    const listed = await socialGetConnectedAccountsTool.execute(
      {},
      {
        userId,
        workspaceId,
        brandId,
        agentExecutionId: "exec-1",
        allowedPermissions: ["READ"],
      },
    );
    const json = JSON.stringify(listed);
    expect(json).not.toContain("agent-must-not-see");
    expect(json).not.toContain("accessToken");

    const caps = await socialGetCapabilitiesTool.execute(
      {},
      {
        userId,
        workspaceId,
        brandId,
        agentExecutionId: "exec-2",
        allowedPermissions: ["READ"],
      },
    );
    expect(JSON.stringify(caps)).not.toContain("agent-must-not-see");
    expect(() => assertNoTokenLeak(redactSecrets(listed))).not.toThrow();
  });

  it("TEST 16: Meta explicitly unavailable", () => {
    expect(() => registry.requireProvider("meta")).toThrow(/unavailable|postponed/i);
    expect(() => registry.requireProvider("instagram")).toThrow(/unavailable|postponed/i);
    expect(() => registry.requireProvider("facebook")).toThrow(/unavailable|postponed/i);
    expect(() =>
      registry.registerProvider({
        ...createMockLinkedInProvider(),
        platform: "meta",
      }),
    ).toThrow(SocialIntegrationError);
  });

  it("TEST 17: TikTok explicitly unavailable", () => {
    expect(() => registry.requireProvider("tiktok")).toThrow(/unavailable|postponed/i);
  });

  it("TEST 18: Pinterest not registered", () => {
    expect(registry.hasProvider("pinterest")).toBe(false);
    expect(() => registry.requireProvider("pinterest")).toThrow(/not part of Inzorya/i);
  });

  it("TEST 19: existing Content Workspace remains functional", async () => {
    const cw = createContentWorkspaceService({
      store: createMemoryStore(),
      regenerator: createStubRegenerator(),
    });
    const asset = {
      blueprintReference: "bp",
      content: {
        channel: "linkedin",
        format: "post",
        topic: "Launch",
        objective: "awareness",
        angle: "story",
      },
      creative: {
        hooks: ["Hook"],
        primaryHook: "Hook",
        caption: "Caption",
        cta: "CTA",
        ctaVariants: [],
        hashtags: [],
        productionNotes: [],
      },
      quality: {
        strategicConsistency: "ok",
        brandConsistency: "ok",
        limitations: [],
      },
    } as ContentAsset;
    const draft = await cw.createFromCreatorOutput({
      workspaceId,
      brandId,
      createdById: userId,
      asset,
    });
    expect(draft.status).toBe("DRAFT");
    const reviewed = await cw.review(draft.id, { workspaceId, brandId }, userId, "send_for_review");
    expect(reviewed.status).toBe("IN_REVIEW");
  });

  it("TEST 20: live LinkedIn provider declares no unverified publishing", () => {
    const caps = linkedInProvider.declaredCapabilities();
    expect(caps.publishing).toBe(false);
    expect(caps.analytics).toBe(false);
    expect(caps.connect).toBe(true);
    expect(caps.accountInfo).toBe(true);
  });
});
