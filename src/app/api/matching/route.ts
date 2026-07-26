import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { MATCH_FILTERS, MATCH_RULES, SCORE_LEVELS } from "@/lib/matching";
import {
  applyOpportunityOverride,
  getMatchingDashboard,
  getOpportunityConflicts,
  getOpportunityExplanation,
  getOpportunityHistory,
  runDeterministicMatching,
} from "@/server/services/opportunity-matching";

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
    const view = searchParams.get("view") || "dashboard";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (view === "meta") {
      return NextResponse.json({
        rules: MATCH_RULES,
        levels: SCORE_LEVELS,
        filters: MATCH_FILTERS,
      });
    }

    if (view === "explanation" || view === "score") {
      const id = searchParams.get("id") || searchParams.get("opportunityId") || "";
      const opportunity = await getOpportunityExplanation(id, access.brand.id);
      if (!opportunity) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ opportunity });
    }

    if (view === "history") {
      const history = await getOpportunityHistory(access.brand.id);
      return NextResponse.json({ history });
    }

    if (view === "conflicts") {
      const conflicts = await getOpportunityConflicts(access.brand.id);
      return NextResponse.json({ conflicts });
    }

    const dashboard = await getMatchingDashboard({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    return NextResponse.json({
      ...dashboard,
      meta: {
        rules: MATCH_RULES,
        levels: SCORE_LEVELS,
        filters: MATCH_FILTERS,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load matching engine." },
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

    if (intent === "run" || intent === "score") {
      const dashboard = await runDeterministicMatching({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        horizonDays: body.horizonDays,
      });
      return NextResponse.json({ dashboard });
    }

    if (intent === "override") {
      const override = await applyOpportunityOverride({
        brandId: access.brand.id,
        eventId: body.eventId,
        opportunityId: body.opportunityId,
        kind: body.kind,
        priority: body.priority,
        note: body.note,
        active: body.active,
      });
      return NextResponse.json({ override });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: 500 },
    );
  }
}
