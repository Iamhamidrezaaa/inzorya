import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireWorkspaceAccess } from "@/server/access";
import { recordActivity } from "@/server/services/workspace-experience";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug") || "";
    const workspace = await requireWorkspaceAccess(workspaceSlug, user.id!);
    if (!workspace) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const items = await prisma.favorite.findMany({
      where: { userId: user.id!, workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

const upsertSchema = z.object({
  workspaceSlug: z.string(),
  targetType: z.enum([
    "PAGE",
    "KNOWLEDGE",
    "CONTACT",
    "CONTENT",
    "CHANNEL",
    "SETTINGS",
  ]),
  targetId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  href: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = upsertSchema.safeParse(await request.json());
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

    const item = await prisma.favorite.upsert({
      where: {
        userId_workspaceId_targetType_targetId: {
          userId: user.id!,
          workspaceId: workspace.id,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
        },
      },
      create: {
        userId: user.id!,
        workspaceId: workspace.id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        title: parsed.data.title,
        href: parsed.data.href,
      },
      update: {
        title: parsed.data.title,
        href: parsed.data.href,
      },
    });

    await recordActivity({
      workspaceId: workspace.id,
      userId: user.id!,
      kind: "FAVORITE_ADDED",
      title: `Favorited ${parsed.data.title}`,
      href: parsed.data.href,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

const deleteSchema = z.object({
  workspaceSlug: z.string(),
  targetType: z.enum([
    "PAGE",
    "KNOWLEDGE",
    "CONTACT",
    "CONTENT",
    "CHANNEL",
    "SETTINGS",
  ]),
  targetId: z.string().min(1).max(200),
});

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const parsed = deleteSchema.safeParse(await request.json());
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

    await prisma.favorite.deleteMany({
      where: {
        userId: user.id!,
        workspaceId: workspace.id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
