import { NextResponse } from "next/server";
import { ConversationStatus, MessageDirection } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

function conversationInclude() {
  return {
    contact: true,
    channel: { include: { socialChannel: true } },
    assignee: { select: { id: true, name: true, email: true } },
    messages: { orderBy: { createdAt: "asc" as const } },
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const q = searchParams.get("q")?.trim() || "";
    const filter = searchParams.get("filter") || "open";
    const id = searchParams.get("id");

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (id) {
      const conversation = await prisma.conversation.findFirst({
        where: { id, brandId: access.brand.id },
        include: conversationInclude(),
      });
      if (!conversation) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ conversation });
    }

    const where = {
      brandId: access.brand.id,
      ...(filter === "unread" ? { isUnread: true } : {}),
      ...(filter === "open" ? { status: ConversationStatus.OPEN } : {}),
      ...(filter === "closed" ? { status: ConversationStatus.CLOSED } : {}),
      ...(filter === "archived" ? { status: ConversationStatus.ARCHIVED } : {}),
      ...(filter === "assigned" ? { assigneeId: { not: null } } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" as const } },
              { contact: { name: { contains: q, mode: "insensitive" as const } } },
              {
                contact: {
                  instagramUsername: { contains: q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        contact: true,
        channel: { include: { socialChannel: true } },
        assignee: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load inbox." }, { status: 500 });
  }
}

const createSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  contactId: z.string(),
  subject: z.string().max(200).optional(),
  channelId: z.string().optional().nullable(),
});

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
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          body: parsed.data.body.trim(),
          direction: MessageDirection.OUTBOUND,
        },
      });

      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
          isUnread: false,
          status:
            conversation.status === ConversationStatus.ARCHIVED
              ? ConversationStatus.OPEN
              : conversation.status,
        },
        include: conversationInclude(),
      });

      return NextResponse.json({ ok: true, conversation: updated, message });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid conversation." }, { status: 400 });
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
        status: ConversationStatus.OPEN,
      },
      include: conversationInclude(),
    });

    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create." }, { status: 500 });
  }
}

const patchSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  id: z.string(),
  status: z.nativeEnum(ConversationStatus).optional(),
  isUnread: z.boolean().optional(),
  assigneeId: z.string().nullable().optional(),
  notes: z.string().max(10_000).optional(),
  tags: z.array(z.string()).optional(),
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
    });
    if (!existing) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    if (parsed.data.notes !== undefined || parsed.data.tags !== undefined) {
      await prisma.contact.update({
        where: { id: existing.contactId },
        data: {
          ...(parsed.data.notes !== undefined
            ? { notes: parsed.data.notes }
            : {}),
          ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
        },
      });
    }

    const conversation = await prisma.conversation.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.isUnread !== undefined
          ? { isUnread: parsed.data.isUnread }
          : {}),
        ...(parsed.data.assigneeId !== undefined
          ? { assigneeId: parsed.data.assigneeId }
          : {}),
      },
      include: conversationInclude(),
    });

    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}
