import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { contentPlanning } from "@/server/content-planning";
import { planningErrorResponse } from "@/server/content-planning/http";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  plannedDate: z.string().optional(),
  plannedTime: z.string().optional(),
  channel: z.string().optional(),
  timezone: z.string().optional(),
  socialAccountId: z.string().nullable().optional(),
  rationale: z.string().optional(),
});

const deleteSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
});

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const access = await requireBrandAccess(
      searchParams.get("workspaceSlug") || "",
      searchParams.get("brandSlug") || "",
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const plan = await contentPlanning.get(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    return NextResponse.json({ plan });
  } catch (error) {
    return planningErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json();
    if (body?.publish) contentPlanning.assertNoExternalPublish();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid patch." }, { status: 400 });
    }
    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const plan = await contentPlanning.patch(
      id,
      { workspaceId: access.workspace.id, brandId: access.brand.id },
      user.id!,
      parsed.data,
    );
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return planningErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = deleteSchema.safeParse(await request.json().catch(() => ({})));
    const { searchParams } = new URL(request.url);
    const workspaceSlug =
      body.success ? body.data.workspaceSlug : searchParams.get("workspaceSlug") || "";
    const brandSlug =
      body.success ? body.data.brandSlug : searchParams.get("brandSlug") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await contentPlanning.remove(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return planningErrorResponse(error);
  }
}
