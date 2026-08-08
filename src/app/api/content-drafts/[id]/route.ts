import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { contentWorkspace } from "@/server/content-workspace";
import { humanEditSchema } from "@/server/content-workspace/types";
import { contentWorkspaceErrorResponse } from "@/server/content-workspace/http";

type RouteContext = { params: Promise<{ id: string }> };

const scopeSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
});

const patchSchema = scopeSchema.extend({
  edit: humanEditSchema.optional(),
});

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const draft = await contentWorkspace.get(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    const [versions, reviews] = await Promise.all([
      contentWorkspace.listVersions(id, {
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      }),
      contentWorkspace.listReviews(id, {
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      }),
    ]);

    return NextResponse.json({ draft, versions, reviews });
  } catch (error) {
    return contentWorkspaceErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();

    if (body?.action === "publish" || body?.publish) {
      contentWorkspace.assertNoPublish();
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success || !parsed.data.edit) {
      return NextResponse.json({ error: "Invalid edit payload." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const draft = await contentWorkspace.humanEdit(
      id,
      { workspaceId: access.workspace.id, brandId: access.brand.id },
      user.id!,
      parsed.data.edit,
    );

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return contentWorkspaceErrorResponse(error);
  }
}
