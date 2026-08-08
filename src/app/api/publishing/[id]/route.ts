import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import { publishing } from "@/server/publishing";
import { publishingErrorResponse } from "@/server/publishing/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const access = await requireBrandAccess(
      searchParams.get("workspaceSlug") || "",
      searchParams.get("brandSlug") || "",
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const publication = await publishing.get(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    assertNoTokenLeak(publication);
    return NextResponse.json({ publication });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
