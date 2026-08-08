import { NextResponse } from "next/server";
import { z } from "zod";
import { ContentScheduleStatus } from "@prisma/client";
import { requireBrandAccess, requireUser } from "@/server/access";
import { contentPlanning } from "@/server/content-planning";
import { planningErrorResponse } from "@/server/content-planning/http";

const createSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  contentDraftId: z.string().min(1),
  channel: z.string().optional(),
  socialAccountId: z.string().nullable().optional(),
  plannedDate: z.string().min(1),
  plannedTime: z.string().min(1),
  timezone: z.string().optional(),
  rationale: z.string().optional(),
});

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
    let status: ContentScheduleStatus | ContentScheduleStatus[] | undefined;
    if (statusParam && statusParam !== "ALL") {
      status = statusParam.includes(",")
        ? (statusParam.split(",") as ContentScheduleStatus[])
        : (statusParam as ContentScheduleStatus);
    }

    const plans = await contentPlanning.list(
      { workspaceId: access.workspace.id, brandId: access.brand.id },
      {
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
        status,
      },
    );
    const conflicts = await contentPlanning.conflictsForBrand(
      { workspaceId: access.workspace.id, brandId: access.brand.id },
      searchParams.get("from") || undefined,
      searchParams.get("to") || undefined,
    );

    return NextResponse.json({ plans, conflicts });
  } catch (error) {
    return planningErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    if (body?.publish || body?.action === "publish") {
      contentPlanning.assertNoExternalPublish();
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }
    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const plan = await contentPlanning.createFromReadyDraft({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      userId: user.id!,
      contentDraftId: parsed.data.contentDraftId,
      channel: parsed.data.channel,
      socialAccountId: parsed.data.socialAccountId,
      plannedDate: parsed.data.plannedDate,
      plannedTime: parsed.data.plannedTime,
      timezone: parsed.data.timezone,
      rationale: parsed.data.rationale,
      planningSource: "HUMAN",
    });

    return NextResponse.json({ ok: true, plan }, { status: 201 });
  } catch (error) {
    return planningErrorResponse(error);
  }
}
