import type {
  MarketingTaskPriority,
  MarketingTaskStatus,
  MarketingTaskType,
  Prisma,
  ProjectHealth,
  TaskSource,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { TASK_TYPES } from "@/lib/work";
import { runAITask } from "@/server/ai";
import { recordActivity } from "@/server/services/workspace-experience";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const TYPE_SET = new Set(TASK_TYPES.map((t) => t.key));

function parseType(raw: unknown): MarketingTaskType {
  const key = String(raw || "CUSTOM").toUpperCase();
  return (TYPE_SET.has(key as never) ? key : "CUSTOM") as MarketingTaskType;
}

function parsePriority(raw: unknown): MarketingTaskPriority {
  const key = String(raw || "MEDIUM").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(key)) {
    return key as MarketingTaskPriority;
  }
  return "MEDIUM";
}

function parseStatus(raw: unknown): MarketingTaskStatus {
  const key = String(raw || "TODO").toUpperCase();
  if (
    ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE", "ARCHIVED"].includes(
      key,
    )
  ) {
    return key as MarketingTaskStatus;
  }
  return "TODO";
}

function startOfDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfWeek(d = new Date()) {
  const s = startOfDay(d);
  s.setUTCDate(s.getUTCDate() + 7);
  return s;
}

const taskInclude = {
  owner: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, title: true, health: true } },
  campaign: { select: { id: true, name: true } },
  labels: { include: { label: true } },
  subtasks: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
      estimatedMinutes: true,
      sortOrder: true,
    },
  },
  blockedBy: {
    include: {
      fromTask: { select: { id: true, title: true, status: true } },
    },
  },
  blocking: {
    include: {
      toTask: { select: { id: true, title: true, status: true } },
    },
  },
  comments: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { author: { select: { id: true, name: true, email: true } } },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { actor: { select: { id: true, name: true } } },
  },
  watchers: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
};

async function logActivity(input: {
  taskId: string;
  actorId?: string | null;
  kind: string;
  message: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.taskActivity.create({
    data: {
      taskId: input.taskId,
      actorId: input.actorId || null,
      kind: input.kind,
      message: input.message,
      meta: input.meta ? asJson(input.meta) : undefined,
    },
  });
}

function computeProjectHealth(
  tasks: Array<{ status: MarketingTaskStatus; dueDate: Date | null }>,
): ProjectHealth {
  if (!tasks.length) return "HEALTHY";
  const open = tasks.filter((t) => t.status !== "DONE" && t.status !== "ARCHIVED");
  if (!open.length) return "COMPLETED";
  if (open.some((t) => t.status === "BLOCKED")) return "BLOCKED";
  const now = startOfDay();
  if (open.some((t) => t.dueDate && t.dueDate < now)) return "DELAYED";
  if (open.filter((t) => t.status === "IN_REVIEW").length >= 2) return "AT_RISK";
  return "HEALTHY";
}

export async function getWorkBootstrap(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
}) {
  const today = startOfDay();
  const weekEnd = endOfWeek();

  const [tasks, projects, goals, milestones, members] = await Promise.all([
    prisma.marketingTask.findMany({
      where: {
        brandId: input.brandId,
        parentId: null,
        status: { not: "ARCHIVED" },
      },
      include: taskInclude,
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
      take: 120,
    }),
    prisma.marketingProject.findMany({
      where: { brandId: input.brandId, status: { not: "ARCHIVED" } },
      include: {
        campaign: { select: { id: true, name: true } },
        goal: { select: { id: true, title: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.marketingGoal.findMany({
      where: { brandId: input.brandId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.milestone.findMany({
      where: { brandId: input.brandId },
      orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
      take: 30,
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: input.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const myTasks = tasks.filter((t) => t.ownerId === input.userId);
  const todayPriorities = tasks.filter(
    (t) =>
      t.status !== "DONE" &&
      (t.priority === "URGENT" ||
        t.priority === "HIGH" ||
        (t.dueDate && t.dueDate <= today)),
  );
  const blocked = tasks.filter((t) => t.status === "BLOCKED");
  const upcoming = tasks.filter(
    (t) =>
      t.dueDate &&
      t.dueDate > today &&
      t.dueDate <= weekEnd &&
      t.status !== "DONE",
  );
  const completedWeek = await prisma.marketingTask.count({
    where: {
      brandId: input.brandId,
      status: "DONE",
      updatedAt: { gte: today },
    },
  });

  const byOwner = new Map<string, number>();
  for (const t of tasks) {
    if (!t.ownerId || t.status === "DONE") continue;
    const mins = t.estimatedMinutes || 45;
    byOwner.set(t.ownerId, (byOwner.get(t.ownerId) || 0) + mins);
  }
  const workload = members.map((m) => {
    const minutes = byOwner.get(m.userId) || 0;
    return {
      userId: m.userId,
      name: m.user.name || m.user.email,
      estimatedMinutes: minutes,
      overloaded: minutes > 240 * 5,
      free: minutes < 120,
    };
  });

  return {
    tasks,
    projects,
    goals,
    milestones,
    members: members.map((m) => m.user),
    dashboard: {
      myTasks,
      todayPriorities: todayPriorities.slice(0, 8),
      blocked,
      upcomingDeadlines: upcoming.slice(0, 10),
      completedThisWeek: completedWeek,
      campaignProgress: projects.map((p) => ({
        id: p.id,
        title: p.title,
        health: p.health,
        taskCount: p._count.tasks,
        campaign: p.campaign,
      })),
      workload,
    },
    counts: {
      open: tasks.filter((t) => t.status !== "DONE").length,
      blocked: blocked.length,
      mine: myTasks.length,
      projects: projects.length,
    },
  };
}

export async function getTaskDetail(taskId: string, brandId: string) {
  return prisma.marketingTask.findFirst({
    where: { id: taskId, brandId },
    include: taskInclude,
  });
}

export async function createTaskFromSource(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  title: string;
  description?: string;
  type?: MarketingTaskType | string;
  priority?: MarketingTaskPriority | string;
  source: TaskSource;
  sourceKey?: string;
  sourceContext?: Record<string, unknown>;
  projectId?: string;
  campaignId?: string;
  goalId?: string;
  ownerId?: string;
  dueDate?: Date | string | null;
  estimatedMinutes?: number;
  platform?: string;
  checklist?: unknown;
  createProject?: boolean;
  projectTitle?: string;
}) {
  if (input.sourceKey) {
    const existing = await prisma.marketingTask.findUnique({
      where: {
        brandId_sourceKey: {
          brandId: input.brandId,
          sourceKey: input.sourceKey,
        },
      },
      include: taskInclude,
    });
    if (existing) {
      return { task: existing, duplicate: true as const };
    }
  }

  let projectId = input.projectId || null;
  if (input.createProject && !projectId) {
    const projectSourceKey = input.sourceKey
      ? `project:${input.sourceKey}`
      : undefined;
    if (projectSourceKey) {
      const existingProject = await prisma.marketingProject.findUnique({
        where: {
          brandId_sourceKey: {
            brandId: input.brandId,
            sourceKey: projectSourceKey,
          },
        },
      });
      if (existingProject) projectId = existingProject.id;
    }
    if (!projectId) {
      const project = await prisma.marketingProject.create({
        data: {
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          campaignId: input.campaignId || null,
          goalId: input.goalId || null,
          title: (input.projectTitle || input.title).slice(0, 160),
          description: input.description || null,
          source: input.source,
          sourceKey: projectSourceKey || null,
          sourceContext: input.sourceContext
            ? asJson(input.sourceContext)
            : undefined,
        },
      });
      projectId = project.id;
    }
  }

  const task = await prisma.marketingTask.create({
    data: {
      brandId: input.brandId,
      projectId,
      campaignId: input.campaignId || null,
      goalId: input.goalId || null,
      title: input.title.slice(0, 200),
      description: input.description || null,
      type: parseType(input.type),
      priority: parsePriority(input.priority),
      ownerId: input.ownerId || input.userId,
      createdById: input.userId,
      source: input.source,
      sourceKey: input.sourceKey || null,
      sourceContext: input.sourceContext
        ? asJson(input.sourceContext)
        : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      platform: input.platform || null,
      checklist: input.checklist ? asJson(input.checklist) : undefined,
    },
    include: taskInclude,
  });

  await logActivity({
    taskId: task.id,
    actorId: input.userId,
    kind: "created",
    message: `Task created from ${input.source}`,
  });

  await prisma.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.ownerId || input.userId,
      type: "CONTENT",
      title: `Task · ${task.title}`.slice(0, 120),
      body: "Ready to execute",
      href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/work?task=${task.id}`,
    },
  });

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "CONTENT_CREATED",
    title: "Work item created",
    description: task.title,
    href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/work?task=${task.id}`,
  });

  return { task, duplicate: false as const };
}

export async function updateTask(input: {
  brandId: string;
  userId: string;
  taskId: string;
  title?: string;
  description?: string | null;
  type?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedMinutes?: number | null;
  platform?: string | null;
  ownerId?: string | null;
  projectId?: string | null;
  campaignId?: string | null;
  checklist?: unknown;
  blockedReason?: string | null;
  nextAction?: string | null;
}) {
  const existing = await prisma.marketingTask.findFirst({
    where: { id: input.taskId, brandId: input.brandId },
  });
  if (!existing) return null;

  const data: Prisma.MarketingTaskUpdateInput = {};
  if (input.title != null) data.title = input.title.slice(0, 200);
  if (input.description !== undefined) data.description = input.description;
  if (input.type) data.type = parseType(input.type);
  if (input.status) data.status = parseStatus(input.status);
  if (input.priority) data.priority = parsePriority(input.priority);
  if (input.dueDate !== undefined)
    data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.startDate !== undefined)
    data.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.estimatedMinutes !== undefined)
    data.estimatedMinutes = input.estimatedMinutes;
  if (input.platform !== undefined) data.platform = input.platform;
  if (input.ownerId !== undefined) {
    data.owner = input.ownerId
      ? { connect: { id: input.ownerId } }
      : { disconnect: true };
  }
  if (input.projectId !== undefined) {
    data.project = input.projectId
      ? { connect: { id: input.projectId } }
      : { disconnect: true };
  }
  if (input.campaignId !== undefined) {
    data.campaign = input.campaignId
      ? { connect: { id: input.campaignId } }
      : { disconnect: true };
  }
  if (input.checklist !== undefined) data.checklist = asJson(input.checklist);
  if (input.blockedReason !== undefined)
    data.blockedReason = input.blockedReason;
  if (input.nextAction !== undefined) data.nextAction = input.nextAction;

  const task = await prisma.marketingTask.update({
    where: { id: existing.id },
    data,
    include: taskInclude,
  });

  const changes: string[] = [];
  if (input.status && input.status !== existing.status)
    changes.push(`status → ${input.status}`);
  if (input.ownerId !== undefined && input.ownerId !== existing.ownerId)
    changes.push("assignee updated");
  if (input.priority && input.priority !== existing.priority)
    changes.push(`priority → ${input.priority}`);

  if (changes.length) {
    await logActivity({
      taskId: task.id,
      actorId: input.userId,
      kind: "updated",
      message: changes.join(", "),
    });
  }

  if (task.projectId) {
    const siblings = await prisma.marketingTask.findMany({
      where: { projectId: task.projectId },
      select: { status: true, dueDate: true },
    });
    await prisma.marketingProject.update({
      where: { id: task.projectId },
      data: { health: computeProjectHealth(siblings) },
    });
  }

  return task;
}

export async function addTaskComment(input: {
  brandId: string;
  userId: string;
  taskId: string;
  body: string;
  mentions?: string[];
}) {
  const task = await prisma.marketingTask.findFirst({
    where: { id: input.taskId, brandId: input.brandId },
  });
  if (!task) return null;

  const comment = await prisma.taskComment.create({
    data: {
      taskId: task.id,
      authorId: input.userId,
      body: input.body,
      mentions: input.mentions || [],
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await logActivity({
    taskId: task.id,
    actorId: input.userId,
    kind: "comment",
    message: "Commented",
  });

  return comment;
}

export async function toggleWatch(input: {
  brandId: string;
  userId: string;
  taskId: string;
}) {
  const task = await prisma.marketingTask.findFirst({
    where: { id: input.taskId, brandId: input.brandId },
  });
  if (!task) return null;

  const existing = await prisma.taskWatcher.findUnique({
    where: { taskId_userId: { taskId: task.id, userId: input.userId } },
  });
  if (existing) {
    await prisma.taskWatcher.delete({
      where: { taskId_userId: { taskId: task.id, userId: input.userId } },
    });
    return { watching: false };
  }
  await prisma.taskWatcher.create({
    data: { taskId: task.id, userId: input.userId },
  });
  return { watching: true };
}

export async function createProject(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  title: string;
  description?: string;
  campaignId?: string;
  goalId?: string;
  source?: TaskSource;
  sourceKey?: string;
  sourceContext?: Record<string, unknown>;
}) {
  if (input.sourceKey) {
    const existing = await prisma.marketingProject.findUnique({
      where: {
        brandId_sourceKey: {
          brandId: input.brandId,
          sourceKey: input.sourceKey,
        },
      },
    });
    if (existing) return { project: existing, duplicate: true as const };
  }

  const project = await prisma.marketingProject.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      title: input.title.slice(0, 160),
      description: input.description || null,
      campaignId: input.campaignId || null,
      goalId: input.goalId || null,
      source: input.source || "MANUAL",
      sourceKey: input.sourceKey || null,
      sourceContext: input.sourceContext
        ? asJson(input.sourceContext)
        : undefined,
    },
  });

  return { project, duplicate: false as const };
}

export async function upsertGoal(input: {
  brandId: string;
  id?: string;
  title: string;
  description?: string;
  targetDate?: string | null;
  progress?: number;
  status?: string;
}) {
  if (input.id) {
    const existing = await prisma.marketingGoal.findFirst({
      where: { id: input.id, brandId: input.brandId },
    });
    if (!existing) return null;
    return prisma.marketingGoal.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description ?? existing.description,
        targetDate: input.targetDate
          ? new Date(input.targetDate)
          : existing.targetDate,
        progress: input.progress ?? existing.progress,
        status: input.status ?? existing.status,
      },
    });
  }
  return prisma.marketingGoal.create({
    data: {
      brandId: input.brandId,
      title: input.title,
      description: input.description || null,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      progress: input.progress ?? 0,
      status: input.status || "ACTIVE",
    },
  });
}

export async function runTaskAssist(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  mode:
    | "breakdown"
    | "estimate"
    | "order"
    | "blockers"
    | "next_action"
    | "workload"
    | "pipeline";
  taskIds?: string[];
  language?: string;
}) {
  const tasks = await prisma.marketingTask.findMany({
    where: {
      brandId: input.brandId,
      ...(input.taskIds?.length ? { id: { in: input.taskIds } } : {}),
      status: { not: "ARCHIVED" },
    },
    include: {
      subtasks: true,
      blockedBy: true,
      owner: { select: { id: true, name: true } },
    },
    take: 20,
    orderBy: { updatedAt: "desc" },
  });

  const result = await runAITask({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    taskKey: "task.assist",
    input: {
      text: `Task assist mode: ${input.mode}`,
      mode: input.mode,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        type: t.type,
        status: t.status,
        priority: t.priority,
        estimatedMinutes: t.estimatedMinutes,
        dueDate: t.dueDate,
        source: t.source,
        sourceContext: t.sourceContext,
        subtaskCount: t.subtasks.length,
        blockedByCount: t.blockedBy.length,
        owner: t.owner?.name,
      })),
      capacity: { dailyMinutes: 240, weeklyMinutes: 1200 },
      language: input.language || "en",
    },
  });

  const output = (result.output || {}) as Record<string, unknown>;

  if (input.mode === "breakdown" || input.mode === "pipeline") {
    const subtasks = Array.isArray(output.subtasks) ? output.subtasks : [];
    const deps = Array.isArray(output.dependencies) ? output.dependencies : [];
    const parentId =
      input.taskIds?.[0] ||
      (subtasks[0] as Record<string, unknown> | undefined)?.parentId;
    const parent = parentId
      ? tasks.find((t) => t.id === String(parentId))
      : tasks[0];
    if (parent && subtasks.length) {
      const created: Array<{ id: string; title: string }> = [];
      let order = 0;
      for (const raw of subtasks) {
        const s = raw as Record<string, unknown>;
        const title = String(s.title || "").trim();
        if (!title) continue;
        const sourceKey = `sub:${parent.id}:${title.toLowerCase().slice(0, 80)}`;
        const existing = await prisma.marketingTask.findUnique({
          where: {
            brandId_sourceKey: {
              brandId: input.brandId,
              sourceKey,
            },
          },
        });
        if (existing) {
          created.push({ id: existing.id, title: existing.title });
          continue;
        }
        const child = await prisma.marketingTask.create({
          data: {
            brandId: input.brandId,
            parentId: parent.id,
            projectId: parent.projectId,
            campaignId: parent.campaignId,
            title: title.slice(0, 200),
            type: parseType(s.type),
            priority: parsePriority(s.priority),
            estimatedMinutes:
              typeof s.estimatedMinutes === "number"
                ? s.estimatedMinutes
                : null,
            ownerId: parent.ownerId,
            createdById: input.userId,
            source: parent.source,
            sourceKey,
            sourceContext: parent.sourceContext
              ? asJson(parent.sourceContext)
              : undefined,
            sortOrder: order++,
          },
        });
        created.push({ id: child.id, title: child.title });
      }

      for (const raw of deps) {
        const d = raw as Record<string, unknown>;
        const from = created.find(
          (c) => c.title.toLowerCase() === String(d.fromTitle || "").toLowerCase(),
        );
        const to = created.find(
          (c) => c.title.toLowerCase() === String(d.toTitle || "").toLowerCase(),
        );
        if (!from || !to || from.id === to.id) continue;
        await prisma.taskDependency.upsert({
          where: {
            fromTaskId_toTaskId: { fromTaskId: from.id, toTaskId: to.id },
          },
          create: { fromTaskId: from.id, toTaskId: to.id, kind: "blocks" },
          update: {},
        });
      }

      await logActivity({
        taskId: parent.id,
        actorId: input.userId,
        kind: "breakdown",
        message: `Broke into ${created.length} steps`,
      });
    }
  }

  if (input.mode === "estimate") {
    const estimates = Array.isArray(output.estimates) ? output.estimates : [];
    for (const raw of estimates) {
      const e = raw as Record<string, unknown>;
      const taskId = String(e.taskId || "");
      if (!taskId) continue;
      const dueInDays = Number(e.dueInDays);
      const dueDate = Number.isFinite(dueInDays)
        ? new Date(Date.now() + dueInDays * 86400000)
        : undefined;
      await prisma.marketingTask.updateMany({
        where: { id: taskId, brandId: input.brandId },
        data: {
          estimatedMinutes:
            typeof e.estimatedMinutes === "number"
              ? e.estimatedMinutes
              : undefined,
          ...(dueDate ? { dueDate } : {}),
        },
      });
    }
  }

  if (input.mode === "next_action" || input.mode === "blockers") {
    const nextActions = Array.isArray(output.nextActions)
      ? output.nextActions
      : [];
    for (const raw of nextActions) {
      const n = raw as Record<string, unknown>;
      const taskId = String(n.taskId || "");
      if (!taskId) continue;
      await prisma.marketingTask.updateMany({
        where: { id: taskId, brandId: input.brandId },
        data: { nextAction: String(n.action || "") },
      });
    }
    const blockers = Array.isArray(output.blockers) ? output.blockers : [];
    for (const raw of blockers) {
      const b = raw as Record<string, unknown>;
      const taskId = String(b.taskId || "");
      if (!taskId) continue;
      await prisma.marketingTask.updateMany({
        where: { id: taskId, brandId: input.brandId },
        data: {
          status: "BLOCKED",
          blockedReason: String(b.reason || "Blocked"),
        },
      });
    }
  }

  return {
    assist: output,
    bootstrap: await getWorkBootstrap({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
    }),
  };
}
