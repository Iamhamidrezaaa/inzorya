import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  PIPELINE_STAGES,
  WORKFLOW_STATUSES,
  WORKFLOW_TIMELINE_KINDS,
} from "@/lib/pipeline";
import {
  archiveWorkflow,
  createPipelineTasks,
  getPipelineDashboard,
  getWorkflowStatus,
  handoffToPlanner,
  rescheduleWorkflow,
  runExecutionPipeline,
  syncWorkflowCalendar,
  updateWorkflowStatus,
} from "@/server/services/execution-pipeline";

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

    if (view === "status" || view === "workflow") {
      const id = searchParams.get("id") || searchParams.get("workflowId") || "";
      const workflow = await getWorkflowStatus(id, access.brand.id);
      if (!workflow) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ workflow });
    }

    const dashboard = await getPipelineDashboard({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({
      ...dashboard,
      meta: {
        statuses: WORKFLOW_STATUSES,
        timelineKinds: WORKFLOW_TIMELINE_KINDS,
        stages: PIPELINE_STAGES,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load execution pipeline." },
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

    const base = {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      userId: user.id!,
      workspaceSlug: scope.workspaceSlug,
      brandSlug: scope.brandSlug,
    };

    if (intent === "handoff" || intent === "planner_handoff") {
      const result = await handoffToPlanner({
        ...base,
        workflowId: String(body.workflowId || ""),
      });
      if (!result) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    if (intent === "create_tasks" || intent === "tasks_create") {
      const result = await createPipelineTasks({
        ...base,
        workflowId: String(body.workflowId || ""),
      });
      if (!result) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    if (intent === "calendar_sync" || intent === "sync") {
      const result = await syncWorkflowCalendar({
        brandId: access.brand.id,
        userId: user.id!,
        workflowId: String(body.workflowId || ""),
      });
      if (!result) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    if (intent === "status" || intent === "workflow_status") {
      const workflow = await updateWorkflowStatus({
        brandId: access.brand.id,
        userId: user.id!,
        workflowId: String(body.workflowId || ""),
        status: String(body.status || ""),
        note: body.note,
      });
      if (!workflow) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ workflow });
    }

    if (intent === "reschedule") {
      const result = await rescheduleWorkflow({
        brandId: access.brand.id,
        userId: user.id!,
        workflowId: String(body.workflowId || ""),
        anchorDate: body.anchorDate,
      });
      if (!result) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    if (intent === "run" || intent === "pipeline") {
      const result = await runExecutionPipeline({
        ...base,
        workflowId: body.workflowId,
        recommendationId: body.recommendationId,
      });
      return NextResponse.json(result);
    }

    if (intent === "archive") {
      const workflow = await archiveWorkflow({
        brandId: access.brand.id,
        userId: user.id!,
        workflowId: String(body.workflowId || ""),
        restore: Boolean(body.restore),
      });
      if (!workflow) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ workflow });
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
