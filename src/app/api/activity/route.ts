import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireWorkspaceAccess } from "@/server/access";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug") || "";
    const workspace = await requireWorkspaceAccess(workspaceSlug, user.id!);
    if (!workspace) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    let items = await prisma.activity.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    });

    if (items.length === 0) {
      await prisma.activity.createMany({
        data: [
          {
            workspaceId: workspace.id,
            userId: user.id!,
            kind: "SYSTEM",
            title: "Workspace created",
            description: "Your Inzorya workspace is ready.",
            href: `/w/${workspaceSlug}/home`,
          },
          {
            workspaceId: workspace.id,
            userId: user.id!,
            kind: "SYSTEM",
            title: "Activity timeline online",
            description:
              "Updates to business, channels, knowledge, and strategy will appear here.",
            href: `/w/${workspaceSlug}/activity`,
          },
        ],
      });
      items = await prisma.activity.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      });
    }

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
