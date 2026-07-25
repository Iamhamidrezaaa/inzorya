import { NextResponse } from "next/server";
import {
  ConversationEventType,
  ConversationStatus,
  MessageDeliveryStatus,
  MessageDirection,
  MessageKind,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import { ensureInboxMockData } from "@/server/services/inbox-seed";

function conversationDetailInclude() {
  return {
    contact: true,
    channel: { include: { socialChannel: true } },
    assignee: { select: { id: true, name: true, email: true, image: true } },
    messages: {
      orderBy: { createdAt: "asc" as const },
      include: {
        attachments: true,
        author: { select: { id: true, name: true, email: true } },
      },
    },
    events: {
      orderBy: { createdAt: "asc" as const },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    },
    tagLinks: { include: { tag: true } },
    internalNotes: {
      orderBy: { createdAt: "desc" as const },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    },
    assignments: {
      orderBy: { createdAt: "desc" as const },
      take: 5,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    },
  };
}

function conversationListInclude() {
  return {
    contact: true,
    channel: { include: { socialChannel: true } },
    assignee: { select: { id: true, name: true, email: true, image: true } },
    messages: {
      orderBy: { createdAt: "desc" as const },
      take: 1,
      include: { attachments: true },
    },
    tagLinks: { include: { tag: true } },
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const q = searchParams.get("q")?.trim() || "";
    const filter = searchParams.get("filter") || "all";
    const channel = searchParams.get("channel") || "";
    const tag = searchParams.get("tag") || "";
    const agent = searchParams.get("agent") || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const id = searchParams.get("id");
    const seed = searchParams.get("seed") === "1";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (seed) {
      await ensureInboxMockData(prisma, {
        brandId: access.brand.id,
        workspaceId: access.workspace.id,
        userId: user.id!,
      });
    } else {
      await ensureInboxMockData(prisma, {
        brandId: access.brand.id,
        workspaceId: access.workspace.id,
        userId: user.id!,
      });
    }

    if (id) {
      const conversation = await prisma.conversation.findFirst({
        where: { id, brandId: access.brand.id },
        include: conversationDetailInclude(),
      });
      if (!conversation) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }

      const previousConversations = await prisma.conversation.findMany({
        where: {
          brandId: access.brand.id,
          contactId: conversation.contactId,
          id: { not: conversation.id },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 8,
        select: {
          id: true,
          subject: true,
          status: true,
          lastMessageAt: true,
          channel: { include: { socialChannel: true } },
        },
      });

      return NextResponse.json({ conversation, previousConversations });
    }

    const where = {
      brandId: access.brand.id,
      ...(filter === "unread" ? { isUnread: true } : {}),
      ...(filter === "open" ? { status: ConversationStatus.OPEN } : {}),
      ...(filter === "waiting" ? { status: ConversationStatus.WAITING } : {}),
      ...(filter === "resolved"
        ? { status: ConversationStatus.RESOLVED }
        : {}),
      ...(filter === "closed" ? { status: ConversationStatus.CLOSED } : {}),
      ...(filter === "archived"
        ? { status: ConversationStatus.ARCHIVED }
        : {}),
      ...(filter === "assigned" ? { assigneeId: { not: null } } : {}),
      ...(filter === "starred" ? { isStarred: true } : {}),
      ...(filter === "all"
        ? { status: { not: ConversationStatus.ARCHIVED } }
        : {}),
      ...(agent ? { assigneeId: agent } : {}),
      ...(channel
        ? { channel: { socialChannel: { platform: channel as never } } }
        : {}),
      ...(tag
        ? { tagLinks: { some: { tag: { name: tag } } } }
        : {}),
      ...(dateFrom || dateTo
        ? {
            lastMessageAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" as const } },
              {
                contact: {
                  name: { contains: q, mode: "insensitive" as const },
                },
              },
              {
                contact: {
                  instagramUsername: {
                    contains: q,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                contact: {
                  email: { contains: q, mode: "insensitive" as const },
                },
              },
              {
                messages: {
                  some: {
                    body: { contains: q, mode: "insensitive" as const },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const conversations = await prisma.conversation.findMany({
      where,
      include: conversationListInclude(),
      orderBy: [{ isUnread: "desc" }, { lastMessageAt: "desc" }],
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load inbox." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = body.intent as string | undefined;

    if (intent === "message") {
      const parsed = z
        .object({
          workspaceSlug: z.string(),
          brandSlug: z.string(),
          conversationId: z.string(),
          body: z.string().min(1).max(10_000),
          isInternal: z.boolean().optional(),
          kind: z.nativeEnum(MessageKind).optional(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid message." }, { status: 400 });
      }

      const access = await requireBrandAccess(
        parsed.data.workspaceSlug,
        parsed.data.brandSlug,
        user.id!,
      );
      if (!access) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }

      const conversation = await prisma.conversation.findFirst({
        where: { id: parsed.data.conversationId, brandId: access.brand.id },
      });
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 },
        );
      }

      const isInternal = parsed.data.isInternal === true;
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          body: parsed.data.body.trim(),
          direction: isInternal
            ? MessageDirection.SYSTEM
            : MessageDirection.OUTBOUND,
          kind: parsed.data.kind ?? MessageKind.TEXT,
          deliveryStatus: isInternal
            ? MessageDeliveryStatus.SENT
            : MessageDeliveryStatus.DELIVERED,
          isInternal,
          authorId: user.id!,
        },
        include: {
          attachments: true,
          author: { select: { id: true, name: true, email: true } },
        },
      });

      if (isInternal) {
        await prisma.conversationEvent.create({
          data: {
            conversationId: conversation.id,
            type: ConversationEventType.NOTE_ADDED,
            title: "Internal note added",
            userId: user.id!,
          },
        });
      } else {
        await prisma.conversationEvent.create({
          data: {
            conversationId: conversation.id,
            type: ConversationEventType.MESSAGE_SENT,
            title: "Reply sent",
            userId: user.id!,
          },
        });
      }

      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
          isUnread: false,
          unreadCount: 0,
          status:
            conversation.status === ConversationStatus.ARCHIVED
              ? ConversationStatus.OPEN
              : conversation.status,
        },
        include: conversationDetailInclude(),
      });

      return NextResponse.json({ ok: true, conversation: updated, message });
    }

    if (intent === "note") {
      const parsed = z
        .object({
          workspaceSlug: z.string(),
          brandSlug: z.string(),
          conversationId: z.string(),
          body: z.string().min(1).max(10_000),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid note." }, { status: 400 });
      }
      const access = await requireBrandAccess(
        parsed.data.workspaceSlug,
        parsed.data.brandSlug,
        user.id!,
      );
      if (!access) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const conversation = await prisma.conversation.findFirst({
        where: { id: parsed.data.conversationId, brandId: access.brand.id },
      });
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 },
        );
      }
      const note = await prisma.internalNote.create({
        data: {
          brandId: access.brand.id,
          conversationId: conversation.id,
          contactId: conversation.contactId,
          userId: user.id!,
          body: parsed.data.body.trim(),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      await prisma.conversationEvent.create({
        data: {
          conversationId: conversation.id,
          type: ConversationEventType.NOTE_ADDED,
          title: "Internal note added",
          userId: user.id!,
        },
      });
      const updated = await prisma.conversation.findFirst({
        where: { id: conversation.id },
        include: conversationDetailInclude(),
      });
      return NextResponse.json({ ok: true, note, conversation: updated });
    }

    const parsed = z
      .object({
        workspaceSlug: z.string(),
        brandSlug: z.string(),
        contactId: z.string(),
        subject: z.string().max(200).optional(),
        channelId: z.string().optional().nullable(),
      })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid conversation." },
        { status: 400 },
      );
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const contact = await prisma.contact.findFirst({
      where: { id: parsed.data.contactId, brandId: access.brand.id },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        brandId: access.brand.id,
        contactId: contact.id,
        channelId: parsed.data.channelId || null,
        subject: parsed.data.subject?.trim() || "Conversation",
        isUnread: false,
        unreadCount: 0,
        status: ConversationStatus.OPEN,
        events: {
          create: {
            type: ConversationEventType.STARTED,
            title: "Conversation started",
            userId: user.id!,
          },
        },
        participants: {
          create: { contactId: contact.id, role: "customer" },
        },
      },
      include: conversationDetailInclude(),
    });

    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to create." }, { status: 500 });
  }
}

const patchSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  id: z.string(),
  status: z.nativeEnum(ConversationStatus).optional(),
  isUnread: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  assigneeId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  tagNames: z.array(z.string()).optional(),
  contact: z
    .object({
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      language: z.string().nullable().optional(),
      leadStatus: z.string().nullable().optional(),
      lifetimeValue: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const existing = await prisma.conversation.findFirst({
      where: { id: parsed.data.id, brandId: access.brand.id },
      include: { tagLinks: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    if (parsed.data.contact) {
      await prisma.contact.update({
        where: { id: existing.contactId },
        data: {
          ...(parsed.data.contact.name !== undefined
            ? { name: parsed.data.contact.name }
            : {}),
          ...(parsed.data.contact.email !== undefined
            ? { email: parsed.data.contact.email }
            : {}),
          ...(parsed.data.contact.phone !== undefined
            ? { phone: parsed.data.contact.phone }
            : {}),
          ...(parsed.data.contact.country !== undefined
            ? { country: parsed.data.contact.country }
            : {}),
          ...(parsed.data.contact.language !== undefined
            ? { language: parsed.data.contact.language }
            : {}),
          ...(parsed.data.contact.leadStatus !== undefined
            ? { leadStatus: parsed.data.contact.leadStatus }
            : {}),
          ...(parsed.data.contact.lifetimeValue !== undefined
            ? { lifetimeValue: parsed.data.contact.lifetimeValue }
            : {}),
          ...(parsed.data.contact.notes !== undefined
            ? { notes: parsed.data.contact.notes }
            : {}),
          ...(parsed.data.contact.tags !== undefined
            ? { tags: parsed.data.contact.tags }
            : {}),
        },
      });
    }

    if (parsed.data.status && parsed.data.status !== existing.status) {
      await prisma.conversationEvent.create({
        data: {
          conversationId: existing.id,
          type:
            parsed.data.status === ConversationStatus.CLOSED
              ? ConversationEventType.CLOSED
              : ConversationEventType.STATUS_CHANGED,
          title: `Status → ${parsed.data.status}`,
          userId: user.id!,
          meta: { from: existing.status, to: parsed.data.status },
        },
      });
    }

    if (parsed.data.isStarred !== undefined && parsed.data.isStarred !== existing.isStarred) {
      await prisma.conversationEvent.create({
        data: {
          conversationId: existing.id,
          type: parsed.data.isStarred
            ? ConversationEventType.STARRED
            : ConversationEventType.UNSTARRED,
          title: parsed.data.isStarred ? "Starred" : "Unstarred",
          userId: user.id!,
        },
      });
    }

    if (parsed.data.assigneeId !== undefined) {
      if (parsed.data.assigneeId) {
        await prisma.assignment.create({
          data: {
            conversationId: existing.id,
            userId: parsed.data.assigneeId,
            assignedById: user.id!,
          },
        });
        await prisma.conversationEvent.create({
          data: {
            conversationId: existing.id,
            type: ConversationEventType.ASSIGNED,
            title: "Conversation assigned",
            userId: user.id!,
            meta: { assigneeId: parsed.data.assigneeId },
          },
        });
      } else if (existing.assigneeId) {
        await prisma.conversationEvent.create({
          data: {
            conversationId: existing.id,
            type: ConversationEventType.UNASSIGNED,
            title: "Conversation unassigned",
            userId: user.id!,
          },
        });
      }
    }

    if (parsed.data.tagIds) {
      await prisma.conversationTag.deleteMany({
        where: { conversationId: existing.id },
      });
      if (parsed.data.tagIds.length) {
        await prisma.conversationTag.createMany({
          data: parsed.data.tagIds.map((tagId) => ({
            conversationId: existing.id,
            tagId,
          })),
        });
      }
      await prisma.conversationEvent.create({
        data: {
          conversationId: existing.id,
          type: ConversationEventType.TAGGED,
          title: "Tags updated",
          userId: user.id!,
        },
      });
    }

    if (parsed.data.tagNames) {
      const tags = [];
      for (const name of parsed.data.tagNames) {
        const tag = await prisma.inboxTag.upsert({
          where: {
            brandId_name: { brandId: access.brand.id, name },
          },
          create: { brandId: access.brand.id, name },
          update: {},
        });
        tags.push(tag);
      }
      await prisma.conversationTag.deleteMany({
        where: { conversationId: existing.id },
      });
      if (tags.length) {
        await prisma.conversationTag.createMany({
          data: tags.map((t) => ({
            conversationId: existing.id,
            tagId: t.id,
          })),
        });
      }
      await prisma.contact.update({
        where: { id: existing.contactId },
        data: { tags: parsed.data.tagNames },
      });
      await prisma.conversationEvent.create({
        data: {
          conversationId: existing.id,
          type: ConversationEventType.TAGGED,
          title: "Tags updated",
          userId: user.id!,
        },
      });
    }

    const conversation = await prisma.conversation.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.status !== undefined
          ? { status: parsed.data.status }
          : {}),
        ...(parsed.data.isUnread !== undefined
          ? {
              isUnread: parsed.data.isUnread,
              unreadCount: parsed.data.isUnread ? existing.unreadCount || 1 : 0,
            }
          : {}),
        ...(parsed.data.isStarred !== undefined
          ? { isStarred: parsed.data.isStarred }
          : {}),
        ...(parsed.data.assigneeId !== undefined
          ? { assigneeId: parsed.data.assigneeId }
          : {}),
      },
      include: conversationDetailInclude(),
    });

    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}
