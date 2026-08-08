import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import { getContentLearningEngine } from "@/server/content-learning";
import { learningErrorResponse } from "@/server/content-learning/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/learning/[id] */
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

    const learning = await getContentLearningEngine().get(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    if (!learning) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    assertNoTokenLeak(learning);
    return NextResponse.json({ learning });
  } catch (error) {
    return learningErrorResponse(error);
  }
}
