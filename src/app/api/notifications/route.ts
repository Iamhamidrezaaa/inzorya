import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireWorkspaceAccess } from "@/server/access";
import { ensureMockNotifications } from "@/server/services/workspace-experience";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug");

    const workspace = await requireWorkspaceAccess(workspaceSlug, user.id!);
    if (!workspace) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await ensureMockNotifications({
      workspaceId: workspace.id,
      userId: user.id!,
      workspaceSlug,
      brandSlug,
    });

    const items = await prisma.notification.findMany({
      where: { userId: user.id!, workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    const unreadCount = items.filter((n) => !n.readAt).length;

    return NextResponse.json({ items, unreadCount });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

const patchSchema = z.object({
  workspaceSlug: z.string(),
  markAllRead: z.boolean().optional(),
  id: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid." }, { status: 400 });
    }

    const workspace = await requireWorkspaceAccess(
      parsed.data.workspaceSlug,
      user.id!,
    );
    if (!workspace) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (parsed.data.markAllRead) {
      await prisma.notification.updateMany({
        where: {
          userId: user.id!,
          workspaceId: workspace.id,
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    } else if (parsed.data.id) {
      await prisma.notification.updateMany({
        where: {
          id: parsed.data.id,
          userId: user.id!,
          workspaceId: workspace.id,
        },
        data: { readAt: new Date() },
      });
    }

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id!,
        workspaceId: workspace.id,
        readAt: null,
      },
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
