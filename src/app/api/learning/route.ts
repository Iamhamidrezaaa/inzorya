import { NextResponse } from "next/server";
import { ContentLearningStatus } from "@prisma/client";
import { requireBrandAccess, requireUser } from "@/server/access";
import { getContentLearningEngine } from "@/server/content-learning";
import { learningErrorResponse } from "@/server/content-learning/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

/** GET /api/learning */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const statusParam = searchParams.get("status");
    const status =
      statusParam &&
      ["ACTIVE", "STALE", "ARCHIVED"].includes(statusParam)
        ? (statusParam as ContentLearningStatus)
        : undefined;

    const learnings = await getContentLearningEngine().list(
      {
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      },
      {
        status,
        platform: searchParams.get("platform") || undefined,
        dimension: searchParams.get("dimension") || undefined,
        limit: Number(searchParams.get("limit") || 40) || 40,
      },
    );
    assertNoTokenLeak(learnings);
    return NextResponse.json({ learnings });
  } catch (error) {
    return learningErrorResponse(error);
  }
}
