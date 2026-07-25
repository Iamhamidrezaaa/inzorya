import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireWorkspaceAccess } from "@/server/access";
import { upsertRecentItem } from "@/server/services/workspace-experience";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug") || "";
    const workspace = await requireWorkspaceAccess(workspaceSlug, user.id!);
    if (!workspace) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const items = await prisma.recentItem.findMany({
      where: { userId: user.id!, workspaceId: workspace.id },
      orderBy: { visitedAt: "desc" },
      take: 12,
    });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

const postSchema = z.object({
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
    const parsed = postSchema.safeParse(await request.json());
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

    const item = await upsertRecentItem({
      userId: user.id!,
      workspaceId: workspace.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      title: parsed.data.title,
      href: parsed.data.href,
    });

    // Keep list lean
    const extras = await prisma.recentItem.findMany({
      where: { userId: user.id!, workspaceId: workspace.id },
      orderBy: { visitedAt: "desc" },
      skip: 30,
      select: { id: true },
    });
    if (extras.length > 0) {
      await prisma.recentItem.deleteMany({
        where: { id: { in: extras.map((e) => e.id) } },
      });
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
