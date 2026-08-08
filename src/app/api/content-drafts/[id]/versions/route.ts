import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import { contentWorkspace } from "@/server/content-workspace";
import { contentWorkspaceErrorResponse } from "@/server/content-workspace/http";

type RouteContext = { params: Promise<{ id: string }> };

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

    const versions = await contentWorkspace.listVersions(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({ versions });
  } catch (error) {
    return contentWorkspaceErrorResponse(error);
  }
}
