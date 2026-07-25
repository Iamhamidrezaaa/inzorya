import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import { ensureSocialChannelCatalog } from "@/lib/business";
import {
  META_PRODUCTS,
  completeSandboxConnect,
  disconnectConnectedAccount,
  ensureWebhookFoundation,
  getIntegrationDiagnostics,
  queueSyncJob,
  startMetaOAuth,
} from "@/server/services/meta/integration";
import { recordActivity } from "@/server/services/workspace-experience";

function requestMeta(request: Request) {
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const view = searchParams.get("view") || "channels";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await ensureSocialChannelCatalog();
    await ensureWebhookFoundation(access.brand.id);

    if (view === "diagnostics") {
      const [accounts, jobs, webhooks, audits] = await Promise.all([
        prisma.connectedAccount.findMany({
          where: { brandId: access.brand.id },
          orderBy: { updatedAt: "desc" },
          include: {
            accessTokens: {
              where: { status: "ACTIVE" },
              select: { id: true, expiresAt: true, status: true, scopes: true },
            },
            permissions: true,
          },
        }),
        prisma.syncJob.findMany({
          where: { brandId: access.brand.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.webhookSubscription.findMany({
          where: { OR: [{ brandId: access.brand.id }, { brandId: null }] },
          orderBy: { createdAt: "desc" },
        }),
        prisma.integrationAuditLog.findMany({
          where: { brandId: access.brand.id },
          orderBy: { createdAt: "desc" },
          take: 40,
        }),
      ]);

      return NextResponse.json({
        diagnostics: getIntegrationDiagnostics(),
        accounts,
        syncQueue: jobs,
        webhooks,
        audits,
      });
    }

    const accounts = await prisma.connectedAccount.findMany({
      where: { brandId: access.brand.id, disconnectedAt: null },
      include: {
        permissions: true,
        accessTokens: {
          where: { status: "ACTIVE" },
          select: { id: true, expiresAt: true, status: true, scopes: true },
          take: 1,
        },
        syncHistory: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { updatedAt: "desc" },
    });

    const byProduct = new Map(accounts.map((a) => [a.product, a]));

    const channels = META_PRODUCTS.map((product) => {
      const account = byProduct.get(product.product);
      const token = account?.accessTokens[0];
      return {
        product: product.product,
        platform: product.platform,
        name: product.name,
        description: product.description,
        connected: Boolean(account),
        accountId: account?.id ?? null,
        businessName: account?.businessName ?? null,
        username: account?.username ?? null,
        profilePictureUrl: account?.profilePictureUrl ?? null,
        connectedAt: account?.connectedAt ?? null,
        lastSyncAt: account?.lastSyncAt ?? null,
        nextSyncAt: account?.nextSyncAt ?? null,
        health: account?.health ?? "PENDING",
        tokenExpiresAt: token?.expiresAt ?? null,
        permissions:
          account?.permissions.map((p) => ({
            scope: p.scope,
            label: p.label,
            description: p.description,
            granted: p.granted,
            required: p.required,
          })) ??
          product.permissions.map((p) => ({
            scope: p.scope,
            label: p.label,
            description: p.description,
            granted: false,
            required: p.required,
          })),
        syncErrors: account?.syncHistory.filter((h) => h.status === "FAILED") || [],
      };
    });

    return NextResponse.json({
      channels,
      diagnostics: getIntegrationDiagnostics(),
      otherPlatformsNote:
        "WhatsApp, Telegram, and other platforms reuse this foundation later.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load integrations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = body.intent as string;
    const meta = requestMeta(request);

    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "oauth_start") {
      const product = z
        .enum(["instagram", "facebook_pages", "messenger"])
        .parse(body.product);
      const result = await startMetaOAuth({
        brandId: access.brand.id,
        userId: user.id!,
        product,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (intent === "sandbox_connect") {
      const product = z
        .enum(["instagram", "facebook_pages", "messenger"])
        .parse(body.product);
      const account = await completeSandboxConnect({
        brandId: access.brand.id,
        workspaceId: access.workspace.id,
        userId: user.id!,
        product,
        workspaceSlug: body.workspaceSlug,
        brandSlug: body.brandSlug,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      await recordActivity({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        kind: "CHANNEL_CONNECTED",
        title: `${product} connected (sandbox)`,
        description: "Encrypted sandbox credentials stored. Meta Graph not called.",
        href: `/w/${body.workspaceSlug}/b/${body.brandSlug}/channels`,
      });
      return NextResponse.json({ ok: true, account });
    }

    if (intent === "disconnect") {
      const accountId = z.string().parse(body.accountId);
      await disconnectConnectedAccount({
        brandId: access.brand.id,
        userId: user.id!,
        accountId,
      });
      await recordActivity({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        kind: "CHANNEL_DISCONNECTED",
        title: "Channel disconnected",
        description: "Tokens revoked locally.",
        href: `/w/${body.workspaceSlug}/b/${body.brandSlug}/channels`,
      });
      return NextResponse.json({ ok: true });
    }

    if (intent === "sync") {
      const accountId = z.string().parse(body.accountId);
      const job = await queueSyncJob({
        brandId: access.brand.id,
        userId: user.id!,
        accountId,
      });
      return NextResponse.json({ ok: true, job });
    }

    if (intent === "reconnect") {
      const product = z
        .enum(["instagram", "facebook_pages", "messenger"])
        .parse(body.product);
      const result = await startMetaOAuth({
        brandId: access.brand.id,
        userId: user.id!,
        product,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "SANDBOX_DISABLED") {
      return NextResponse.json(
        { error: "Sandbox connect is disabled." },
        { status: 403 },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Integration action failed." }, { status: 500 });
  }
}
