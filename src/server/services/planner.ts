import type {
  ContentMixCategory,
  ContentPlanItemStatus,
  ContentPlanType,
  ContentPlatform,
  ContentFormat,
  ContentPriority,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_PLAN_SETTINGS,
  DEFAULT_PLANNING_TEMPLATES,
  MIX_CATEGORIES,
  planSpanDays,
  postsPerWeek,
  type PlanSettings,
  type PlanTypeKey,
} from "@/lib/planner";
import { runAITask } from "@/server/ai";
import { DEFAULT_CHECKLIST } from "@/lib/content-studio";
import { recordActivity } from "@/server/services/workspace-experience";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toDateOnly(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mapPriority(value: unknown): ContentPriority {
  const v = String(value || "MEDIUM").toUpperCase();
  if (v === "LOW" || v === "HIGH" || v === "URGENT") return v;
  return "MEDIUM";
}

function mapMix(value: unknown): ContentMixCategory {
  const v = String(value || "EDUCATIONAL").toUpperCase();
  const ok = MIX_CATEGORIES.some((m) => m.key === v);
  return (ok ? v : "EDUCATIONAL") as ContentMixCategory;
}

function mapPlatform(value: unknown): ContentPlatform {
  const v = String(value || "INSTAGRAM").toUpperCase();
  const allowed: ContentPlatform[] = [
    "INSTAGRAM",
    "FACEBOOK",
    "LINKEDIN",
    "X",
    "TIKTOK",
    "YOUTUBE",
    "BLOG",
    "EMAIL",
    "NEWSLETTER",
    "OTHER",
  ];
  return allowed.includes(v as ContentPlatform)
    ? (v as ContentPlatform)
    : "INSTAGRAM";
}

function mapFormat(value: unknown): ContentFormat {
  const v = String(value || "INSTAGRAM_POST").toUpperCase();
  const allowed: ContentFormat[] = [
    "INSTAGRAM_REEL",
    "INSTAGRAM_CAROUSEL",
    "INSTAGRAM_STORY",
    "INSTAGRAM_POST",
    "FACEBOOK",
    "LINKEDIN",
    "X",
    "TIKTOK",
    "YOUTUBE",
    "SHORT",
    "NEWSLETTER",
    "BLOG",
    "OTHER",
  ];
  return allowed.includes(v as ContentFormat)
    ? (v as ContentFormat)
    : "INSTAGRAM_POST";
}

export async function ensurePlanningTemplates(brandId: string) {
  for (const t of DEFAULT_PLANNING_TEMPLATES) {
    await prisma.planningTemplate.upsert({
      where: { brandId_key: { brandId, key: t.key } },
      create: {
        brandId,
        key: t.key,
        name: t.name,
        description: t.description,
        planType: t.planType,
        defaultSettings: t.defaultSettings as object,
        sortOrder: t.sortOrder,
      },
      update: {
        name: t.name,
        description: t.description,
        defaultSettings: t.defaultSettings as object,
        sortOrder: t.sortOrder,
      },
    });
  }
}

function detectConflicts(
  items: Array<{
    title: string;
    suggestedDate: Date;
    contentPillar: string | null;
    campaignName: string | null;
    mixCategory: string;
  }>,
  settings: PlanSettings,
  start: Date,
  end: Date,
) {
  const conflicts: { kind: string; message: string }[] = [];
  const titles = new Map<string, number>();
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/#\d+/g, "").trim();
    titles.set(key, (titles.get(key) || 0) + 1);
  }
  for (const [title, count] of titles) {
    if (count > 1) {
      conflicts.push({
        kind: "duplicate_topic",
        message: `Duplicate topic detected: “${title}” appears ${count} times.`,
      });
    }
  }

  const byDay = new Map<string, number>();
  for (const it of items) {
    const k = dateKey(it.suggestedDate);
    byDay.set(k, (byDay.get(k) || 0) + 1);
  }
  for (const [day, count] of byDay) {
    if (count > 3) {
      conflicts.push({
        kind: "over_posting",
        message: `Over-posting risk on ${day}: ${count} items scheduled.`,
      });
    }
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    const k = dateKey(cursor);
    if (!byDay.has(k) && cursor.getDay() !== 0 && cursor.getDay() !== 6) {
      // only flag weekday empties for weekly-ish spans under 14 days
      const span =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (span <= 14) {
        conflicts.push({
          kind: "empty_day",
          message: `Empty publishing day: ${k}.`,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const mixCounts = Object.fromEntries(
    settings.contentMix.map((m) => [
      m,
      items.filter((i) => i.mixCategory === m).length,
    ]),
  ) as Record<string, number>;
  const missingMix = settings.contentMix.filter((m) => !mixCounts[m]);
  if (missingMix.length) {
    conflicts.push({
      kind: "unbalanced_distribution",
      message: `Missing mix categories: ${missingMix.join(", ")}.`,
    });
  }

  const pillars = new Set(
    items.map((i) => i.contentPillar).filter(Boolean) as string[],
  );
  if (pillars.size < 2 && items.length >= 5) {
    conflicts.push({
      kind: "missing_pillars",
      message: "Plan relies on too few content pillars.",
    });
  }

  const campaigns = items.filter((i) => i.campaignName).map((i) => i.campaignName!);
  if (campaigns.length >= 4) {
    const uniq = new Set(campaigns);
    if (uniq.size > 2) {
      conflicts.push({
        kind: "campaign_conflict",
        message: "Multiple campaigns compete in the same window — prioritize one.",
      });
    }
  }

  return { conflicts, mixCounts };
}

const planInclude = {
  items: { orderBy: [{ suggestedDate: "asc" as const }, { sortOrder: "asc" as const }] },
  insights: { orderBy: { createdAt: "asc" as const } },
};

export async function getPlannerBootstrap(input: {
  workspaceId: string;
  brandId: string;
}) {
  await ensurePlanningTemplates(input.brandId);
  const [plans, templates, campaigns, strategy] = await Promise.all([
    prisma.contentPlan.findMany({
      where: { brandId: input.brandId, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        _count: { select: { items: true } },
      },
    }),
    prisma.planningTemplate.findMany({
      where: { OR: [{ brandId: input.brandId }, { brandId: null }] },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.campaign.findMany({
      where: { brandId: input.brandId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, name: true, status: true, objective: true },
    }),
    prisma.marketingStrategy.findUnique({
      where: { brandId: input.brandId },
      include: {
        pillars: {
          where: { archivedAt: null },
          orderBy: { sortOrder: "asc" },
        },
        personas: { orderBy: { sortOrder: "asc" }, take: 5 },
      },
    }),
  ]);

  return {
    plans,
    templates,
    campaigns,
    pillars: strategy?.pillars || [],
    personas: strategy?.personas || [],
    goals: strategy?.goals || [],
    defaultSettings: {
      ...DEFAULT_PLAN_SETTINGS,
      businessGoal: strategy?.goals?.[0] || "",
      targetAudience: strategy?.personas?.[0]?.name || "",
      tone: strategy?.tone || DEFAULT_PLAN_SETTINGS.tone,
      platforms:
        strategy?.preferredPlatforms?.length
          ? strategy.preferredPlatforms.map((p) => p.toUpperCase())
          : DEFAULT_PLAN_SETTINGS.platforms,
    } satisfies PlanSettings,
  };
}

export async function getPlanDetail(planId: string, brandId: string) {
  return prisma.contentPlan.findFirst({
    where: { id: planId, brandId },
    include: planInclude,
  });
}

export async function generateContentPlan(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  planType: PlanTypeKey;
  settings?: Partial<PlanSettings>;
  startDate?: string;
  title?: string;
}) {
  const settings: PlanSettings = {
    ...DEFAULT_PLAN_SETTINGS,
    ...(input.settings || {}),
  };
  const start = toDateOnly(input.startDate || new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + planSpanDays(input.planType) - 1);

  const session = await prisma.planningSession.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      planType: input.planType as ContentPlanType,
      settings: settings as object,
      status: "RUNNING",
    },
  });

  try {
    const result = await runAITask({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      taskKey: "planner.generate",
      input: {
        text: `Generate ${input.planType} content plan`,
        planType: input.planType,
        settings,
        startDate: dateKey(start),
        endDate: dateKey(end),
        targetPosts: postsPerWeek(settings.publishingFrequency),
      },
    });

    const output = (result.output || {}) as Record<string, unknown>;
    const rawItems = Array.isArray(output.items) ? output.items : [];

    const normalized = rawItems.map((raw, idx) => {
      const r = raw as Record<string, unknown>;
      return {
        title: String(r.title || `Planned item ${idx + 1}`).slice(0, 200),
        goal: r.goal ? String(r.goal) : null,
        platform: String(r.platform || settings.platforms[0] || "INSTAGRAM"),
        contentType: String(
          r.contentType || settings.preferredFormats[0] || "INSTAGRAM_POST",
        ),
        mixCategory: mapMix(r.mixCategory),
        suggestedDate: toDateOnly(String(r.suggestedDate || dateKey(start))),
        targetAudience: r.targetAudience
          ? String(r.targetAudience)
          : settings.targetAudience || null,
        contentPillar: r.contentPillar ? String(r.contentPillar) : null,
        campaignName: r.campaignName ? String(r.campaignName) : null,
        priority: mapPriority(r.priority),
        expectedOutcome: r.expectedOutcome ? String(r.expectedOutcome) : null,
        insight: r.insight ? String(r.insight) : null,
        sortOrder: idx,
      };
    });

    const { conflicts: autoConflicts, mixCounts } = detectConflicts(
      normalized,
      settings,
      start,
      end,
    );
    const aiConflicts = Array.isArray(output.conflicts)
      ? (output.conflicts as { kind?: string; message?: string }[])
      : [];
    const conflicts = [
      ...aiConflicts.map((c) => ({
        kind: String(c.kind || "conflict"),
        message: String(c.message || "Conflict detected"),
      })),
      ...autoConflicts,
    ];

    const plan = await prisma.contentPlan.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        createdById: input.userId,
        sessionId: session.id,
        title:
          input.title?.trim() ||
          `${input.planType.replaceAll("_", " ")} plan · ${dateKey(start)}`,
        type: input.planType as ContentPlanType,
        status: "REVIEW",
        startDate: start,
        endDate: end,
        settings: settings as object,
        summary: String(output.summary || ""),
        distribution: asJson(output.distribution || mixCounts),
        conflicts: asJson(conflicts),
        items: {
          create: normalized.map((it) => ({
            title: it.title,
            goal: it.goal,
            platform: it.platform,
            contentType: it.contentType,
            mixCategory: it.mixCategory,
            suggestedDate: it.suggestedDate,
            targetAudience: it.targetAudience,
            contentPillar: it.contentPillar,
            campaignName: it.campaignName,
            priority: it.priority,
            expectedOutcome: it.expectedOutcome,
            sortOrder: it.sortOrder,
            status: "SUGGESTED",
          })),
        },
      },
      include: planInclude,
    });

    const insightRows: {
      planId: string;
      itemId?: string;
      kind: string;
      message: string;
      severity: string;
    }[] = [];

    const aiInsights = Array.isArray(output.insights) ? output.insights : [];
    for (const raw of aiInsights) {
      const i = raw as Record<string, unknown>;
      const itemTitle = i.itemTitle ? String(i.itemTitle) : null;
      const item = itemTitle
        ? plan.items.find((x) => x.title === itemTitle)
        : null;
      insightRows.push({
        planId: plan.id,
        itemId: item?.id,
        kind: String(i.kind || "why"),
        message: String(i.message || ""),
        severity: String(i.severity || "info"),
      });
    }
    for (const it of normalized) {
      if (!it.insight) continue;
      const item = plan.items.find((x) => x.title === it.title);
      if (!item) continue;
      if (insightRows.some((r) => r.itemId === item.id)) continue;
      insightRows.push({
        planId: plan.id,
        itemId: item.id,
        kind: "why",
        message: it.insight,
        severity: "info",
      });
    }
    for (const c of conflicts) {
      insightRows.push({
        planId: plan.id,
        kind: c.kind,
        message: c.message,
        severity: "warning",
      });
    }
    if (insightRows.length) {
      await prisma.planningInsight.createMany({ data: insightRows });
    }

    await prisma.planningSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", executionId: result.execution.id },
    });

    await recordActivity({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      kind: "CONTENT_CREATED",
      title: `Content plan generated: ${plan.title}`,
      description: plan.summary,
    });

    return getPlanDetail(plan.id, input.brandId);
  } catch (error) {
    await prisma.planningSession.update({
      where: { id: session.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Failed",
      },
    });
    throw error;
  }
}

export async function updatePlanMeta(input: {
  brandId: string;
  planId: string;
  status?: "DRAFT" | "REVIEW" | "APPROVED" | "PUSHED" | "ARCHIVED";
  title?: string;
}) {
  const existing = await prisma.contentPlan.findFirst({
    where: { id: input.planId, brandId: input.brandId },
  });
  if (!existing) return null;
  return prisma.contentPlan.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      title: input.title?.trim() || undefined,
    },
    include: planInclude,
  });
}

export async function updatePlanItem(input: {
  brandId: string;
  itemId: string;
  title?: string;
  goal?: string | null;
  platform?: string;
  contentType?: string;
  mixCategory?: string;
  suggestedDate?: string;
  targetAudience?: string | null;
  contentPillar?: string | null;
  campaignName?: string | null;
  priority?: string;
  expectedOutcome?: string | null;
  status?: ContentPlanItemStatus;
}) {
  const item = await prisma.contentPlanItem.findFirst({
    where: { id: input.itemId, plan: { brandId: input.brandId } },
  });
  if (!item) return null;

  const updated = await prisma.contentPlanItem.update({
    where: { id: item.id },
    data: {
      title: input.title?.trim() || undefined,
      goal: input.goal === undefined ? undefined : input.goal,
      platform: input.platform,
      contentType: input.contentType,
      mixCategory: input.mixCategory
        ? mapMix(input.mixCategory)
        : undefined,
      suggestedDate: input.suggestedDate
        ? toDateOnly(input.suggestedDate)
        : undefined,
      targetAudience:
        input.targetAudience === undefined ? undefined : input.targetAudience,
      contentPillar:
        input.contentPillar === undefined ? undefined : input.contentPillar,
      campaignName:
        input.campaignName === undefined ? undefined : input.campaignName,
      priority: input.priority ? mapPriority(input.priority) : undefined,
      expectedOutcome:
        input.expectedOutcome === undefined ? undefined : input.expectedOutcome,
      status:
        input.status ||
        (input.suggestedDate || input.title ? "EDITED" : undefined),
    },
  });

  // refresh conflicts lightly
  const plan = await getPlanDetail(item.planId, input.brandId);
  if (plan) {
    const settings = plan.settings as PlanSettings;
    const { conflicts, mixCounts } = detectConflicts(
      plan.items.map((i) => ({
        title: i.title,
        suggestedDate: i.suggestedDate,
        contentPillar: i.contentPillar,
        campaignName: i.campaignName,
        mixCategory: i.mixCategory,
      })),
      settings,
      plan.startDate,
      plan.endDate,
    );
    await prisma.contentPlan.update({
      where: { id: plan.id },
      data: {
        conflicts: asJson(conflicts),
        distribution: asJson(mixCounts),
      },
    });
  }

  return updated;
}

export async function bulkUpdateItems(input: {
  brandId: string;
  itemIds: string[];
  status: ContentPlanItemStatus;
}) {
  const result = await prisma.contentPlanItem.updateMany({
    where: {
      id: { in: input.itemIds },
      plan: { brandId: input.brandId },
      status: { not: "PUSHED" },
    },
    data: { status: input.status },
  });
  return result;
}

export async function duplicatePlanItem(input: {
  brandId: string;
  itemId: string;
}) {
  const item = await prisma.contentPlanItem.findFirst({
    where: { id: input.itemId, plan: { brandId: input.brandId } },
  });
  if (!item) return null;
  const nextDate = new Date(item.suggestedDate);
  nextDate.setDate(nextDate.getDate() + 1);
  return prisma.contentPlanItem.create({
    data: {
      planId: item.planId,
      title: `${item.title} (copy)`,
      goal: item.goal,
      platform: item.platform,
      contentType: item.contentType,
      mixCategory: item.mixCategory,
      suggestedDate: nextDate,
      targetAudience: item.targetAudience,
      contentPillar: item.contentPillar,
      campaignName: item.campaignName,
      campaignId: item.campaignId,
      pillarId: item.pillarId,
      priority: item.priority,
      expectedOutcome: item.expectedOutcome,
      status: "SUGGESTED",
      sortOrder: item.sortOrder + 1,
    },
  });
}

export async function regeneratePlanItems(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  planId: string;
  itemIds?: string[];
}) {
  const plan = await prisma.contentPlan.findFirst({
    where: { id: input.planId, brandId: input.brandId },
    include: { items: true },
  });
  if (!plan) return null;

  const settings = plan.settings as PlanSettings;
  const targets = input.itemIds?.length
    ? plan.items.filter((i) => input.itemIds!.includes(i.id))
    : plan.items.filter((i) => i.status === "SUGGESTED" || i.status === "REJECTED");

  if (!targets.length) return getPlanDetail(plan.id, input.brandId);

  const result = await runAITask({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    taskKey: "planner.generate",
    input: {
      text: "Regenerate selected plan items",
      planType: plan.type,
      settings,
      startDate: dateKey(plan.startDate),
      endDate: dateKey(plan.endDate),
      regenerateItemIds: targets.map((t) => t.id),
      regenerateCount: targets.length,
    },
  });

  const output = (result.output || {}) as Record<string, unknown>;
  const rawItems = Array.isArray(output.items) ? output.items : [];

  for (let i = 0; i < targets.length; i++) {
    const raw = (rawItems[i] || rawItems[i % Math.max(rawItems.length, 1)] || {}) as Record<
      string,
      unknown
    >;
    const target = targets[i];
    await prisma.contentPlanItem.update({
      where: { id: target.id },
      data: {
        title: String(raw.title || target.title).slice(0, 200),
        goal: raw.goal ? String(raw.goal) : target.goal,
        platform: String(raw.platform || target.platform),
        contentType: String(raw.contentType || target.contentType),
        mixCategory: raw.mixCategory ? mapMix(raw.mixCategory) : target.mixCategory,
        targetAudience: raw.targetAudience
          ? String(raw.targetAudience)
          : target.targetAudience,
        contentPillar: raw.contentPillar
          ? String(raw.contentPillar)
          : target.contentPillar,
        campaignName: raw.campaignName
          ? String(raw.campaignName)
          : target.campaignName,
        priority: raw.priority ? mapPriority(raw.priority) : target.priority,
        expectedOutcome: raw.expectedOutcome
          ? String(raw.expectedOutcome)
          : target.expectedOutcome,
        status: "SUGGESTED",
      },
    });
    if (raw.insight) {
      await prisma.planningInsight.create({
        data: {
          planId: plan.id,
          itemId: target.id,
          kind: "why",
          message: String(raw.insight),
          severity: "info",
        },
      });
    }
  }

  return getPlanDetail(plan.id, input.brandId);
}

export async function pushItemsToStudio(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  planId: string;
  itemIds?: string[];
}) {
  const plan = await prisma.contentPlan.findFirst({
    where: { id: input.planId, brandId: input.brandId },
    include: { items: true },
  });
  if (!plan) return null;

  const targets = plan.items.filter((i) => {
    if (i.status === "REJECTED" || i.status === "PUSHED") return false;
    if (input.itemIds?.length) return input.itemIds.includes(i.id);
    return i.status === "APPROVED" || i.status === "EDITED" || i.status === "SUGGESTED";
  });

  // Prefer approved; if bulk push without filter and some approved exist, only those
  const approved = targets.filter((i) => i.status === "APPROVED" || i.status === "EDITED");
  const toPush =
    !input.itemIds?.length && approved.length ? approved : targets;

  const created = [];
  for (const item of toPush) {
    if (item.studioContentId) continue;

    const content = await prisma.contentItem.create({
      data: {
        brandId: input.brandId,
        title: item.title,
        body: "",
        description: item.expectedOutcome || null,
        objective: item.goal || null,
        targetAudience: item.targetAudience || null,
        notes: `From Content Planner · ${plan.title}`,
        status: "IDEAS",
        platform: mapPlatform(item.platform),
        format: mapFormat(item.contentType),
        priority: item.priority,
        dueDate: item.suggestedDate,
        campaignId: item.campaignId,
        pillarId: item.pillarId,
        brief: {
          create: {
            goal: item.goal,
            targetAudience: item.targetAudience,
            hook: null,
          },
        },
        checklist: {
          create: DEFAULT_CHECKLIST.map((label, idx) => ({
            label,
            sortOrder: idx,
          })),
        },
        calendarSlots: {
          create: {
            brandId: input.brandId,
            title: item.title,
            date: item.suggestedDate,
            note: item.expectedOutcome || "Planned via AI Content Planner",
          },
        },
      },
    });

    await prisma.contentPlanItem.update({
      where: { id: item.id },
      data: { status: "PUSHED", studioContentId: content.id },
    });
    created.push(content);
  }

  const remaining = await prisma.contentPlanItem.count({
    where: {
      planId: plan.id,
      status: { notIn: ["PUSHED", "REJECTED"] },
    },
  });
  await prisma.contentPlan.update({
    where: { id: plan.id },
    data: {
      status: remaining === 0 ? "PUSHED" : plan.status === "APPROVED" ? "APPROVED" : "REVIEW",
    },
  });

  if (created.length) {
    await recordActivity({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      kind: "CONTENT_CREATED",
      title: `Pushed ${created.length} planned items to Studio`,
      href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/studio`,
    });
  }

  return {
    createdCount: created.length,
    plan: await getPlanDetail(plan.id, input.brandId),
  };
}
