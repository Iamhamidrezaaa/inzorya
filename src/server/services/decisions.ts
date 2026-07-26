import type {
  DecisionActionType,
  DecisionStatus,
  DecisionType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { DECISION_TYPES } from "@/lib/decisions";
import { runAITask } from "@/server/ai";
import { recordActivity } from "@/server/services/workspace-experience";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function clamp(n: unknown, fallback = 70) {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(100, v));
}

function clampConfidence(n: unknown, fallback = 0.75) {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  if (v > 1) return Math.max(0, Math.min(1, v / 100));
  return Math.max(0, Math.min(1, v));
}

function utcDateOnly(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseType(raw: unknown): DecisionType {
  const key = String(raw || "OTHER").toUpperCase();
  return (
    DECISION_TYPES.some((t) => t.key === key) ? key : "OTHER"
  ) as DecisionType;
}

const recommendationInclude = {
  evidence: { orderBy: { sortOrder: "asc" as const } },
  actions: {
    orderBy: { createdAt: "desc" as const },
    take: 8,
    include: { actor: { select: { id: true, name: true, email: true } } },
  },
};

async function learningSignals(brandId: string) {
  const [actions, memories] = await Promise.all([
    prisma.decisionAction.findMany({
      where: { recommendation: { brandId } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        recommendation: { select: { type: true, title: true, status: true } },
      },
    }),
    prisma.executiveMemory.findMany({
      where: { brandId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    accepted: actions
      .filter((a) => a.type === "APPROVE")
      .map((a) => a.recommendation.type),
    rejected: actions
      .filter((a) => a.type === "REJECT")
      .map((a) => a.recommendation.type),
    postponed: actions
      .filter((a) => a.type === "POSTPONE")
      .map((a) => a.recommendation.type),
    titles: actions.slice(0, 12).map((a) => ({
      type: a.type,
      decision: a.recommendation.title,
      status: a.recommendation.status,
    })),
    memories: memories.map((m) => ({
      category: m.category,
      key: m.key,
      content: m.content,
    })),
  };
}

async function collectSignals(brandId: string) {
  const [
    brand,
    strategy,
    campaigns,
    content,
    conversations,
    opportunities,
    profiles,
    priorities,
  ] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        name: true,
        industry: true,
        targetAudience: true,
        description: true,
      },
    }),
    prisma.marketingStrategy.findUnique({
      where: { brandId },
      select: { goals: true, preferredPlatforms: true, contentTypes: true, tone: true },
    }),
    prisma.campaign.findMany({
      where: { brandId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        status: true,
        objective: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.contentItem.findMany({
      where: { brandId },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        platform: true,
        format: true,
        publishedAt: true,
      },
    }),
    prisma.conversation.findMany({
      where: { brandId, status: "OPEN" },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        contact: { select: { name: true, tags: true } },
      },
    }),
    prisma.businessOpportunity.findMany({
      where: {
        brandId,
        status: { in: ["NEW", "SAVED"] },
      },
      orderBy: { eventDate: "asc" },
      take: 6,
      select: {
        id: true,
        title: true,
        summary: true,
        eventDate: true,
        impactTier: true,
        matchReason: true,
      },
    }),
    prisma.customerProfile.findMany({
      where: { brandId, OR: [{ isVip: true }, { isInfluencer: true }] },
      take: 8,
      select: { isVip: true, isInfluencer: true, summary: true, tags: true },
    }),
    prisma.businessPriority.findMany({
      where: { brandId, active: true },
      orderBy: { weight: "desc" },
      take: 10,
    }),
  ]);

  const vipOpen = conversations.filter((c) =>
    (c.contact?.tags || []).some((t) => /vip/i.test(t)),
  ).length;

  return {
    brand,
    goals: strategy?.goals || [],
    platforms: strategy?.preferredPlatforms || [],
    contentTypes: strategy?.contentTypes || [],
    tone: strategy?.tone || null,
    campaigns,
    content,
    openConversations: conversations.length,
    vipSignals: {
      openVipThreads: vipOpen,
      vipProfiles: profiles.filter((p) => p.isVip).length,
      influencerProfiles: profiles.filter((p) => p.isInfluencer).length,
    },
    opportunities: opportunities.map((o) => ({
      ...o,
      eventDate: o.eventDate.toISOString().slice(0, 10),
    })),
    priorities: priorities.map((p) => ({
      title: p.title,
      detail: p.detail,
      weight: p.weight,
    })),
  };
}

export async function getDecisionCenterBootstrap(input: {
  workspaceId: string;
  brandId: string;
}) {
  const today = utcDateOnly();

  const [daily, morning, pending, priorities, memories] = await Promise.all([
    prisma.executiveBrief.findUnique({
      where: {
        brandId_kind_briefDate: {
          brandId: input.brandId,
          kind: "DAILY",
          briefDate: today,
        },
      },
      include: {
        recommendations: {
          include: recommendationInclude,
          orderBy: [{ priority: "desc" }, { sortOrder: "asc" }],
        },
        insights: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    }),
    prisma.executiveBrief.findUnique({
      where: {
        brandId_kind_briefDate: {
          brandId: input.brandId,
          kind: "MORNING",
          briefDate: today,
        },
      },
    }),
    prisma.decisionRecommendation.findMany({
      where: {
        brandId: input.brandId,
        status: { in: ["PENDING", "POSTPONED", "ASSIGNED"] },
      },
      include: recommendationInclude,
      orderBy: [{ priority: "desc" }, { urgency: "desc" }],
      take: 40,
    }),
    prisma.businessPriority.findMany({
      where: { brandId: input.brandId, active: true },
      orderBy: { weight: "desc" },
    }),
    prisma.executiveMemory.findMany({
      where: { brandId: input.brandId },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  const recommendations = daily?.recommendations?.length
    ? daily.recommendations
    : pending;

  return {
    daily,
    morning,
    recommendations,
    priorities,
    memories,
    counts: {
      pending: pending.filter((r) => r.status === "PENDING").length,
      postponed: pending.filter((r) => r.status === "POSTPONED").length,
      assigned: pending.filter((r) => r.status === "ASSIGNED").length,
      total: recommendations.length,
    },
  };
}

export async function generateExecutiveBrief(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  focusMode?: boolean;
  language?: string;
}) {
  const today = utcDateOnly();
  const signals = await collectSignals(input.brandId);
  const learning = await learningSignals(input.brandId);

  const result = await runAITask({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    taskKey: "decision.brief",
    input: {
      text: "Generate today's executive marketing decision brief",
      signals,
      learningSignals: learning,
      priorities: signals.priorities,
      focusMode: Boolean(input.focusMode),
      language: input.language || "en",
    },
  });

  const output = (result.output || {}) as Record<string, unknown>;
  const dailyOut = (output.daily || {}) as Record<string, unknown>;
  const morningOut = (output.morning || {}) as Record<string, unknown>;
  const rawRecs = Array.isArray(output.recommendations)
    ? output.recommendations
    : [];
  const rawInsights = Array.isArray(output.insights) ? output.insights : [];
  const rawMemories = Array.isArray(output.memories) ? output.memories : [];

  // Replace today's pending AI recommendations for a clean daily slate
  await prisma.decisionRecommendation.deleteMany({
    where: {
      brandId: input.brandId,
      status: "PENDING",
      brief: { kind: "DAILY", briefDate: today },
    },
  });

  const daily = await prisma.executiveBrief.upsert({
    where: {
      brandId_kind_briefDate: {
        brandId: input.brandId,
        kind: "DAILY",
        briefDate: today,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      kind: "DAILY",
      briefDate: today,
      todaysSummary: String(dailyOut.todaysSummary || "No summary yet."),
      motivationalInsight: dailyOut.motivationalInsight
        ? String(dailyOut.motivationalInsight)
        : null,
      topPriorities: asJson(dailyOut.topPriorities || []),
      biggestOpportunities: asJson(dailyOut.biggestOpportunities || []),
      biggestRisks: asJson(dailyOut.biggestRisks || []),
      campaignHealth: dailyOut.campaignHealth
        ? String(dailyOut.campaignHealth)
        : null,
      contentHealth: dailyOut.contentHealth
        ? String(dailyOut.contentHealth)
        : null,
      communityHealth: dailyOut.communityHealth
        ? String(dailyOut.communityHealth)
        : null,
      salesSignals: dailyOut.salesSignals
        ? String(dailyOut.salesSignals)
        : null,
      focusModeSnapshot: asJson({
        enabled: Boolean(input.focusMode),
        attention: "What needs attention",
        wait: "What can wait",
        blocked: "What is blocked",
        next: "What should happen next",
      }),
    },
    update: {
      todaysSummary: String(dailyOut.todaysSummary || "No summary yet."),
      motivationalInsight: dailyOut.motivationalInsight
        ? String(dailyOut.motivationalInsight)
        : null,
      topPriorities: asJson(dailyOut.topPriorities || []),
      biggestOpportunities: asJson(dailyOut.biggestOpportunities || []),
      biggestRisks: asJson(dailyOut.biggestRisks || []),
      campaignHealth: dailyOut.campaignHealth
        ? String(dailyOut.campaignHealth)
        : null,
      contentHealth: dailyOut.contentHealth
        ? String(dailyOut.contentHealth)
        : null,
      communityHealth: dailyOut.communityHealth
        ? String(dailyOut.communityHealth)
        : null,
      salesSignals: dailyOut.salesSignals
        ? String(dailyOut.salesSignals)
        : null,
      focusModeSnapshot: asJson({
        enabled: Boolean(input.focusMode),
      }),
    },
  });

  await prisma.executiveBrief.upsert({
    where: {
      brandId_kind_briefDate: {
        brandId: input.brandId,
        kind: "MORNING",
        briefDate: today,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      kind: "MORNING",
      briefDate: today,
      greeting: morningOut.greeting ? String(morningOut.greeting) : "Good morning.",
      todaysSummary: String(
        morningOut.todaysFocus || dailyOut.todaysSummary || "Today's focus ready.",
      ),
      todaysFocus: morningOut.todaysFocus
        ? String(morningOut.todaysFocus)
        : null,
      motivationalQuote: morningOut.motivationalQuote
        ? String(morningOut.motivationalQuote)
        : null,
      motivationalInsight: dailyOut.motivationalInsight
        ? String(dailyOut.motivationalInsight)
        : null,
      estimatedWorkload: morningOut.estimatedWorkload
        ? String(morningOut.estimatedWorkload)
        : null,
      suggestedSchedule: morningOut.suggestedSchedule
        ? String(morningOut.suggestedSchedule)
        : null,
      topTasks: asJson(morningOut.topTasks || []),
      criticalNotifications: asJson(morningOut.criticalNotifications || []),
    },
    update: {
      greeting: morningOut.greeting ? String(morningOut.greeting) : "Good morning.",
      todaysSummary: String(
        morningOut.todaysFocus || dailyOut.todaysSummary || "Today's focus ready.",
      ),
      todaysFocus: morningOut.todaysFocus
        ? String(morningOut.todaysFocus)
        : null,
      motivationalQuote: morningOut.motivationalQuote
        ? String(morningOut.motivationalQuote)
        : null,
      motivationalInsight: dailyOut.motivationalInsight
        ? String(dailyOut.motivationalInsight)
        : null,
      estimatedWorkload: morningOut.estimatedWorkload
        ? String(morningOut.estimatedWorkload)
        : null,
      suggestedSchedule: morningOut.suggestedSchedule
        ? String(morningOut.suggestedSchedule)
        : null,
      topTasks: asJson(morningOut.topTasks || []),
      criticalNotifications: asJson(morningOut.criticalNotifications || []),
    },
  });

  await prisma.marketingInsight.deleteMany({ where: { briefId: daily.id } });

  let sortOrder = 0;
  for (const raw of rawRecs.slice(0, 8)) {
    const m = raw as Record<string, unknown>;
    const evidence = Array.isArray(m.evidence) ? m.evidence : [];
    if (!evidence.length) continue; // never recommend without evidence

    const rec = await prisma.decisionRecommendation.create({
      data: {
        brandId: input.brandId,
        briefId: daily.id,
        type: parseType(m.type),
        title: String(m.title || "Decision").slice(0, 200),
        summary: String(m.summary || m.recommendedAction || ""),
        priority: clamp(m.priority, 50),
        confidence: clampConfidence(m.confidence),
        businessImpact: clamp(m.businessImpact, 50),
        expectedRoi: clamp(m.expectedRoi, 50),
        effort: clamp(m.effort, 50),
        urgency: clamp(m.urgency, 50),
        reason: String(m.reason || ""),
        whatHappened: String(m.whatHappened || ""),
        whyItMatters: String(m.whyItMatters || ""),
        consequences: String(m.consequences || ""),
        recommendedAction: String(m.recommendedAction || ""),
        alternatives: asJson(m.alternatives || []),
        risks: m.risks ? String(m.risks) : null,
        sortOrder: sortOrder++,
        evidence: {
          create: evidence.slice(0, 6).map((e, i) => {
            const ev = e as Record<string, unknown>;
            return {
              source: String(ev.source || "Signals"),
              label: String(ev.label || "Evidence"),
              detail: String(ev.detail || ""),
              metricValue: ev.metricValue ? String(ev.metricValue) : null,
              sortOrder: i,
            };
          }),
        },
      },
    });
    void rec;
  }

  for (const raw of rawInsights.slice(0, 8)) {
    const i = raw as Record<string, unknown>;
    await prisma.marketingInsight.create({
      data: {
        brandId: input.brandId,
        briefId: daily.id,
        kind: String(i.kind || "insight"),
        title: String(i.title || "Insight").slice(0, 200),
        detail: String(i.detail || ""),
        severity: String(i.severity || "info"),
      },
    });
  }

  for (const raw of rawMemories.slice(0, 6)) {
    const mem = raw as Record<string, unknown>;
    const key = String(mem.key || `auto_${Date.now()}`).slice(0, 80);
    const existing = await prisma.executiveMemory.findFirst({
      where: { brandId: input.brandId, key },
    });
    if (existing) {
      await prisma.executiveMemory.update({
        where: { id: existing.id },
        data: {
          category: String(mem.category || existing.category),
          content: String(mem.content || existing.content),
        },
      });
    } else {
      await prisma.executiveMemory.create({
        data: {
          brandId: input.brandId,
          category: String(mem.category || "strategy"),
          key,
          content: String(mem.content || ""),
        },
      });
    }
  }

  // Critical notifications (lightweight)
  const critical = Array.isArray(morningOut.criticalNotifications)
    ? morningOut.criticalNotifications.map(String).slice(0, 3)
    : [];
  if (critical.length) {
    await prisma.notification.createMany({
      data: critical.map((title) => ({
        workspaceId: input.workspaceId,
        userId: input.userId,
        type: "STRATEGY" as const,
        title: title.slice(0, 120),
        body: "From today's Decision Center brief",
        href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/decisions`,
      })),
    });
  }

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "STRATEGY_UPDATED",
    title: "Executive brief generated",
    description: "AI Marketing Decision Center refreshed today's priorities.",
    href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/decisions`,
  });

  return getDecisionCenterBootstrap({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
  });
}

export async function runDecisionAction(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  recommendationId: string;
  action: DecisionActionType | string;
  note?: string;
  assigneeId?: string;
  postponeDays?: number;
}) {
  const rec = await prisma.decisionRecommendation.findFirst({
    where: { id: input.recommendationId, brandId: input.brandId },
    include: { evidence: true },
  });
  if (!rec) return null;

  const action = String(input.action).toUpperCase() as DecisionActionType;
  let status: DecisionStatus = rec.status;
  let postponedUntil: Date | null = rec.postponedUntil;
  let assigneeId = rec.assigneeId;
  const meta: Record<string, unknown> = {};
  let href: string | undefined;

  if (action === "APPROVE") status = "APPROVED";
  if (action === "REJECT") status = "REJECTED";
  if (action === "POSTPONE") {
    status = "POSTPONED";
    const days = input.postponeDays || 1;
    postponedUntil = new Date();
    postponedUntil.setUTCDate(postponedUntil.getUTCDate() + days);
  }
  if (action === "ASSIGN") {
    status = "ASSIGNED";
    assigneeId = input.assigneeId || input.userId;
  }

  if (action === "CONVERT_CAMPAIGN") {
    const campaign = await prisma.campaign.create({
      data: {
        brandId: input.brandId,
        name: rec.title.slice(0, 120),
        description: rec.summary,
        objective: rec.recommendedAction.slice(0, 500),
        status: "PLANNING",
      },
    });
    status = "APPROVED";
    meta.campaignId = campaign.id;
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/campaigns/${campaign.id}`;
  }

  if (action === "GENERATE_BRIEF") {
    const item = await prisma.contentItem.create({
      data: {
        brandId: input.brandId,
        title: `Brief · ${rec.title}`.slice(0, 200),
        body: "",
        description: rec.summary,
        objective: rec.recommendedAction,
        notes: [
          rec.whatHappened,
          rec.whyItMatters,
          rec.evidence.map((e) => `${e.label}: ${e.detail}`).join("\n"),
        ]
          .filter(Boolean)
          .join("\n\n"),
        status: "BRIEF",
        platform: "INSTAGRAM",
        format: "INSTAGRAM_POST",
        assigneeId: input.userId,
        brief: {
          create: {
            goal: rec.reason,
            hook: rec.title,
            problem: rec.whatHappened,
            solution: rec.recommendedAction,
            cta: rec.recommendedAction,
          },
        },
      },
    });
    status = "APPROVED";
    meta.contentItemId = item.id;
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/studio`;
  }

  if (action === "CREATE_TASK") {
    const { createTaskFromSource } = await import("@/server/services/work");
    const typeHint =
      rec.type === "ANSWER_VIP"
        ? "CUSTOMER_RESPONSE"
        : rec.type === "CREATE_REEL" || rec.type === "PUBLISH_STORY"
          ? "CONTENT_CREATION"
          : rec.type === "CREATE_PROMOTION" || rec.type === "LAUNCH_GIVEAWAY"
            ? "CAMPAIGN_SETUP"
            : "CUSTOM";
    const result = await createTaskFromSource({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      workspaceSlug: input.workspaceSlug,
      brandSlug: input.brandSlug,
      title: rec.title,
      description: [
        rec.recommendedAction,
        rec.reason,
        rec.whatHappened,
        rec.whyItMatters,
      ]
        .filter(Boolean)
        .join("\n\n"),
      type: typeHint,
      priority: rec.urgency >= 85 ? "URGENT" : rec.priority >= 70 ? "HIGH" : "MEDIUM",
      source: "DECISION_CENTER",
      sourceKey: `decision:${rec.id}`,
      sourceContext: {
        recommendationId: rec.id,
        decisionType: rec.type,
        evidence: rec.evidence.map((e) => ({
          source: e.source,
          label: e.label,
          detail: e.detail,
          metricValue: e.metricValue,
        })),
      },
      createProject: false,
    });
    status = "ASSIGNED";
    meta.taskId = result.task.id;
    meta.duplicate = result.duplicate;
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/work?task=${result.task.id}`;
  }

  if (action === "GENERATE_CONTENT") {
    status = "APPROVED";
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/creator`;
    meta.redirect = "creator";
  }

  if (action === "SCHEDULE") {
    status = "APPROVED";
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/planner`;
    meta.redirect = "planner";
  }

  const updated = await prisma.decisionRecommendation.update({
    where: { id: rec.id },
    data: {
      status,
      postponedUntil,
      assigneeId,
    },
    include: recommendationInclude,
  });

  await prisma.decisionAction.create({
    data: {
      recommendationId: rec.id,
      actorId: input.userId,
      type: action,
      note: input.note || null,
      meta: asJson(meta),
    },
  });

  // Executive memory from accept/reject
  if (action === "APPROVE" || action === "REJECT") {
    const key = `decision_${rec.type}_${action.toLowerCase()}`;
    const content =
      action === "APPROVE"
        ? `Accepted ${rec.type}: ${rec.title}`
        : `Rejected ${rec.type}: ${rec.title}${input.note ? ` — ${input.note}` : ""}`;
    const existing = await prisma.executiveMemory.findFirst({
      where: { brandId: input.brandId, key },
    });
    if (existing) {
      await prisma.executiveMemory.update({
        where: { id: existing.id },
        data: { content },
      });
    } else {
      await prisma.executiveMemory.create({
        data: {
          brandId: input.brandId,
          category: "decision_outcome",
          key,
          content,
          meta: asJson({ type: rec.type, action }),
        },
      });
    }
  }

  return { recommendation: updated, href, meta };
}

export async function upsertBusinessPriority(input: {
  brandId: string;
  id?: string;
  title: string;
  detail?: string;
  weight?: number;
  active?: boolean;
}) {
  if (input.id) {
    const existing = await prisma.businessPriority.findFirst({
      where: { id: input.id, brandId: input.brandId },
    });
    if (!existing) return null;
    return prisma.businessPriority.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        detail: input.detail ?? existing.detail,
        weight: input.weight ?? existing.weight,
        active: input.active ?? existing.active,
      },
    });
  }
  return prisma.businessPriority.create({
    data: {
      brandId: input.brandId,
      title: input.title,
      detail: input.detail || null,
      weight: input.weight ?? 50,
      active: input.active ?? true,
    },
  });
}
