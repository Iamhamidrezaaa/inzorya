import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/access";

const schema = z.object({
  workspaceSlug: z.string(),
  name: z.string().min(2).max(80),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid workspace." }, { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        slug: parsed.data.workspaceSlug,
        members: { some: { userId: user.id } },
      },
    });
    if (!workspace) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { name: parsed.data.name.trim() },
    });

    return NextResponse.json({ ok: true, workspace: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
