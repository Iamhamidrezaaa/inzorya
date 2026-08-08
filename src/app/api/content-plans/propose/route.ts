import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { contentPlanning } from "@/server/content-planning";
import { planningErrorResponse } from "@/server/content-planning/http";

const proposeSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  message: z.string().min(1),
  draftIds: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  persist: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = proposeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid proposal request." }, { status: 400 });
    }
    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const result = await contentPlanning.propose({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      userId: user.id!,
      message: parsed.data.message,
      draftIds: parsed.data.draftIds,
      timezone: parsed.data.timezone,
      persist: parsed.data.persist,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return planningErrorResponse(error);
  }
}
