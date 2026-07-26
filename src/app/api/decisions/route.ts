import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { AIPlatformError } from "@/server/ai";
import {
  DECISION_ACTIONS,
  DECISION_STATUSES,
  DECISION_TYPES,
  FOCUS_BUCKETS,
  SCORE_KEYS,
} from "@/lib/decisions";
import {
  generateExecutiveBrief,
  getDecisionCenterBootstrap,
  runDecisionAction,
  upsertBusinessPriority,
} from "@/server/services/decisions";

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

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const dashboard = await getDecisionCenterBootstrap({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({
      ...dashboard,
      meta: {
        types: DECISION_TYPES,
        statuses: DECISION_STATUSES,
        actions: DECISION_ACTIONS,
        scoreKeys: SCORE_KEYS,
        focusBuckets: FOCUS_BUCKETS,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load decision center." },
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
      const dashboard = await generateExecutiveBrief({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        workspaceSlug: scope.workspaceSlug,
        brandSlug: scope.brandSlug,
        focusMode: Boolean(body.focusMode),
        language: String(body.language || "en"),
      });
      return NextResponse.json({ dashboard });
    }

    if (intent === "action") {
      const result = await runDecisionAction({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        workspaceSlug: scope.workspaceSlug,
        brandSlug: scope.brandSlug,
        recommendationId: String(body.recommendationId || ""),
        action: body.action,
        note: body.note,
        assigneeId: body.assigneeId,
        postponeDays: body.postponeDays,
      });
      if (!result) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    if (intent === "priority") {
      const priority = await upsertBusinessPriority({
        brandId: access.brand.id,
        id: body.id,
        title: String(body.title || ""),
        detail: body.detail,
        weight: body.weight,
        active: body.active,
      });
      if (!priority) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ priority });
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
