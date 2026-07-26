import type {
  Prisma,
  WorkflowStatus,
  WorkflowTimelineKind,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { addUtcDays } from "@/lib/pipeline";
import { recordActivity } from "@/server/services/workspace-experience";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function dateOnly(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const workflowInclude = {
  recommendation: {
    select: {
      id: true,
      name: true,
      status: true,
      strategy: true,
      primaryChannel: true,
      opportunityId: true,
    },
  },
  campaign: { select: { id: true, name: true, status: true } },
  project: { select: { id: true, title: true, status: true } },
  handoffs: { orderBy: { createdAt: "desc" as const }, take: 3 },
  timelines: { orderBy: { dueAt: "asc" as const } },
  dependencies: true,
  audits: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { actor: { select: { id: true, name: true, email: true } } },
  },
};

async function audit(input: {
  workflowId: string;
  actorId?: string | null;
  action: string;
  message: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.workflowAudit.create({
    data: {
      workflowId: input.workflowId,
      actorId: input.actorId || null,
      action: input.action,
      message: input.message,
      before: input.before != null ? asJson(input.before) : undefined,
      after: input.after != null ? asJson(input.after) : undefined,
    },
  });
}

function buildContextFromRecommendation(rec: {
  id: string;
  name: string;
  objective: string;
  targetAudience: string;
  primaryChannel: string;
  supportingChannels: string[];
  priority: number;
  suggestedDurationDays: number;
  contentPlan: unknown;
  strategy: string;
  whyThisCampaign: string;
  whyNow: string;
  opportunity: {
    id: string;
    title: string;
    eventDate: Date;
    whyMatched: string | null;
    event: { id: string; key: string; name: string };
  };
  brand: {
    name: string;
    industry: string | null;
    brandVoice: string | null;
    targetAudience: string | null;
    businessProfile: {
      brandPersonality: string | null;
      targetAudience: string | null;
      country: string | null;
    } | null;
    marketingStrategy: {
      goals: string[];
      preferredPlatforms: string[];
      tone: string | null;
    } | null;
  };
}) {
  return {
    recommendationId: rec.id,
    campaignName: rec.name,
    objective: rec.objective,
    audience: rec.targetAudience,
    contentRequirements: rec.contentPlan,
    channels: {
      primary: rec.primaryChannel,
      supporting: rec.supportingChannels,
    },
    timeline: {
      eventDate: rec.opportunity.eventDate.toISOString().slice(0, 10),
      durationDays: rec.suggestedDurationDays,
    },
    priority: rec.priority,
    strategy: rec.strategy,
    whyThisCampaign: rec.whyThisCampaign,
    whyNow: rec.whyNow,
    opportunity: {
      id: rec.opportunity.id,
      title: rec.opportunity.title,
      whyMatched: rec.opportunity.whyMatched,
      event: rec.opportunity.event,
    },
    businessContext: {
      brandName: rec.brand.name,
      industry: rec.brand.industry,
      brandDna: {
        voice: rec.brand.brandVoice,
        personality: rec.brand.businessProfile?.brandPersonality || null,
        tone: rec.brand.marketingStrategy?.tone || null,
      },
      targetAudience:
        rec.brand.targetAudience ||
        rec.brand.businessProfile?.targetAudience ||
        null,
      country: rec.brand.businessProfile?.country || null,
      goals: rec.brand.marketingStrategy?.goals || [],
      platforms: rec.brand.marketingStrategy?.preferredPlatforms || [],
    },
  };
}

export async function ensureWorkflowFromRecommendation(input: {
  workspaceId: string;
  brandId: string;
  recommendationId: string;
  campaignId?: string | null;
  actorId?: string;
}) {
  const existing = await prisma.campaignWorkflow.findUnique({
    where: { recommendationId: input.recommendationId },
    include: workflowInclude,
  });
  if (existing) {
    if (input.campaignId && !existing.campaignId) {
      return prisma.campaignWorkflow.update({
        where: { id: existing.id },
        data: { campaignId: input.campaignId },
        include: workflowInclude,
      });
    }
    return existing;
  }

  const rec = await prisma.campaignRecommendation.findFirst({
    where: { id: input.recommendationId, brandId: input.brandId },
    include: {
      opportunity: {
        include: { event: { select: { id: true, key: true, name: true } } },
      },
      brand: {
        include: { businessProfile: true, marketingStrategy: true },
      },
    },
  });
  if (!rec) throw new Error("Recommendation not found");

  const anchor = dateOnly(rec.opportunity.eventDate);
  const duration = rec.suggestedDurationDays || 14;
  const planningStart = addUtcDays(anchor, -Math.max(14, duration));
  const reviewAt = addUtcDays(anchor, -5);
  const approvalAt = addUtcDays(anchor, -3);
  const publishingEnd = addUtcDays(anchor, duration);

  const workflow = await prisma.campaignWorkflow.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      recommendationId: rec.id,
      campaignId: input.campaignId || rec.campaignId || null,
      opportunityId: rec.opportunityId,
      title: rec.name.slice(0, 160),
      status: "DRAFT",
      priority: rec.priority,
      anchorDate: anchor,
      planningStart,
      reviewAt,
      approvalAt,
      publishingStart: anchor,
      publishingEnd,
      contentPlanId: rec.contentPlanId || null,
      context: asJson(buildContextFromRecommendation(rec)),
    },
    include: workflowInclude,
  });

  await audit({
    workflowId: workflow.id,
    actorId: input.actorId,
    action: "CREATED",
    message: "Workflow created from approved recommendation",
    after: { status: workflow.status, campaignId: workflow.campaignId },
  });

  return workflow;
}

export async function getPipelineDashboard(input: {
  workspaceId: string;
  brandId: string;
}) {
  const workflows = await prisma.campaignWorkflow.findMany({
    where: { brandId: input.brandId, archivedAt: null },
    include: workflowInclude,
    orderBy: [{ priority: "desc" }, { anchorDate: "asc" }],
    take: 80,
  });

  const byStatus = Object.fromEntries(
    (
      [
        "DRAFT",
        "PLANNING",
        "READY",
        "IN_PROGRESS",
        "WAITING_APPROVAL",
        "SCHEDULED",
        "PUBLISHED",
        "COMPLETED",
        "ARCHIVED",
      ] as WorkflowStatus[]
    ).map((s) => [s, workflows.filter((w) => w.status === s)]),
  ) as Record<WorkflowStatus, typeof workflows>;

  return {
    workflows,
    byStatus,
    counts: {
      total: workflows.length,
      draft: byStatus.DRAFT.length,
      planning: byStatus.PLANNING.length,
      ready: byStatus.READY.length,
      inProgress: byStatus.IN_PROGRESS.length,
      waitingApproval: byStatus.WAITING_APPROVAL.length,
      scheduled: byStatus.SCHEDULED.length,
      published: byStatus.PUBLISHED.length,
      completed: byStatus.COMPLETED.length,
    },
  };
}

export async function getWorkflowStatus(workflowId: string, brandId: string) {
  return prisma.campaignWorkflow.findFirst({
    where: { id: workflowId, brandId },
    include: workflowInclude,
  });
}

/** Planner handoff — create planning workspace + content plan without duplicating */
export async function handoffToPlanner(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  workflowId: string;
}) {
  const workflow = await prisma.campaignWorkflow.findFirst({
    where: { id: input.workflowId, brandId: input.brandId },
  });
  if (!workflow) return null;

  if (workflow.contentPlanId) {
    const existingHandoff = await prisma.plannerHandoff.findFirst({
      where: { workflowId: workflow.id, contentPlanId: workflow.contentPlanId },
      orderBy: { createdAt: "desc" },
    });
    if (existingHandoff) {
      return {
        workflow: await getWorkflowStatus(workflow.id, input.brandId),
        handoff: existingHandoff,
        duplicated: true as const,
      };
    }
  }

  const ctx = (workflow.context || {}) as Record<string, unknown>;
  const channels = (ctx.channels || {}) as {
    primary?: string;
    supporting?: string[];
  };
  const requirements = (ctx.contentRequirements || { items: [] }) as {
    items?: Array<Record<string, unknown>>;
  };
  const items = Array.isArray(requirements.items) ? requirements.items : [];
  const start =
    workflow.planningStart || addUtcDays(workflow.anchorDate, -14);
  const end =
    workflow.publishingEnd || addUtcDays(workflow.anchorDate, 14);

  const plan = await prisma.contentPlan.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      createdById: input.userId,
      title: `Plan · ${workflow.title}`.slice(0, 160),
      type: "CAMPAIGN",
      status: "DRAFT",
      startDate: dateOnly(start),
      endDate: dateOnly(end),
      settings: asJson({
        source: "execution_pipeline",
        workflowId: workflow.id,
        recommendationId: workflow.recommendationId,
        campaignId: workflow.campaignId,
        primaryChannel: channels.primary || "INSTAGRAM",
        timelines: {
          planning: workflow.planningStart,
          review: workflow.reviewAt,
          approval: workflow.approvalAt,
          publishing: {
            start: workflow.publishingStart,
            end: workflow.publishingEnd,
          },
        },
      }),
      summary: String(ctx.objective || workflow.title),
      items: {
        create: items.slice(0, 20).map((item, idx) => {
          const offset = Number(item.publishOffsetDays) || 0;
          const d = addUtcDays(workflow.anchorDate, offset);
          return {
            title: `${String(item.contentType || "CONTENT")} · ${idx + 1}`,
            goal: String(ctx.objective || "").slice(0, 200) || null,
            platform: String(channels.primary || "INSTAGRAM"),
            contentType: String(item.contentType || "INSTAGRAM_POST"),
            suggestedDate: dateOnly(d),
            targetAudience: String(ctx.audience || "").slice(0, 200) || null,
            campaignName: workflow.title,
            campaignId: workflow.campaignId || undefined,
            expectedOutcome: `Qty ${item.quantity || 1}`,
            sortOrder: idx,
            priority:
              Number(ctx.priority) >= 80
                ? ("HIGH" as const)
                : ("MEDIUM" as const),
          };
        }),
      },
    },
  });

  const handoff = await prisma.plannerHandoff.create({
    data: {
      workflowId: workflow.id,
      contentPlanId: plan.id,
      createdById: input.userId,
      payload: asJson({
        ...ctx,
        contentPlanId: plan.id,
        transferredAt: new Date().toISOString(),
      }),
    },
  });

  const before = { status: workflow.status, contentPlanId: workflow.contentPlanId };
  const updated = await prisma.campaignWorkflow.update({
    where: { id: workflow.id },
    data: {
      contentPlanId: plan.id,
      status:
        workflow.status === "DRAFT" || workflow.status === "READY"
          ? "PLANNING"
          : workflow.status,
    },
    include: workflowInclude,
  });

  if (workflow.recommendationId) {
    await prisma.campaignRecommendation.update({
      where: { id: workflow.recommendationId },
      data: {
        contentPlanId: plan.id,
        status: "SENT_TO_PLANNER",
      },
    });
  }

  await audit({
    workflowId: workflow.id,
    actorId: input.userId,
    action: "PLANNER_HANDOFF",
    message: "Planning workspace + content plan created",
    before,
    after: { status: updated.status, contentPlanId: plan.id },
  });

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "STRATEGY_UPDATED",
    title: "Planner handoff",
    description: workflow.title,
    href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/planner`,
  });

  return { workflow: updated, handoff, duplicated: false as const };
}

/** Task handoff — design/copy/video/approval/publishing without duplicates */
export async function createPipelineTasks(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  workflowId: string;
}) {
  const workflow = await prisma.campaignWorkflow.findFirst({
    where: { id: input.workflowId, brandId: input.brandId },
  });
  if (!workflow) return null;

  const { createTaskFromSource } = await import("@/server/services/work");
  const projectKey = `pipeline:wf:${workflow.id}`;

  let projectId = workflow.projectId;
  if (!projectId) {
    const project = await prisma.marketingProject.upsert({
      where: {
        brandId_sourceKey: { brandId: input.brandId, sourceKey: projectKey },
      },
      create: {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        campaignId: workflow.campaignId,
        title: workflow.title.slice(0, 160),
        description: "Execution pipeline project — context preserved on workflow",
        source: "CAMPAIGN_RECOMMENDATION",
        sourceKey: projectKey,
        sourceContext: asJson({ workflowId: workflow.id }),
        startDate: workflow.planningStart,
        endDate: workflow.publishingEnd,
      },
      update: {
        campaignId: workflow.campaignId,
      },
    });
    projectId = project.id;
  }

  const phases: Array<{
    key: string;
    title: string;
    type: string;
    offset: number;
  }> = [
    {
      key: "design",
      title: `Design · ${workflow.title}`,
      type: "DESIGN",
      offset: -10,
    },
    {
      key: "copy",
      title: `Copy · ${workflow.title}`,
      type: "COPYWRITING",
      offset: -8,
    },
    {
      key: "video",
      title: `Video · ${workflow.title}`,
      type: "VIDEO_EDITING",
      offset: -6,
    },
    {
      key: "approval",
      title: `Approval · ${workflow.title}`,
      type: "APPROVAL",
      offset: -3,
    },
    {
      key: "publishing",
      title: `Publishing · ${workflow.title}`,
      type: "PUBLISHING",
      offset: 0,
    },
  ];

  const created: Array<{
    key: string;
    taskId: string;
    duplicate: boolean;
  }> = [];

  for (const phase of phases) {
    const result = await createTaskFromSource({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      workspaceSlug: input.workspaceSlug,
      brandSlug: input.brandSlug,
      title: phase.title.slice(0, 160),
      description:
        "Pipeline task from workflow. Business context preserved in sourceContext.",
      type: phase.type,
      priority: workflow.priority >= 80 ? "HIGH" : "MEDIUM",
      source: "CAMPAIGN_RECOMMENDATION",
      sourceKey: `pipeline:wf:${workflow.id}:${phase.key}`,
      sourceContext: {
        workflowId: workflow.id,
        recommendationId: workflow.recommendationId,
        campaignId: workflow.campaignId,
        phase: phase.key,
        context: workflow.context,
      },
      campaignId: workflow.campaignId || undefined,
      projectId,
      dueDate: addUtcDays(workflow.anchorDate, phase.offset),
      estimatedMinutes: 120,
    });

    created.push({
      key: phase.key,
      taskId: result.task.id,
      duplicate: Boolean(result.duplicate),
    });
  }

  // Task dependencies: design→copy→video→approval→publishing
  const chain = ["design", "copy", "video", "approval", "publishing"];
  for (let i = 0; i < chain.length - 1; i++) {
    const from = created.find((c) => c.key === chain[i]);
    const to = created.find((c) => c.key === chain[i + 1]);
    if (!from || !to) continue;

    const existingDep = await prisma.taskDependency.findFirst({
      where: { fromTaskId: from.taskId, toTaskId: to.taskId },
    });
    if (!existingDep) {
      await prisma.taskDependency.create({
        data: {
          fromTaskId: from.taskId,
          toTaskId: to.taskId,
          kind: "blocks",
        },
      });
    }

    await prisma.workflowDependency.upsert({
      where: {
        workflowId_kind_fromKey_toKey: {
          workflowId: workflow.id,
          kind: chain[i + 1] === "approval" ? "APPROVAL" : "TASK",
          fromKey: chain[i],
          toKey: chain[i + 1],
        },
      },
      create: {
        workflowId: workflow.id,
        kind: chain[i + 1] === "approval" ? "APPROVAL" : "TASK",
        fromKey: chain[i],
        toKey: chain[i + 1],
        fromTaskId: from.taskId,
        toTaskId: to.taskId,
        note: `${chain[i]} must finish before ${chain[i + 1]}`,
      },
      update: {
        fromTaskId: from.taskId,
        toTaskId: to.taskId,
      },
    });
  }

  if (workflow.contentPlanId) {
    await prisma.workflowDependency.upsert({
      where: {
        workflowId_kind_fromKey_toKey: {
          workflowId: workflow.id,
          kind: "CONTENT",
          fromKey: "content_plan",
          toKey: "publishing",
        },
      },
      create: {
        workflowId: workflow.id,
        kind: "CONTENT",
        fromKey: "content_plan",
        toKey: "publishing",
        note: "Content plan items must be ready before publishing",
      },
      update: {},
    });
  }

  if (workflow.campaignId) {
    await prisma.workflowDependency.upsert({
      where: {
        workflowId_kind_fromKey_toKey: {
          workflowId: workflow.id,
          kind: "CAMPAIGN",
          fromKey: "campaign",
          toKey: "publishing",
        },
      },
      create: {
        workflowId: workflow.id,
        kind: "CAMPAIGN",
        fromKey: "campaign",
        toKey: "publishing",
        note: "Campaign stays in PLANNING until human launch",
      },
      update: {},
    });
  }

  const updated = await prisma.campaignWorkflow.update({
    where: { id: workflow.id },
    data: {
      projectId: projectId || workflow.projectId,
      status:
        workflow.status === "DRAFT" || workflow.status === "PLANNING"
          ? "READY"
          : workflow.status === "READY"
            ? "IN_PROGRESS"
            : workflow.status,
    },
    include: workflowInclude,
  });

  await audit({
    workflowId: workflow.id,
    actorId: input.userId,
    action: "TASKS_CREATED",
    message: `Pipeline tasks ensured (${created.filter((c) => !c.duplicate).length} new, ${created.filter((c) => c.duplicate).length} existing)`,
    after: { tasks: created, projectId },
  });

  return { workflow: updated, tasks: created };
}

/** Calendar sync — milestones for planning / review / approval / publishing / reminders */
export async function syncWorkflowCalendar(input: {
  brandId: string;
  userId: string;
  workflowId: string;
}) {
  const workflow = await prisma.campaignWorkflow.findFirst({
    where: { id: input.workflowId, brandId: input.brandId },
  });
  if (!workflow) return null;

  const entries: Array<{
    kind: WorkflowTimelineKind;
    title: string;
    dueAt: Date;
    offsetDays: number;
  }> = [
    {
      kind: "PLANNING",
      title: "Planning start",
      dueAt: workflow.planningStart || addUtcDays(workflow.anchorDate, -14),
      offsetDays: -14,
    },
    {
      kind: "REVIEW",
      title: "Creative review",
      dueAt: workflow.reviewAt || addUtcDays(workflow.anchorDate, -5),
      offsetDays: -5,
    },
    {
      kind: "APPROVAL",
      title: "Approval deadline",
      dueAt: workflow.approvalAt || addUtcDays(workflow.anchorDate, -3),
      offsetDays: -3,
    },
    {
      kind: "PUBLISHING",
      title: "Publishing window open",
      dueAt: workflow.publishingStart || workflow.anchorDate,
      offsetDays: 0,
    },
    {
      kind: "PUBLISHING",
      title: "Publishing window close",
      dueAt: workflow.publishingEnd || addUtcDays(workflow.anchorDate, 7),
      offsetDays: 7,
    },
    {
      kind: "REMINDER",
      title: "Reminder · 7 days out",
      dueAt: addUtcDays(workflow.anchorDate, -7),
      offsetDays: -7,
    },
    {
      kind: "REMINDER",
      title: "Reminder · 1 day out",
      dueAt: addUtcDays(workflow.anchorDate, -1),
      offsetDays: -1,
    },
  ];

  const synced = [];
  for (const entry of entries) {
    let milestoneId: string | null = null;
    const existingTimeline = await prisma.workflowTimeline.findUnique({
      where: {
        workflowId_kind_title: {
          workflowId: workflow.id,
          kind: entry.kind,
          title: entry.title,
        },
      },
    });

    if (existingTimeline?.milestoneId) {
      await prisma.milestone.update({
        where: { id: existingTimeline.milestoneId },
        data: {
          dueDate: entry.dueAt,
          projectId: workflow.projectId,
          title: `${entry.title} · ${workflow.title}`.slice(0, 160),
        },
      });
      milestoneId = existingTimeline.milestoneId;
      await prisma.workflowTimeline.update({
        where: { id: existingTimeline.id },
        data: { dueAt: entry.dueAt, offsetDays: entry.offsetDays },
      });
    } else {
      const milestone = await prisma.milestone.create({
        data: {
          brandId: input.brandId,
          projectId: workflow.projectId,
          title: `${entry.title} · ${workflow.title}`.slice(0, 160),
          description: `Pipeline ${entry.kind.toLowerCase()} milestone`,
          dueDate: entry.dueAt,
          sortOrder: entry.offsetDays,
        },
      });
      milestoneId = milestone.id;
      if (existingTimeline) {
        await prisma.workflowTimeline.update({
          where: { id: existingTimeline.id },
          data: {
            dueAt: entry.dueAt,
            milestoneId,
            offsetDays: entry.offsetDays,
          },
        });
      } else {
        await prisma.workflowTimeline.create({
          data: {
            workflowId: workflow.id,
            kind: entry.kind,
            title: entry.title,
            dueAt: entry.dueAt,
            milestoneId,
            offsetDays: entry.offsetDays,
            meta: asJson({ workflowId: workflow.id }),
          },
        });
      }
    }
    synced.push({ ...entry, milestoneId });
  }

  await audit({
    workflowId: workflow.id,
    actorId: input.userId,
    action: "CALENDAR_SYNC",
    message: "Planning / review / approval / publishing milestones synced",
    after: { count: synced.length },
  });

  return {
    workflow: await getWorkflowStatus(workflow.id, input.brandId),
    timelines: synced,
  };
}

export async function updateWorkflowStatus(input: {
  brandId: string;
  userId: string;
  workflowId: string;
  status: WorkflowStatus | string;
  note?: string;
}) {
  const workflow = await prisma.campaignWorkflow.findFirst({
    where: { id: input.workflowId, brandId: input.brandId },
  });
  if (!workflow) return null;

  const status = String(input.status).toUpperCase() as WorkflowStatus;
  const before = { status: workflow.status };
  const updated = await prisma.campaignWorkflow.update({
    where: { id: workflow.id },
    data: {
      status,
      archivedAt: status === "ARCHIVED" ? new Date() : workflow.archivedAt,
    },
    include: workflowInclude,
  });

  await audit({
    workflowId: workflow.id,
    actorId: input.userId,
    action: "STATUS_CHANGE",
    message: input.note || `Status → ${status}`,
    before,
    after: { status },
  });

  return updated;
}

/** If dates change — update planning, tasks, reminders, publishing */
export async function rescheduleWorkflow(input: {
  brandId: string;
  userId: string;
  workflowId: string;
  anchorDate: Date | string;
}) {
  const workflow = await prisma.campaignWorkflow.findFirst({
    where: { id: input.workflowId, brandId: input.brandId },
  });
  if (!workflow) return null;

  const newAnchor = dateOnly(new Date(input.anchorDate));
  const oldAnchor = dateOnly(workflow.anchorDate);
  const deltaDays = Math.round(
    (newAnchor.getTime() - oldAnchor.getTime()) / 86400000,
  );
  if (deltaDays === 0) {
    return { workflow: await getWorkflowStatus(workflow.id, input.brandId), deltaDays: 0 };
  }

  const before = {
    anchorDate: workflow.anchorDate,
    planningStart: workflow.planningStart,
    reviewAt: workflow.reviewAt,
    approvalAt: workflow.approvalAt,
    publishingStart: workflow.publishingStart,
    publishingEnd: workflow.publishingEnd,
  };

  const shift = (d: Date | null) => (d ? addUtcDays(d, deltaDays) : null);

  const updated = await prisma.campaignWorkflow.update({
    where: { id: workflow.id },
    data: {
      anchorDate: newAnchor,
      planningStart: shift(workflow.planningStart),
      reviewAt: shift(workflow.reviewAt),
      approvalAt: shift(workflow.approvalAt),
      publishingStart: shift(workflow.publishingStart),
      publishingEnd: shift(workflow.publishingEnd),
    },
  });

  const timelines = await prisma.workflowTimeline.findMany({
    where: { workflowId: workflow.id },
  });
  for (const t of timelines) {
    const dueAt = addUtcDays(t.dueAt, deltaDays);
    await prisma.workflowTimeline.update({
      where: { id: t.id },
      data: { dueAt },
    });
    if (t.milestoneId) {
      await prisma.milestone.update({
        where: { id: t.milestoneId },
        data: { dueDate: dueAt },
      });
    }
  }

  const tasks = await prisma.marketingTask.findMany({
    where: {
      brandId: input.brandId,
      sourceKey: { startsWith: `pipeline:wf:${workflow.id}:` },
    },
  });
  for (const task of tasks) {
    await prisma.marketingTask.update({
      where: { id: task.id },
      data: {
        dueDate: task.dueDate ? addUtcDays(task.dueDate, deltaDays) : null,
        startDate: task.startDate ? addUtcDays(task.startDate, deltaDays) : null,
      },
    });
  }

  if (updated.campaignId) {
    await prisma.campaign.update({
      where: { id: updated.campaignId },
      data: {
        startDate: newAnchor,
        endDate: shift(workflow.publishingEnd),
      },
    });
  }

  if (updated.contentPlanId) {
    await prisma.contentPlan.update({
      where: { id: updated.contentPlanId },
      data: {
        startDate: dateOnly(shift(workflow.planningStart) || addUtcDays(newAnchor, -14)),
        endDate: dateOnly(shift(workflow.publishingEnd) || addUtcDays(newAnchor, 14)),
      },
    });
    const planItems = await prisma.contentPlanItem.findMany({
      where: { planId: updated.contentPlanId },
    });
    for (const item of planItems) {
      await prisma.contentPlanItem.update({
        where: { id: item.id },
        data: { suggestedDate: dateOnly(addUtcDays(item.suggestedDate, deltaDays)) },
      });
    }
  }

  await audit({
    workflowId: workflow.id,
    actorId: input.userId,
    action: "RESCHEDULED",
    message: `Anchor shifted by ${deltaDays} day(s)`,
    before,
    after: {
      anchorDate: newAnchor,
      deltaDays,
      tasksUpdated: tasks.length,
      timelinesUpdated: timelines.length,
    },
  });

  return {
    workflow: await getWorkflowStatus(workflow.id, input.brandId),
    deltaDays,
  };
}

/** Full reversible pipeline run: handoff → tasks → calendar */
export async function runExecutionPipeline(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  workflowId?: string;
  recommendationId?: string;
}) {
  let workflowId = input.workflowId;
  if (!workflowId && input.recommendationId) {
    const wf = await ensureWorkflowFromRecommendation({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      recommendationId: input.recommendationId,
      actorId: input.userId,
    });
    workflowId = wf.id;
  }
  if (!workflowId) throw new Error("workflowId or recommendationId required");

  const handoff = await handoffToPlanner({ ...input, workflowId });
  const tasks = await createPipelineTasks({ ...input, workflowId });
  const calendar = await syncWorkflowCalendar({
    brandId: input.brandId,
    userId: input.userId,
    workflowId,
  });

  await updateWorkflowStatus({
    brandId: input.brandId,
    userId: input.userId,
    workflowId,
    status: "IN_PROGRESS",
    note: "Full execution pipeline connected",
  });

  return {
    handoff,
    tasks,
    calendar,
    workflow: await getWorkflowStatus(workflowId, input.brandId),
  };
}

/** Soft archive — reversible */
export async function archiveWorkflow(input: {
  brandId: string;
  userId: string;
  workflowId: string;
  restore?: boolean;
}) {
  if (input.restore) {
    return updateWorkflowStatus({
      brandId: input.brandId,
      userId: input.userId,
      workflowId: input.workflowId,
      status: "DRAFT",
      note: "Workflow restored",
    }).then(async (wf) => {
      if (!wf) return null;
      return prisma.campaignWorkflow.update({
        where: { id: wf.id },
        data: { archivedAt: null },
        include: workflowInclude,
      });
    });
  }
  return updateWorkflowStatus({
    brandId: input.brandId,
    userId: input.userId,
    workflowId: input.workflowId,
    status: "ARCHIVED",
    note: "Workflow archived (reversible)",
  });
}
