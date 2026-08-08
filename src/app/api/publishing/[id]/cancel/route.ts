import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { publishing } from "@/server/publishing";
import { publishingErrorResponse } from "@/server/publishing/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
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
    const publication = await publishing.cancel(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    assertNoTokenLeak(publication);
    return NextResponse.json({ ok: true, publication });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
