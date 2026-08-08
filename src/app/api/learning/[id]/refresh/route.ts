import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { getContentLearningEngine } from "@/server/content-learning";
import { learningErrorResponse } from "@/server/content-learning/http";
import { ContentLearningError } from "@/server/content-learning/engine";
import { assertNoTokenLeak } from "@/server/social/credentials";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
});

/** POST /api/learning/[id]/refresh */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ContentLearningError("VALIDATION_ERROR", parsed.error.message);
    }
    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const result = await getContentLearningEngine().refresh(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    assertNoTokenLeak(result);
    return NextResponse.json(result);
  } catch (error) {
    return learningErrorResponse(error);
  }
}
