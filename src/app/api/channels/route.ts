import { NextResponse } from "next/server";
import { ChannelPlatform, ChannelStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  SOCIAL_CHANNEL_CATALOG,
  ensureSocialChannelCatalog,
} from "@/lib/business";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await ensureSocialChannelCatalog();

    const socialChannels = await prisma.socialChannel.findMany({
      orderBy: { name: "asc" },
    });
    const connections = await prisma.channelConnection.findMany({
      where: { brandId: access.brand.id },
      include: { permissions: true, socialChannel: true },
    });
    const bySocialId = new Map(
      connections.map((c) => [c.socialChannelId, c]),
    );

    const channels = socialChannels.map((social) => {
      const catalog = SOCIAL_CHANNEL_CATALOG.find(
        (c) => c.platform === social.platform,
      )!;
      const connection = bySocialId.get(social.id);
      return {
        socialChannelId: social.id,
        platform: social.platform,
        name: social.name,
        description: social.description,
        status: connection?.status ?? ChannelStatus.DISCONNECTED,
        accountName: connection?.accountName ?? null,
        accountHandle: connection?.accountHandle ?? null,
        lastSyncAt: connection?.lastSyncAt ?? null,
        connectionId: connection?.id ?? null,
        permissions:
          connection?.permissions.map((p) => ({
            scope: p.scope,
            label: p.label,
            granted: p.granted,
          })) ??
          catalog.permissions.map((p) => ({
            ...p,
            granted: false,
          })),
      };
    });

    return NextResponse.json({ channels });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load channels." }, { status: 500 });
  }
}

const patchSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  platform: z.nativeEnum(ChannelPlatform),
  status: z.nativeEnum(ChannelStatus),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await ensureSocialChannelCatalog();
    const social = await prisma.socialChannel.findUnique({
      where: { platform: parsed.data.platform },
    });
    if (!social) {
      return NextResponse.json({ error: "Unknown platform." }, { status: 400 });
    }

    const catalog = SOCIAL_CHANNEL_CATALOG.find(
      (c) => c.platform === parsed.data.platform,
    )!;

    const connecting = parsed.data.status === ChannelStatus.CONNECTED;

    const connection = await prisma.channelConnection.upsert({
      where: {
        brandId_socialChannelId: {
          brandId: access.brand.id,
          socialChannelId: social.id,
        },
      },
      create: {
        brandId: access.brand.id,
        socialChannelId: social.id,
        status: parsed.data.status,
        accountName: connecting ? catalog.mockAccountName : null,
        accountHandle: connecting ? catalog.mockHandle : null,
        lastSyncAt: connecting ? new Date() : null,
        // Placeholder shape for future OAuth — no real tokens
        providerMeta: connecting
          ? { mock: true, provider: parsed.data.platform.toLowerCase() }
          : undefined,
        permissions: {
          create: catalog.permissions.map((p) => ({
            scope: p.scope,
            label: p.label,
            granted: connecting,
          })),
        },
      },
      update: {
        status: parsed.data.status,
        accountName: connecting ? catalog.mockAccountName : null,
        accountHandle: connecting ? catalog.mockHandle : null,
        lastSyncAt: connecting ? new Date() : null,
        providerMeta: connecting
          ? { mock: true, provider: parsed.data.platform.toLowerCase() }
          : PrismaJsonNull(),
      },
      include: { permissions: true, socialChannel: true },
    });

    if (!connecting) {
      await prisma.channelPermission.updateMany({
        where: { connectionId: connection.id },
        data: { granted: false },
      });
    } else {
      for (const p of catalog.permissions) {
        await prisma.channelPermission.upsert({
          where: {
            connectionId_scope: {
              connectionId: connection.id,
              scope: p.scope,
            },
          },
          create: {
            connectionId: connection.id,
            scope: p.scope,
            label: p.label,
            granted: true,
          },
          update: { granted: true, label: p.label },
        });
      }
    }

    const refreshed = await prisma.channelConnection.findUnique({
      where: { id: connection.id },
      include: { permissions: true, socialChannel: true },
    });

    return NextResponse.json({ ok: true, connection: refreshed });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update channel." }, { status: 500 });
  }
}

function PrismaJsonNull() {
  return { mock: false };
}
