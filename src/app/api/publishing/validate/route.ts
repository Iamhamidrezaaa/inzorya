import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { publishing } from "@/server/publishing";
import { publishingErrorResponse } from "@/server/publishing/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  contentScheduleId: z.string().min(1),
  socialAccountId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const result = await publishing.validate({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      contentScheduleId: parsed.data.contentScheduleId,
      socialAccountId: parsed.data.socialAccountId,
    });
    assertNoTokenLeak(result);
    return NextResponse.json(result);
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
