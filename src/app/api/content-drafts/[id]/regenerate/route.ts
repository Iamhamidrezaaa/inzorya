import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { contentWorkspace } from "@/server/content-workspace";
import { regenerableComponentSchema } from "@/server/content-workspace/types";
import { contentWorkspaceErrorResponse } from "@/server/content-workspace/http";

type RouteContext = { params: Promise<{ id: string }> };

const regenerateSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  component: regenerableComponentSchema,
  instruction: z.string().max(2000).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const parsed = regenerateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid regeneration request." },
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

    const draft = await contentWorkspace.regenerateComponent(
      id,
      { workspaceId: access.workspace.id, brandId: access.brand.id },
      user.id!,
      parsed.data.component,
      parsed.data.instruction,
    );

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return contentWorkspaceErrorResponse(error);
  }
}
