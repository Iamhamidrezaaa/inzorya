import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { AIPlatformError } from "@/server/ai";
import {
  KANBAN_COLUMNS,
  PROJECT_HEALTH,
  TASK_PRIORITIES,
  TASK_SOURCES,
  TASK_STATUSES,
  TASK_TYPES,
  WORK_VIEWS,
} from "@/lib/work";
import {
  addTaskComment,
  createProject,
  createTaskFromSource,
  getTaskDetail,
  getWorkBootstrap,
  runTaskAssist,
  toggleWatch,
  updateTask,
  upsertGoal,
} from "@/server/services/work";

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
    const taskId = searchParams.get("taskId");

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (taskId) {
      const task = await getTaskDetail(taskId, access.brand.id);
      if (!task) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ task });
    }

    const dashboard = await getWorkBootstrap({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      userId: user.id!,
    });

    return NextResponse.json({
      ...dashboard,
      meta: {
        types: TASK_TYPES,
        statuses: TASK_STATUSES,
        priorities: TASK_PRIORITIES,
        sources: TASK_SOURCES,
        health: PROJECT_HEALTH,
        views: WORK_VIEWS,
        kanbanColumns: KANBAN_COLUMNS,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load work engine." },
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

    if (intent === "create_task") {
      const result = await createTaskFromSource({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        workspaceSlug: scope.workspaceSlug,
        brandSlug: scope.brandSlug,
        title: String(body.title || "Untitled task"),
        description: body.description,
        type: body.type,
        priority: body.priority,
        source: body.source || "MANUAL",
        sourceKey: body.sourceKey,
        sourceContext: body.sourceContext,
        projectId: body.projectId,
        campaignId: body.campaignId,
        goalId: body.goalId,
        ownerId: body.ownerId,
        dueDate: body.dueDate,
        estimatedMinutes: body.estimatedMinutes,
        platform: body.platform,
        checklist: body.checklist,
        createProject: Boolean(body.createProject),
        projectTitle: body.projectTitle,
      });
      return NextResponse.json(result);
    }

    if (intent === "update_task") {
      const task = await updateTask({
        brandId: access.brand.id,
        userId: user.id!,
        taskId: String(body.taskId || ""),
        title: body.title,
        description: body.description,
        type: body.type,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate,
        startDate: body.startDate,
        estimatedMinutes: body.estimatedMinutes,
        platform: body.platform,
        ownerId: body.ownerId,
        projectId: body.projectId,
        campaignId: body.campaignId,
        checklist: body.checklist,
        blockedReason: body.blockedReason,
        nextAction: body.nextAction,
      });
      if (!task) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ task });
    }

    if (intent === "comment") {
      const comment = await addTaskComment({
        brandId: access.brand.id,
        userId: user.id!,
        taskId: String(body.taskId || ""),
        body: String(body.body || ""),
        mentions: body.mentions,
      });
      if (!comment) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ comment });
    }

    if (intent === "watch") {
      const result = await toggleWatch({
        brandId: access.brand.id,
        userId: user.id!,
        taskId: String(body.taskId || ""),
      });
      if (!result) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    if (intent === "create_project") {
      const result = await createProject({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        title: String(body.title || "Untitled project"),
        description: body.description,
        campaignId: body.campaignId,
        goalId: body.goalId,
        source: body.source || "MANUAL",
        sourceKey: body.sourceKey,
        sourceContext: body.sourceContext,
      });
      return NextResponse.json(result);
    }

    if (intent === "goal") {
      const goal = await upsertGoal({
        brandId: access.brand.id,
        id: body.id,
        title: String(body.title || ""),
        description: body.description,
        targetDate: body.targetDate,
        progress: body.progress,
        status: body.status,
      });
      if (!goal) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ goal });
    }

    if (intent === "assist") {
      const result = await runTaskAssist({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        mode: body.mode || "next_action",
        taskIds: body.taskIds,
      });
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
