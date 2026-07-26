import type {
  MarketingEventSource,
  OpportunityAlertOffset,
  OpportunityFeedbackAction,
  OpportunityPlanningMode,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ALERT_OFFSETS,
  OPPORTUNITY_CATEGORIES,
  SEED_EVENTS,
  daysUntil,
  nextOccurrence,
} from "@/lib/opportunities";
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

const opportunityInclude = {
  event: { include: { category: true } },
  score: true,
  recommendations: { orderBy: { sortOrder: "asc" as const } },
  alerts: { orderBy: { notifyAt: "asc" as const } },
  feedback: { orderBy: { createdAt: "desc" as const }, take: 5 },
};

export async function ensureOpportunityCatalog() {
  for (const c of OPPORTUNITY_CATEGORIES) {
    await prisma.opportunityCategory.upsert({
      where: { key: c.key },
      create: {
        key: c.key,
        name: c.name,
        sortOrder: c.sortOrder,
      },
      update: { name: c.name, sortOrder: c.sortOrder },
    });
  }

  const categories = await prisma.opportunityCategory.findMany();
  const byKey = Object.fromEntries(categories.map((c) => [c.key, c.id]));

  for (const e of SEED_EVENTS) {
    await prisma.marketingEvent.upsert({
      where: { key: e.key },
      create: {
        key: e.key,
        name: e.name,
        description: e.description,
        source: e.source as MarketingEventSource,
        categoryId: byKey[e.categoryKey] || null,
        month: e.month,
        day: e.day,
        countries: e.countries || [],
        industries: e.industries || [],
        tags: e.tags || [],
        audienceHints: e.audienceHints || [],
        active: true,
      },
      update: {
        name: e.name,
        description: e.description,
        source: e.source as MarketingEventSource,
        categoryId: byKey[e.categoryKey] || null,
        month: e.month,
        day: e.day,
        countries: e.countries || [],
        industries: e.industries || [],
        tags: e.tags || [],
        audienceHints: e.audienceHints || [],
        active: true,
      },
    });
  }
}

async function learningSignals(brandId: string) {
  const recent = await prisma.opportunityFeedback.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      opportunity: {
        select: {
          title: true,
          event: { select: { key: true, source: true, tags: true } },
        },
      },
    },
  });
  return {
    accepted: recent
      .filter((f) => f.action === "ACCEPTED" || f.action === "ACTED")
      .map((f) => f.opportunity?.event.key)
      .filter(Boolean),
    rejected: recent
      .filter((f) => f.action === "REJECTED" || f.action === "DISMISSED")
      .map((f) => f.opportunity?.event.key)
      .filter(Boolean),
    notes: recent
      .filter((f) => f.note)
      .slice(0, 10)
      .map((f) => f.note),
  };
}

function createAlertsForDate(eventDate: Date) {
  return ALERT_OFFSETS.map((o) => {
    const notifyAt = new Date(eventDate);
    notifyAt.setUTCDate(notifyAt.getUTCDate() - o.days);
    return {
      offset: o.key as OpportunityAlertOffset,
      notifyAt,
    };
  });
}

export async function getOpportunitiesBootstrap(input: {
  workspaceId: string;
  brandId: string;
}) {
  await ensureOpportunityCatalog();
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const opportunities = await prisma.businessOpportunity.findMany({
    where: { brandId: input.brandId },
    include: opportunityInclude,
    orderBy: [{ eventDate: "asc" }],
    take: 100,
  });

  // Mark overdue NEW/SAVED as MISSED
  const overdue = opportunities.filter(
    (o) =>
      o.eventDate < today &&
      (o.status === "NEW" || o.status === "SAVED"),
  );
  if (overdue.length) {
    await prisma.businessOpportunity.updateMany({
      where: { id: { in: overdue.map((o) => o.id) } },
      data: { status: "MISSED" },
    });
  }

  const refreshed = overdue.length
    ? await prisma.businessOpportunity.findMany({
        where: { brandId: input.brandId },
        include: opportunityInclude,
        orderBy: [{ eventDate: "asc" }],
        take: 100,
      })
    : opportunities;

  const upcoming = refreshed.filter(
    (o) => o.eventDate >= today && o.status !== "DISMISSED" && o.status !== "MISSED",
  );
  const missed = refreshed.filter((o) => o.status === "MISSED");
  const highImpact = upcoming.filter(
    (o) => o.impactTier === "high" || (o.score?.overall || 0) >= 85,
  );
  const industry = upcoming.filter(
    (o) =>
      o.event.source === "INDUSTRY_CONFERENCE" ||
      o.event.source === "TECHNOLOGY" ||
      o.event.category?.key === "industry",
  );
  const seasonal = upcoming.filter(
    (o) =>
      o.event.source === "SEASONAL" ||
      o.event.source === "WEATHER_SEASON" ||
      o.event.category?.key === "seasonal",
  );

  const pendingAlerts = await prisma.opportunityAlert.findMany({
    where: {
      opportunity: { brandId: input.brandId, status: { in: ["NEW", "SAVED"] } },
      sentAt: null,
      dismissedAt: null,
      notifyAt: { lte: new Date(Date.now() + 2 * 86400000) },
    },
    include: {
      opportunity: {
        select: { id: true, title: true, eventDate: true, status: true },
      },
    },
    orderBy: { notifyAt: "asc" },
    take: 20,
  });

  return {
    upcoming,
    missed,
    highImpact,
    industry,
    seasonal,
    pendingAlerts,
    counts: {
      upcoming: upcoming.length,
      missed: missed.length,
      highImpact: highImpact.length,
      saved: refreshed.filter((o) => o.status === "SAVED").length,
    },
  };
}

export async function getOpportunityDetail(id: string, brandId: string) {
  return prisma.businessOpportunity.findFirst({
    where: { id, brandId },
    include: opportunityInclude,
  });
}

export async function discoverOpportunities(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  planningMode?: OpportunityPlanningMode;
  constraints?: Record<string, unknown>;
  horizonDays?: number;
  language?: string;
}) {
  await ensureOpportunityCatalog();
  const planningMode = input.planningMode || "AUTO";
  const horizon = input.horizonDays || 90;
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + horizon);

  const brand = await prisma.brand.findUnique({
    where: { id: input.brandId },
    select: { industry: true, targetAudience: true, name: true },
  });

  const events = await prisma.marketingEvent.findMany({
    where: { active: true },
    include: { category: true },
  });

  const candidates = events
    .map((e) => {
      if (e.month == null || e.day == null) return null;
      const eventDate = nextOccurrence(e.month, e.day, today);
      if (eventDate < today || eventDate > end) return null;
      // Soft industry filter — keep general events
      if (
        e.industries.length &&
        brand?.industry &&
        !e.industries.some((i) =>
          brand.industry!.toLowerCase().includes(i.toLowerCase()),
        ) &&
        !brand.industry
          .toLowerCase()
          .split(/\s|\/|,/)
          .some((part) => e.industries.some((i) => i.includes(part.trim())))
      ) {
        // keep anyway if no industries matched but event is international/shopping — still candidate for AI
      }
      return {
        key: e.key,
        name: e.name,
        description: e.description,
        source: e.source,
        category: e.category?.key,
        eventDate: eventDate.toISOString().slice(0, 10),
        daysUntil: daysUntil(eventDate, today),
        tags: e.tags,
        industries: e.industries,
        countries: e.countries,
        audienceHints: e.audienceHints,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  // Prefer nearer + shopping/seasonal for AI payload size
  candidates.sort((a, b) => Number(a.daysUntil) - Number(b.daysUntil));
  const payloadEvents = candidates.slice(0, 18);

  const learning = await learningSignals(input.brandId);

  const result = await runAITask({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    taskKey: "opportunity.match",
    input: {
      text: "Match upcoming marketing opportunities to this business",
      events: payloadEvents,
      planningMode,
      constraints: input.constraints || {},
      learningSignals: learning,
      language: input.language || "en",
    },
  });

  const output = (result.output || {}) as Record<string, unknown>;
  const matches = Array.isArray(output.matches) ? output.matches : [];
  const createdIds: string[] = [];

  for (const raw of matches) {
    const m = raw as Record<string, unknown>;
    const eventKey = String(m.eventKey || "");
    const event = events.find((e) => e.key === eventKey);
    if (!event || event.month == null || event.day == null) continue;

    const eventDate = nextOccurrence(event.month, event.day, today);
    const score = (m.score || {}) as Record<string, unknown>;
    const overall = clamp(score.overall);
    const impactTier = String(m.impactTier || (overall >= 85 ? "high" : "medium"));

    // Skip low-relevance noise
    if (clamp(score.relevance, 0) < 55 && overall < 60) continue;

    const existing = await prisma.businessOpportunity.findUnique({
      where: {
        brandId_eventId_eventDate: {
          brandId: input.brandId,
          eventId: event.id,
          eventDate,
        },
      },
    });

    if (existing && (existing.status === "DISMISSED" || existing.status === "ACTED")) {
      continue;
    }

    const opportunity = existing
      ? await prisma.businessOpportunity.update({
          where: { id: existing.id },
          data: {
            title: String(m.title || event.name).slice(0, 200),
            summary: String(m.summary || event.description || ""),
            matchReason: String(m.matchReason || "Matched to business context."),
            planningMode,
            constraints: input.constraints ? asJson(input.constraints) : undefined,
            impactTier,
            status: existing.status === "MISSED" ? "NEW" : existing.status,
          },
        })
      : await prisma.businessOpportunity.create({
          data: {
            workspaceId: input.workspaceId,
            brandId: input.brandId,
            eventId: event.id,
            title: String(m.title || event.name).slice(0, 200),
            summary: String(m.summary || event.description || ""),
            matchReason: String(m.matchReason || "Matched to business context."),
            eventDate,
            planningMode,
            constraints: input.constraints ? asJson(input.constraints) : undefined,
            impactTier,
            status: "NEW",
          },
        });

    await prisma.opportunityScore.upsert({
      where: { opportunityId: opportunity.id },
      create: {
        opportunityId: opportunity.id,
        relevance: clamp(score.relevance),
        urgency: clamp(score.urgency),
        expectedReach: clamp(score.expectedReach),
        salesPotential: clamp(score.salesPotential),
        engagementPotential: clamp(score.engagementPotential),
        difficulty: clamp(score.difficulty, 45),
        confidence: clamp(score.confidence),
        overall,
        explanation: String(
          score.explanation ||
            "Score prioritizes business relevance and timing for this brand.",
        ),
      },
      update: {
        relevance: clamp(score.relevance),
        urgency: clamp(score.urgency),
        expectedReach: clamp(score.expectedReach),
        salesPotential: clamp(score.salesPotential),
        engagementPotential: clamp(score.engagementPotential),
        difficulty: clamp(score.difficulty, 45),
        confidence: clamp(score.confidence),
        overall,
        explanation: String(
          score.explanation ||
            "Score prioritizes business relevance and timing for this brand.",
        ),
      },
    });

    await prisma.opportunityRecommendation.deleteMany({
      where: { opportunityId: opportunity.id },
    });
    const recs = Array.isArray(m.recommendations) ? m.recommendations : [];
    if (recs.length) {
      await prisma.opportunityRecommendation.createMany({
        data: recs.slice(0, 12).map((r, idx) => {
          const row = r as Record<string, unknown>;
          return {
            opportunityId: opportunity.id,
            kind: String(row.kind || "campaign"),
            title: String(row.title || "Idea").slice(0, 200),
            detail: String(row.detail || ""),
            sortOrder: idx,
          };
        }),
      });
    }

    for (const alert of createAlertsForDate(eventDate)) {
      await prisma.opportunityAlert.upsert({
        where: {
          opportunityId_offset: {
            opportunityId: opportunity.id,
            offset: alert.offset,
          },
        },
        create: {
          opportunityId: opportunity.id,
          offset: alert.offset,
          notifyAt: alert.notifyAt,
        },
        update: {
          notifyAt: alert.notifyAt,
        },
      });
    }

    createdIds.push(opportunity.id);
  }

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "STRATEGY_UPDATED",
    title: `Opportunity scan complete · ${createdIds.length} matched`,
    description: `Planning mode: ${planningMode}`,
  });

  return getOpportunitiesBootstrap({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
  });
}

export async function updateOpportunity(input: {
  brandId: string;
  opportunityId: string;
  userId: string;
  status?: "NEW" | "SAVED" | "DISMISSED" | "ACTED" | "MISSED";
  planningMode?: OpportunityPlanningMode;
  constraints?: Record<string, unknown>;
}) {
  const existing = await prisma.businessOpportunity.findFirst({
    where: { id: input.opportunityId, brandId: input.brandId },
  });
  if (!existing) return null;

  const updated = await prisma.businessOpportunity.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      planningMode: input.planningMode,
      constraints:
        input.constraints !== undefined ? asJson(input.constraints) : undefined,
    },
    include: opportunityInclude,
  });

  if (input.status === "SAVED" || input.status === "DISMISSED" || input.status === "ACTED") {
    await prisma.opportunityFeedback.create({
      data: {
        brandId: input.brandId,
        opportunityId: existing.id,
        userId: input.userId,
        action: input.status as OpportunityFeedbackAction,
      },
    });
  }

  return updated;
}

export async function submitOpportunityFeedback(input: {
  brandId: string;
  userId: string;
  opportunityId: string;
  action: OpportunityFeedbackAction;
  note?: string;
}) {
  const existing = await prisma.businessOpportunity.findFirst({
    where: { id: input.opportunityId, brandId: input.brandId },
  });
  if (!existing) return null;

  if (input.action === "ACCEPTED" || input.action === "ACTED") {
    await prisma.businessOpportunity.update({
      where: { id: existing.id },
      data: { status: input.action === "ACTED" ? "ACTED" : "SAVED" },
    });
  }
  if (input.action === "REJECTED" || input.action === "DISMISSED") {
    await prisma.businessOpportunity.update({
      where: { id: existing.id },
      data: { status: "DISMISSED" },
    });
  }

  return prisma.opportunityFeedback.create({
    data: {
      brandId: input.brandId,
      opportunityId: existing.id,
      userId: input.userId,
      action: input.action,
      note: input.note || null,
    },
  });
}

export async function runOpportunityAction(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  opportunityId: string;
  action:
    | "create_campaign"
    | "generate_brief"
    | "create_offer"
    | "schedule_content"
    | "generate_content_plan";
}) {
  const opportunity = await prisma.businessOpportunity.findFirst({
    where: { id: input.opportunityId, brandId: input.brandId },
    include: {
      event: true,
      recommendations: true,
      score: true,
    },
  });
  if (!opportunity) return null;

  let result: Record<string, unknown> = {};

  if (input.action === "create_campaign") {
    const campaign = await prisma.campaign.create({
      data: {
        brandId: input.brandId,
        name: opportunity.title.slice(0, 120),
        description: opportunity.summary,
        objective: opportunity.matchReason.slice(0, 500),
        status: "PLANNING",
        startDate: opportunity.eventDate,
        endDate: new Date(
          opportunity.eventDate.getTime() + 7 * 86400000,
        ),
      },
    });
    result = {
      campaignId: campaign.id,
      href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/campaigns/${campaign.id}`,
    };
  }

  if (input.action === "generate_brief") {
    const briefRec = opportunity.recommendations.find((r) => r.kind === "campaign");
    const item = await prisma.contentItem.create({
      data: {
        brandId: input.brandId,
        title: `Brief · ${opportunity.title}`.slice(0, 200),
        body: "",
        description: opportunity.summary,
        objective: briefRec?.detail || opportunity.matchReason,
        notes: `Opportunity brief · ${opportunity.event.name}`,
        status: "BRIEF",
        platform: "INSTAGRAM",
        format: "INSTAGRAM_POST",
        dueDate: opportunity.eventDate,
        brief: {
          create: {
            goal: opportunity.matchReason,
            hook: briefRec?.title || opportunity.title,
            problem: opportunity.summary,
            solution: opportunity.recommendations
              .slice(0, 3)
              .map((r) => `${r.title}: ${r.detail}`)
              .join("\n"),
            cta:
              opportunity.recommendations.find((r) => r.kind === "cta")?.detail ||
              null,
          },
        },
      },
    });
    result = {
      contentId: item.id,
      href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/studio`,
    };
  }

  if (input.action === "create_offer") {
    const offer =
      opportunity.recommendations.find((r) => r.kind === "offer") ||
      opportunity.recommendations.find((r) => r.kind === "promotion");
    await prisma.businessMemory.create({
      data: {
        brandId: input.brandId,
        category: "offer_idea",
        key: `opportunity-offer:${opportunity.id}`,
        content: offer
          ? `${offer.title}: ${offer.detail}`
          : `Offer window for ${opportunity.title}`,
        meta: asJson({
          opportunityId: opportunity.id,
          eventDate: opportunity.eventDate,
        }),
      },
    });
    result = { saved: true };
  }

  if (input.action === "schedule_content") {
    const slot = await prisma.editorialCalendar.create({
      data: {
        brandId: input.brandId,
        title: opportunity.title.slice(0, 160),
        date: opportunity.eventDate,
        note: opportunity.summary.slice(0, 500),
      },
    });
    result = { calendarId: slot.id, href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/studio` };
  }

  if (input.action === "generate_content_plan") {
    result = {
      href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/planner`,
      hint: {
        planType: "HOLIDAY",
        startDate: opportunity.eventDate.toISOString().slice(0, 10),
        businessGoal: opportunity.title,
      },
    };
  }

  await prisma.businessOpportunity.update({
    where: { id: opportunity.id },
    data: { status: "ACTED" },
  });
  await prisma.opportunityFeedback.create({
    data: {
      brandId: input.brandId,
      opportunityId: opportunity.id,
      userId: input.userId,
      action: "ACTED",
      note: input.action,
      meta: asJson(result),
    },
  });

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "CONTENT_CREATED",
    title: `Opportunity action: ${input.action}`,
    description: opportunity.title,
    href: typeof result.href === "string" ? result.href : undefined,
  });

  return {
    result,
    opportunity: await getOpportunityDetail(opportunity.id, input.brandId),
  };
}
