import type { ActivityKind, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function recordActivity(input: {
  workspaceId: string;
  brandId?: string | null;
  userId?: string | null;
  kind: ActivityKind;
  title: string;
  description?: string | null;
  href?: string | null;
  meta?: Record<string, unknown>;
}) {
  return prisma.activity.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId ?? null,
      userId: input.userId ?? null,
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      href: input.href ?? null,
      meta: input.meta as object | undefined,
    },
  });
}

export async function ensureMockNotifications(input: {
  workspaceId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug?: string | null;
}) {
  const count = await prisma.notification.count({
    where: {
      workspaceId: input.workspaceId,
      userId: input.userId,
    },
  });
  if (count > 0) return;

  const b = input.brandSlug
    ? `/w/${input.workspaceSlug}/b/${input.brandSlug}`
    : `/w/${input.workspaceSlug}`;

  const seeds: {
    type: NotificationType;
    title: string;
    body: string;
    href: string;
    hoursAgo: number;
    read?: boolean;
  }[] = [
    {
      type: "STRATEGY",
      title: "Strategy workspace is ready",
      body: "Define goals and audience before generating content.",
      href: `${b}/strategy`,
      hoursAgo: 1,
    },
    {
      type: "CHANNEL",
      title: "Connect your first channel",
      body: "Instagram and WhatsApp are prepared for mock connect.",
      href: `${b}/channels`,
      hoursAgo: 5,
    },
    {
      type: "CONVERSATION",
      title: "Inbox is waiting",
      body: "Customer threads will land here once channels are active.",
      href: `${b}/inbox`,
      hoursAgo: 12,
      read: true,
    },
    {
      type: "CONTENT",
      title: "Drafts stay secondary",
      body: "Create content only after strategy is structured.",
      href: `${b}/content`,
      hoursAgo: 26,
      read: true,
    },
    {
      type: "WORKSPACE",
      title: "Welcome to your workspace",
      body: "Switch brands and workspaces anytime from the top bar.",
      href: `/w/${input.workspaceSlug}/home`,
      hoursAgo: 48,
      read: true,
    },
    {
      type: "SYSTEM",
      title: "Keyboard tip",
      body: "Press ⌘K / Ctrl+K to open global search.",
      href: `/w/${input.workspaceSlug}/home`,
      hoursAgo: 60,
      read: true,
    },
  ];

  await prisma.notification.createMany({
    data: seeds.map((s) => ({
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: s.type,
      title: s.title,
      body: s.body,
      href: s.href,
      readAt: s.read
        ? new Date(Date.now() - s.hoursAgo * 3600_000)
        : null,
      createdAt: new Date(Date.now() - s.hoursAgo * 3600_000),
    })),
  });
}

export async function upsertRecentItem(input: {
  userId: string;
  workspaceId: string;
  targetType: "PAGE" | "KNOWLEDGE" | "CONTACT" | "CONTENT" | "CHANNEL" | "SETTINGS";
  targetId: string;
  title: string;
  href: string;
}) {
  return prisma.recentItem.upsert({
    where: {
      userId_workspaceId_targetType_targetId: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    },
    create: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      targetType: input.targetType,
      targetId: input.targetId,
      title: input.title,
      href: input.href,
      visitedAt: new Date(),
    },
    update: {
      title: input.title,
      href: input.href,
      visitedAt: new Date(),
    },
  });
}
