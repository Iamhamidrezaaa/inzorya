import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import { getContentLearningEngine } from "@/server/content-learning";
import { learningErrorResponse } from "@/server/content-learning/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/learning/[id]/evidence */
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

    const evidence = await getContentLearningEngine().getEvidence(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    assertNoTokenLeak(evidence);
    return NextResponse.json({ evidence });
  } catch (error) {
    return learningErrorResponse(error);
  }
}
