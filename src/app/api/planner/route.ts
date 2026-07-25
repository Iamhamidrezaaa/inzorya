import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { AIPlatformError } from "@/server/ai";
import {
  MIX_CATEGORIES,
  PLAN_TYPES,
  PLANNER_FORMATS,
  PLANNER_PLATFORMS,
} from "@/lib/planner";
import {
  bulkUpdateItems,
  duplicatePlanItem,
  generateContentPlan,
  getPlanDetail,
  getPlannerBootstrap,
  pushItemsToStudio,
  regeneratePlanItems,
  updatePlanItem,
  updatePlanMeta,
} from "@/server/services/planner";

const scopeSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const planId = searchParams.get("planId");
    const view = searchParams.get("view") || "bootstrap";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (view === "plan" && planId) {
      const plan = await getPlanDetail(planId, access.brand.id);
      if (!plan) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ plan });
    }

    const bootstrap = await getPlannerBootstrap({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({
      ...bootstrap,
      meta: {
        planTypes: PLAN_TYPES,
        mixCategories: MIX_CATEGORIES,
        platforms: PLANNER_PLATFORMS,
        formats: PLANNER_FORMATS,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to load planner." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = String(body.intent || "");
    const scope = scopeSchema.parse(body);
    const access = await requireBrandAccess(
      scope.workspaceSlug,
      scope.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "generate") {
      const plan = await generateContentPlan({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        planType: body.planType || "WEEKLY",
        settings: body.settings,
        startDate: body.startDate,
        title: body.title,
      });
      return NextResponse.json({ plan });
    }

    if (intent === "update_plan") {
      const plan = await updatePlanMeta({
        brandId: access.brand.id,
        planId: String(body.planId || ""),
        status: body.status,
        title: body.title,
      });
      if (!plan) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ plan });
    }

    if (intent === "update_item") {
      const item = await updatePlanItem({
        brandId: access.brand.id,
        itemId: String(body.itemId || ""),
        title: body.title,
        goal: body.goal,
        platform: body.platform,
        contentType: body.contentType,
        mixCategory: body.mixCategory,
        suggestedDate: body.suggestedDate,
        targetAudience: body.targetAudience,
        contentPillar: body.contentPillar,
        campaignName: body.campaignName,
        priority: body.priority,
        expectedOutcome: body.expectedOutcome,
        status: body.status,
      });
      if (!item) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const plan = await getPlanDetail(item.planId, access.brand.id);
      return NextResponse.json({ item, plan });
    }

    if (intent === "bulk_status") {
      await bulkUpdateItems({
        brandId: access.brand.id,
        itemIds: Array.isArray(body.itemIds) ? body.itemIds : [],
        status: body.status === "REJECTED" ? "REJECTED" : "APPROVED",
      });
      const plan = await getPlanDetail(String(body.planId || ""), access.brand.id);
      return NextResponse.json({ plan });
    }

    if (intent === "duplicate_item") {
      const item = await duplicatePlanItem({
        brandId: access.brand.id,
        itemId: String(body.itemId || ""),
      });
      if (!item) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const plan = await getPlanDetail(item.planId, access.brand.id);
      return NextResponse.json({ item, plan });
    }

    if (intent === "regenerate") {
      const plan = await regeneratePlanItems({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        planId: String(body.planId || ""),
        itemIds: body.itemIds,
      });
      if (!plan) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ plan });
    }

    if (intent === "push_studio") {
      const result = await pushItemsToStudio({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        workspaceSlug: scope.workspaceSlug,
        brandSlug: scope.brandSlug,
        planId: String(body.planId || ""),
        itemIds: body.itemIds,
      });
      if (!result) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    if (error instanceof AIPlatformError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: 500 },
    );
  }
}
