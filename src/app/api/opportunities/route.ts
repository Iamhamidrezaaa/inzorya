import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { AIPlatformError } from "@/server/ai";
import {
  ALERT_OFFSETS,
  EVENT_SOURCES,
  PLANNING_MODES,
  SCORE_KEYS,
} from "@/lib/opportunities";
import {
  discoverOpportunities,
  getOpportunitiesBootstrap,
  getOpportunityDetail,
  runOpportunityAction,
  submitOpportunityFeedback,
  updateOpportunity,
} from "@/server/services/opportunities";

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
    const opportunityId = searchParams.get("opportunityId");
    const view = searchParams.get("view") || "dashboard";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (view === "detail" && opportunityId) {
      const opportunity = await getOpportunityDetail(
        opportunityId,
        access.brand.id,
      );
      if (!opportunity) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ opportunity });
    }

    const dashboard = await getOpportunitiesBootstrap({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({
      ...dashboard,
      meta: {
        sources: EVENT_SOURCES,
        planningModes: PLANNING_MODES,
        alertOffsets: ALERT_OFFSETS,
        scoreKeys: SCORE_KEYS,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load opportunities." },
      { status: 500 },
    );
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

    if (intent === "discover") {
      const dashboard = await discoverOpportunities({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        planningMode: body.planningMode || "AUTO",
        constraints: body.constraints,
        horizonDays: body.horizonDays,
      });
      return NextResponse.json({ dashboard });
    }

    if (intent === "update") {
      const opportunity = await updateOpportunity({
        brandId: access.brand.id,
        opportunityId: String(body.opportunityId || ""),
        userId: user.id!,
        status: body.status,
        planningMode: body.planningMode,
        constraints: body.constraints,
      });
      if (!opportunity) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ opportunity });
    }

    if (intent === "feedback") {
      const feedback = await submitOpportunityFeedback({
        brandId: access.brand.id,
        userId: user.id!,
        opportunityId: String(body.opportunityId || ""),
        action: body.action || "ACCEPTED",
        note: body.note,
      });
      if (!feedback) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ feedback });
    }

    if (intent === "action") {
      const result = await runOpportunityAction({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        workspaceSlug: scope.workspaceSlug,
        brandSlug: scope.brandSlug,
        opportunityId: String(body.opportunityId || ""),
        action: body.action,
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
