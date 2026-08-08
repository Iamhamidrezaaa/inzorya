import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { contentWorkspace } from "@/server/content-workspace";
import { contentWorkspaceErrorResponse } from "@/server/content-workspace/http";

type RouteContext = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  action: z.enum([
    "send_for_review",
    "request_changes",
    "approve",
    "mark_ready",
    "note",
  ]),
  note: z.string().max(5000).optional().nullable(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();

    if (body?.action === "publish") {
      contentWorkspace.assertNoPublish();
    }

    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const draft = await contentWorkspace.review(
      id,
      { workspaceId: access.workspace.id, brandId: access.brand.id },
      user.id!,
      parsed.data.action,
      parsed.data.note,
    );

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return contentWorkspaceErrorResponse(error);
  }
}
