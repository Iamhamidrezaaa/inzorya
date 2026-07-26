import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { AIPlatformError } from "@/server/ai";
import {
  CAMPAIGN_REC_ACTIONS,
  CAMPAIGN_REC_STATUSES,
  CAMPAIGN_SCENARIOS,
  CAMPAIGN_STRATEGIES,
  DEFAULT_ELIGIBILITY,
} from "@/lib/campaign-recommendations";
import {
  generateCampaignRecommendations,
  getRecommendationExplanation,
  getRecommendationScenarios,
  getRecommendationsDashboard,
  runRecommendationAction,
  selectScenario,
} from "@/server/services/campaign-recommendations";

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

    if (view === "explanation") {
      const id = searchParams.get("id") || "";
      const recommendation = await getRecommendationExplanation(
        id,
        access.brand.id,
      );
      if (!recommendation) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ recommendation });
    }

    if (view === "scenarios") {
      const id = searchParams.get("id") || "";
      const scenarios = await getRecommendationScenarios(id, access.brand.id);
      if (!scenarios) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ scenarios });
    }

    const dashboard = await getRecommendationsDashboard({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({
      ...dashboard,
      meta: {
        strategies: CAMPAIGN_STRATEGIES,
        scenarios: CAMPAIGN_SCENARIOS,
        statuses: CAMPAIGN_REC_STATUSES,
        actions: CAMPAIGN_REC_ACTIONS,
        eligibility: DEFAULT_ELIGIBILITY,
        ...(dashboard.meta || {}),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load campaign recommendations." },
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

    if (intent === "generate") {
      const dashboard = await generateCampaignRecommendations({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        workspaceSlug: scope.workspaceSlug,
        brandSlug: scope.brandSlug,
        eligibility: body.eligibility,
        language: String(body.language || "en"),
      });
      return NextResponse.json({ dashboard });
    }

    if (intent === "approve" || intent === "archive" || intent === "action") {
      const action =
        intent === "approve"
          ? "APPROVE"
          : intent === "archive"
            ? "ARCHIVE"
            : String(body.action || "");
      const result = await runRecommendationAction({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        workspaceSlug: scope.workspaceSlug,
        brandSlug: scope.brandSlug,
        recommendationId: String(body.recommendationId || body.id || ""),
        action,
        scenarioId: body.scenarioId,
        note: body.note,
      });
      if (!result || "error" in result) {
        return NextResponse.json(
          { error: result && "error" in result ? result.error : "Not found." },
          { status: result ? 400 : 404 },
        );
      }
      return NextResponse.json(result);
    }

    if (intent === "select_scenario") {
      const recommendation = await selectScenario({
        brandId: access.brand.id,
        recommendationId: String(body.recommendationId || ""),
        scenarioId: String(body.scenarioId || ""),
      });
      if (!recommendation) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ recommendation });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    if (error instanceof AIPlatformError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: 500 },
    );
  }
}
