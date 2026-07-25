import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createBrand, getWorkspaceForUser } from "@/server/services/workspace";

const schema = z.object({
  workspaceSlug: z.string().min(1),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid brand details." }, { status: 400 });
    }

    const workspace = await getWorkspaceForUser(
      parsed.data.workspaceSlug,
      session.user.id,
    );
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }

    const brand = await createBrand({
      workspaceId: workspace.id,
      name: parsed.data.name,
      description: parsed.data.description,
      website: parsed.data.website || undefined,
    });

    return NextResponse.json({
      ok: true,
      brandSlug: brand.slug,
      workspaceSlug: workspace.slug,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to create brand." },
      { status: 500 },
    );
  }
}
