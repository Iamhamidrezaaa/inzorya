import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { publishing } from "@/server/publishing";
import { publishingErrorResponse } from "@/server/publishing/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
});

/** Minimal due-schedule execution — no background worker. */
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
    const result = await publishing.processDue({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      limit: parsed.data.limit,
    });
    assertNoTokenLeak(result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
