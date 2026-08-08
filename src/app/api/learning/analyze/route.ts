import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { getContentLearningEngine } from "@/server/content-learning";
import { learningErrorResponse } from "@/server/content-learning/http";
import { ContentLearningError } from "@/server/content-learning/engine";
import { assertNoTokenLeak } from "@/server/social/credentials";

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  platform: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});

/** POST /api/learning/analyze */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
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

    const result = await getContentLearningEngine().analyze({
      scope: {
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      },
      platform: parsed.data.platform,
      from: parsed.data.from,
      to: parsed.data.to,
    });
    assertNoTokenLeak(result);
    return NextResponse.json(result);
  } catch (error) {
    return learningErrorResponse(error);
  }
}
