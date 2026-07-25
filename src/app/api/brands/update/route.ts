import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

const updateSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  name: z.string().min(2).max(80),
  description: z.string().max(2000).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  industry: z.string().max(120).optional().nullable(),
  brandVoice: z.string().max(5000).optional().nullable(),
  targetAudience: z.string().max(5000).optional().nullable(),
  primaryColor: z.string().max(32).optional().nullable(),
  secondaryColor: z.string().max(32).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid brand data." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const brand = await prisma.brand.update({
      where: { id: access.brand.id },
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        website: parsed.data.website?.trim() || null,
        industry: parsed.data.industry?.trim() || null,
        brandVoice: parsed.data.brandVoice?.trim() || null,
        targetAudience: parsed.data.targetAudience?.trim() || null,
        primaryColor: parsed.data.primaryColor || null,
        secondaryColor: parsed.data.secondaryColor || null,
        logoUrl: parsed.data.logoUrl || null,
      },
    });

    return NextResponse.json({ ok: true, brand });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to update brand." }, { status: 500 });
  }
}
