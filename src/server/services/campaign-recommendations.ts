import type {
  CampaignLearningOutcome,
  CampaignRecStatus,
  CampaignScenarioKind,
  CampaignStrategyKind,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  CAMPAIGN_SCENARIOS,
  CAMPAIGN_STRATEGIES,
  DEFAULT_ELIGIBILITY,
} from "@/lib/campaign-recommendations";
import { runAITask } from "@/server/ai";
import { recordActivity } from "@/server/services/workspace-experience";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function clamp(n: unknown, fallback = 50) {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(100, v));
}

function clampConfidence(n: unknown, fallback = 0.7) {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  if (v > 1) return Math.max(0, Math.min(1, v / 100));
  return Math.max(0, Math.min(1, v));
}

function parseStrategy(raw: unknown): CampaignStrategyKind {
  const key = String(raw || "AWARENESS").toUpperCase();
  return (
    CAMPAIGN_STRATEGIES.some((s) => s.key === key) ? key : "AWARENESS"
  ) as CampaignStrategyKind;
}

function parseScenario(raw: unknown): CampaignScenarioKind {
  const key = String(raw || "BALANCED").toUpperCase();
  return (
    CAMPAIGN_SCENARIOS.some((s) => s.key === key) ? key : "BALANCED"
  ) as CampaignScenarioKind;
}

function str(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean).slice(0, 12);
}

export type EligibilityInput = {
  minScore?: number;
  minConfidence?: number;
  requirePreparationWindow?: boolean;
  requireBusinessReady?: boolean;
  forceOpportunityIds?: string[];
};

const recommendationInclude = {
  opportunity: {
    select: {
      id: true,
      title: true,
      summary: true,
      eventDate: true,
      scoreLevel: true,
      confidence: true,
      whyMatched: true,
      planningStart: true,
      score: true,
      event: { select: { id: true, key: true, name: true } },
    },
  },
  scenarios: { orderBy: { kind: "asc" as const } },
  executionPlan: true,
  impactEstimate: true,
  campaign: { select: { id: true, name: true, status: true } },
  learnings: { orderBy: { createdAt: "desc" as const }, take: 5 },
};

async function learningSignals(brandId: string) {
  const rows = await prisma.campaignLearning.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      recommendation: { select: { strategy: true, name: true, status: true } },
    },
  });
  return {
    accepted: rows
      .filter((r) => r.outcome === "ACCEPTED")
      .map((r) => r.recommendation?.strategy)
      .filter(Boolean),
    rejected: rows
      .filter((r) => r.outcome === "REJECTED")
      .map((r) => r.recommendation?.strategy)
      .filter(Boolean),
    modified: rows
      .filter((r) => r.outcome === "MODIFIED")
      .map((r) => r.recommendation?.name)
      .filter(Boolean),
    recent: rows.slice(0, 12).map((r) => ({
      outcome: r.outcome,
      strategy: r.recommendation?.strategy,
      note: r.note,
    })),
  };
}

export async function listEligibleOpportunities(
  brandId: string,
  eligibility: EligibilityInput = {},
) {
  const minScore = eligibility.minScore ?? DEFAULT_ELIGIBILITY.minScore;
  const minConfidence =
    eligibility.minConfidence ?? DEFAULT_ELIGIBILITY.minConfidence;
  const requirePrep =
    eligibility.requirePreparationWindow ??
    DEFAULT_ELIGIBILITY.requirePreparationWindow;
  const requireReady =
    eligibility.requireBusinessReady ??
    DEFAULT_ELIGIBILITY.requireBusinessReady;
  const forceIds = new Set(eligibility.forceOpportunityIds || []);

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      businessProfile: true,
      marketingStrategy: true,
      channelConnections: { where: { status: "CONNECTED" }, take: 1 },
    },
  });
  if (!brand || brand.archivedAt) return [];

  const businessReady =
    Boolean(brand.businessProfile || brand.marketingStrategy) &&
    (brand.channelConnections.length > 0 ||
      (brand.marketingStrategy?.preferredPlatforms.length ?? 0) > 0);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.businessOpportunity.findMany({
    where: {
      brandId,
      ignored: false,
      status: { notIn: ["DISMISSED", "IGNORED", "EXPIRED"] },
      eventDate: { gte: today },
      OR: [
        { scoreLevel: { in: ["high", "critical"] } },
        { pinned: true },
        ...(forceIds.size
          ? [{ id: { in: [...forceIds] } }]
          : []),
      ],
    },
    include: {
      score: true,
      evidence: { where: { passed: true }, take: 8 },
      event: {
        select: {
          id: true,
          key: true,
          name: true,
          countries: true,
          industries: true,
        },
      },
    },
    orderBy: [{ pinned: "desc" }, { eventDate: "asc" }],
    take: 40,
  });

  return rows.filter((o) => {
    if (forceIds.has(o.id) || o.pinned) return true;
    const overall = o.score?.overall ?? 0;
    const confidence = o.confidence ?? o.score?.confidence ?? 0;
    if (overall < minScore) return false;
    if (confidence < minConfidence) return false;
    if (requirePrep && o.planningStart && o.planningStart > today) {
      // still within prep if event is upcoming — allow if planning has started or is soon
      const daysToPlan =
        (o.planningStart.getTime() - today.getTime()) / 86400000;
      if (daysToPlan > 21) return false;
    }
    if (requireReady && !businessReady) return false;
    return true;
  });
}

export async function getRecommendationsDashboard(input: {
  workspaceId: string;
  brandId: string;
  meta?: Record<string, unknown> | null;
}) {
  const [recommendations, eligible, learnings] = await Promise.all([
    prisma.campaignRecommendation.findMany({
      where: { brandId: input.brandId },
      include: recommendationInclude,
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: 80,
    }),
    listEligibleOpportunities(input.brandId),
    prisma.campaignLearning.findMany({
      where: { brandId: input.brandId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const pending = recommendations.filter((r) => r.status === "PENDING");
  const approved = recommendations.filter((r) => r.status === "APPROVED");
  const archived = recommendations.filter(
    (r) => r.status === "ARCHIVED" || r.status === "REJECTED",
  );
  const sentToPlanner = recommendations.filter(
    (r) => r.status === "SENT_TO_PLANNER",
  );

  return {
    recommendations,
    pending,
    approved,
    archived,
    sentToPlanner,
    eligibleOpportunities: eligible.map((o) => ({
      id: o.id,
      title: o.title,
      eventDate: o.eventDate,
      scoreLevel: o.scoreLevel,
      overall: o.score?.overall ?? 0,
      confidence: o.confidence ?? o.score?.confidence ?? 0,
      eventName: o.event.name,
    })),
    learnings,
    eligibility: DEFAULT_ELIGIBILITY,
    counts: {
      pending: pending.length,
      approved: approved.length,
      archived: archived.length,
      sentToPlanner: sentToPlanner.length,
      eligible: eligible.length,
      total: recommendations.length,
    },
    meta: input.meta || null,
  };
}

export async function getRecommendationExplanation(
  id: string,
  brandId: string,
) {
  return prisma.campaignRecommendation.findFirst({
    where: { id, brandId },
    include: recommendationInclude,
  });
}

export async function getRecommendationScenarios(
  recommendationId: string,
  brandId: string,
) {
  const rec = await prisma.campaignRecommendation.findFirst({
    where: { id: recommendationId, brandId },
    select: { id: true },
  });
  if (!rec) return null;
  return prisma.campaignScenario.findMany({
    where: { recommendationId },
    orderBy: { kind: "asc" },
  });
}

async function persistProposal(input: {
  workspaceId: string;
  brandId: string;
  opportunityId: string;
  row: Record<string, unknown>;
  sortOrder: number;
  eligibleOverride?: boolean;
}) {
  const components = (input.row.components || {}) as Record<string, unknown>;
  const execution = (input.row.execution || {}) as Record<string, unknown>;
  const resources = (input.row.resources || {}) as Record<string, unknown>;
  const impact = (input.row.impact || {}) as Record<string, unknown>;
  const explanation = (input.row.explanation || {}) as Record<string, unknown>;
  const scenarios = Array.isArray(input.row.scenarios)
    ? (input.row.scenarios as Record<string, unknown>[])
    : [];

  const name = str(input.row.name, "Campaign proposal").slice(0, 160);
  const existing = await prisma.campaignRecommendation.findFirst({
    where: {
      brandId: input.brandId,
      opportunityId: input.opportunityId,
      name,
      status: { in: ["PENDING", "SENT_TO_PLANNER"] },
    },
  });

  const data = {
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    opportunityId: input.opportunityId,
    name,
    objective: str(input.row.objective, "Capitalize on matched opportunity"),
    strategy: parseStrategy(input.row.strategy),
    targetAudience: str(input.row.targetAudience, "Primary brand audience"),
    primaryChannel: str(input.row.primaryChannel, "INSTAGRAM").slice(0, 40),
    supportingChannels: strArr(input.row.supportingChannels),
    suggestedDurationDays: Math.max(
      3,
      Math.min(90, Number(input.row.suggestedDurationDays) || 14),
    ),
    priority: clamp(input.row.priority, 60),
    confidence: clampConfidence(input.row.confidence),
    suggestedOffer: str(components.offer || input.row.suggestedOffer) || null,
    suggestedTheme: str(components.theme || input.row.suggestedTheme) || null,
    suggestedVisualDirection:
      str(components.visualDirection || input.row.suggestedVisualDirection) ||
      null,
    suggestedMessaging:
      str(components.messaging || input.row.suggestedMessaging) || null,
    suggestedCta: str(components.cta || input.row.suggestedCta) || null,
    suggestedLandingPage:
      str(components.landingPage || input.row.suggestedLandingPage) || null,
    suggestedEmail: str(components.email || input.row.suggestedEmail) || null,
    suggestedStorySequence: asJson(
      components.storySequence || input.row.suggestedStorySequence || [],
    ),
    suggestedReelSeries: asJson(
      components.reelSeries || input.row.suggestedReelSeries || [],
    ),
    suggestedCarouselSeries: asJson(
      components.carouselSeries || input.row.suggestedCarouselSeries || [],
    ),
    contentPlan: asJson(input.row.contentPlan || { items: [] }),
    whyThisCampaign: str(
      explanation.whyThisCampaign || input.row.whyThisCampaign,
      "Matched opportunity fits brand goals.",
    ),
    whyNow: str(
      explanation.whyNow || input.row.whyNow,
      "Preparation window is open.",
    ),
    supportingEvidence: asJson(
      explanation.supportingEvidence || input.row.supportingEvidence || [],
    ),
    tradeOffs: str(explanation.tradeOffs || input.row.tradeOffs) || null,
    potentialRisks:
      str(explanation.potentialRisks || input.row.potentialRisks) || null,
    complexity: str(resources.complexity, "medium").slice(0, 20),
    requiredTeam: strArr(resources.requiredTeam),
    estimatedHours:
      resources.estimatedHours != null
        ? Number(resources.estimatedHours)
        : null,
    assetsNeeded: strArr(resources.assetsNeeded),
    riskLevel: str(resources.riskLevel, "medium").slice(0, 20),
    explanation: [
      str(explanation.whyThisCampaign),
      str(explanation.whyNow),
      str(explanation.tradeOffs),
      str(explanation.potentialRisks),
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 4000),
    eligibleOverride: Boolean(input.eligibleOverride),
    sortOrder: input.sortOrder,
  };

  const rec = existing
    ? await prisma.campaignRecommendation.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.campaignRecommendation.create({ data });

  await prisma.campaignScenario.deleteMany({
    where: { recommendationId: rec.id },
  });
  const scenarioRows =
    scenarios.length >= 3
      ? scenarios.slice(0, 3)
      : CAMPAIGN_SCENARIOS.map((s) => ({
          kind: s.key,
          name: s.label,
          summary: `${s.label} approach for ${name}`,
          priority: data.priority + (s.key === "AGGRESSIVE" ? 10 : s.key === "CONSERVATIVE" ? -10 : 0),
          confidence: data.confidence,
          selected: s.key === "BALANCED",
        }));

  await prisma.campaignScenario.createMany({
    data: scenarioRows.map((s) => ({
      recommendationId: rec.id,
      kind: parseScenario((s as { kind?: unknown }).kind),
      name: str((s as { name?: unknown }).name, "Scenario").slice(0, 80),
      summary: str((s as { summary?: unknown }).summary, "Scenario option"),
      priority: clamp((s as { priority?: unknown }).priority, data.priority),
      confidence: clampConfidence(
        (s as { confidence?: unknown }).confidence,
        data.confidence,
      ),
      adjustments: asJson((s as { adjustments?: unknown }).adjustments || {}),
      selected: Boolean(
        (s as { selected?: unknown }).selected ||
          parseScenario((s as { kind?: unknown }).kind) === "BALANCED",
      ),
    })),
  });

  await prisma.campaignExecutionPlan.upsert({
    where: { recommendationId: rec.id },
    create: {
      recommendationId: rec.id,
      preparation: str(execution.preparation) || null,
      design: str(execution.design) || null,
      approval: str(execution.approval) || null,
      publishing: str(execution.publishing) || null,
      followUp: str(execution.followUp) || null,
      measurement: str(execution.measurement) || null,
      steps: asJson(execution.steps || []),
    },
    update: {
      preparation: str(execution.preparation) || null,
      design: str(execution.design) || null,
      approval: str(execution.approval) || null,
      publishing: str(execution.publishing) || null,
      followUp: str(execution.followUp) || null,
      measurement: str(execution.measurement) || null,
      steps: asJson(execution.steps || []),
    },
  });

  await prisma.campaignImpactEstimate.upsert({
    where: { recommendationId: rec.id },
    create: {
      recommendationId: rec.id,
      expectedReach: clamp(impact.expectedReach),
      expectedEngagement: clamp(impact.expectedEngagement),
      expectedLeads: clamp(impact.expectedLeads),
      expectedRevenueImpact: clamp(impact.expectedRevenueImpact),
      brandImpact: clamp(impact.brandImpact),
      confidence: clampConfidence(impact.confidence, data.confidence),
      notes: str(impact.notes) || null,
    },
    update: {
      expectedReach: clamp(impact.expectedReach),
      expectedEngagement: clamp(impact.expectedEngagement),
      expectedLeads: clamp(impact.expectedLeads),
      expectedRevenueImpact: clamp(impact.expectedRevenueImpact),
      brandImpact: clamp(impact.brandImpact),
      confidence: clampConfidence(impact.confidence, data.confidence),
      notes: str(impact.notes) || null,
    },
  });

  return rec;
}

export async function generateCampaignRecommendations(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  eligibility?: EligibilityInput;
}) {
  const eligibility = { ...DEFAULT_ELIGIBILITY, ...input.eligibility };
  const eligible = await listEligibleOpportunities(
    input.brandId,
    eligibility,
  );

  if (!eligible.length) {
    return getRecommendationsDashboard({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      meta: { generated: 0, eligible: 0, message: "No eligible opportunities" },
    });
  }

  const learning = await learningSignals(input.brandId);
  const payloadOpps = eligible.slice(0, 8).map((o) => ({
    id: o.id,
    title: o.title,
    summary: o.summary,
    eventDate: o.eventDate.toISOString().slice(0, 10),
    scoreLevel: o.scoreLevel,
    confidence: o.confidence,
    whyMatched: o.whyMatched,
    overall: o.score?.overall,
    scores: o.score
      ? {
          industry: o.score.industryScore,
          audience: o.score.audienceScore,
          product: o.score.productScore,
          goal: o.score.goalScore,
          season: o.score.seasonScore,
          location: o.score.locationScore,
          channel: o.score.channelScore,
          preparation: o.score.preparationScore,
          brand: o.score.brandCompatibilityScore,
        }
      : null,
    evidence: o.evidence.map((e) => ({
      ruleKey: e.ruleKey,
      detail: e.detail,
      contribution: e.contribution,
    })),
    event: o.event,
    planningStart: o.planningStart?.toISOString().slice(0, 10) || null,
  }));

  const result = await runAITask({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    taskKey: "campaign.generate",
    input: {
      text: `Generate campaign blueprints for ${payloadOpps.length} eligible opportunities. Directions only — no marketing copy, no images, no auto-launch.`,
      opportunities: payloadOpps,
      eligibility,
      learningSignals: learning,
    },
  });

  const output = (result.output || {}) as Record<string, unknown>;
  const proposals = Array.isArray(output.proposals)
    ? (output.proposals as Record<string, unknown>[])
    : [];

  const eligibleIds = new Set(eligible.map((o) => o.id));
  let generated = 0;

  for (let i = 0; i < proposals.length; i++) {
    const row = proposals[i];
    const opportunityId = str(row.opportunityId);
    if (!opportunityId || !eligibleIds.has(opportunityId)) continue;
    await persistProposal({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      opportunityId,
      row,
      sortOrder: i,
      eligibleOverride: Boolean(
        eligibility.forceOpportunityIds?.includes(opportunityId),
      ),
    });
    generated++;
  }

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "STRATEGY_UPDATED",
    title: "Campaign recommendations generated",
    description: `${generated} campaign blueprints ready for human approval.`,
    href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/recommendations`,
  });

  return getRecommendationsDashboard({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    meta: {
      generated,
      eligible: eligible.length,
      executionId: result.execution?.id,
    },
  });
}

async function recordLearning(input: {
  brandId: string;
  recommendationId: string;
  outcome: CampaignLearningOutcome;
  note?: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.campaignLearning.create({
    data: {
      brandId: input.brandId,
      recommendationId: input.recommendationId,
      outcome: input.outcome,
      note: input.note || null,
      meta: input.meta ? asJson(input.meta) : undefined,
    },
  });
}

export async function runRecommendationAction(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  recommendationId: string;
  action: string;
  scenarioId?: string;
  note?: string;
}) {
  const rec = await prisma.campaignRecommendation.findFirst({
    where: { id: input.recommendationId, brandId: input.brandId },
    include: {
      scenarios: true,
      executionPlan: true,
      impactEstimate: true,
      opportunity: true,
    },
  });
  if (!rec) return null;

  const action = String(input.action).toUpperCase();
  let status: CampaignRecStatus = rec.status;
  const meta: Record<string, unknown> = {};
  let href: string | undefined;

  if (input.scenarioId) {
    await prisma.campaignScenario.updateMany({
      where: { recommendationId: rec.id },
      data: { selected: false },
    });
    await prisma.campaignScenario.updateMany({
      where: { id: input.scenarioId, recommendationId: rec.id },
      data: { selected: true },
    });
  }

  if (action === "APPROVE") {
    // Never auto-launch — always PLANNING until humans decide
    const campaign = await prisma.campaign.create({
      data: {
        brandId: input.brandId,
        name: rec.name.slice(0, 120),
        description: [
          rec.objective,
          `Why: ${rec.whyThisCampaign}`,
          `Why now: ${rec.whyNow}`,
        ].join("\n\n"),
        objective: rec.objective.slice(0, 500),
        platforms: [rec.primaryChannel, ...rec.supportingChannels].slice(0, 6),
        status: "PLANNING",
        startDate: rec.opportunity.eventDate,
        endDate: new Date(
          rec.opportunity.eventDate.getTime() +
            rec.suggestedDurationDays * 86400000,
        ),
      },
    });
    status = "APPROVED";
    meta.campaignId = campaign.id;
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/campaigns/${campaign.id}`;
    await prisma.campaignRecommendation.update({
      where: { id: rec.id },
      data: { status, campaignId: campaign.id },
    });
    await recordLearning({
      brandId: input.brandId,
      recommendationId: rec.id,
      outcome: "ACCEPTED",
      note: input.note,
      meta: { campaignId: campaign.id },
    });
    const { ensureWorkflowFromRecommendation } = await import(
      "@/server/services/execution-pipeline"
    );
    const workflow = await ensureWorkflowFromRecommendation({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      recommendationId: rec.id,
      campaignId: campaign.id,
      actorId: input.userId,
    });
    meta.workflowId = workflow.id;
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/pipeline`;
  } else if (action === "REJECT") {
    status = "REJECTED";
    await prisma.campaignRecommendation.update({
      where: { id: rec.id },
      data: { status },
    });
    await recordLearning({
      brandId: input.brandId,
      recommendationId: rec.id,
      outcome: "REJECTED",
      note: input.note,
    });
  } else if (action === "ARCHIVE") {
    status = "ARCHIVED";
    await prisma.campaignRecommendation.update({
      where: { id: rec.id },
      data: { status },
    });
  } else if (action === "SEND_TO_PLANNER") {
    const {
      ensureWorkflowFromRecommendation,
      handoffToPlanner,
    } = await import("@/server/services/execution-pipeline");
    const workflow = await ensureWorkflowFromRecommendation({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      recommendationId: rec.id,
      campaignId: rec.campaignId,
      actorId: input.userId,
    });
    const result = await handoffToPlanner({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      workspaceSlug: input.workspaceSlug,
      brandSlug: input.brandSlug,
      workflowId: workflow.id,
    });
    status = "SENT_TO_PLANNER";
    meta.contentPlanId = result?.handoff.contentPlanId || workflow.contentPlanId;
    meta.workflowId = workflow.id;
    meta.duplicated = result?.duplicated;
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/planner`;
  } else if (action === "CREATE_TASKS") {
    const {
      ensureWorkflowFromRecommendation,
      createPipelineTasks,
    } = await import("@/server/services/execution-pipeline");
    const workflow = await ensureWorkflowFromRecommendation({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      recommendationId: rec.id,
      campaignId: rec.campaignId,
      actorId: input.userId,
    });
    const result = await createPipelineTasks({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      workspaceSlug: input.workspaceSlug,
      brandSlug: input.brandSlug,
      workflowId: workflow.id,
    });
    meta.taskIds = result?.tasks.map((t) => t.taskId) || [];
    meta.workflowId = workflow.id;
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/work`;
  } else if (action === "SCHEDULE_REVIEW") {
    const { createTaskFromSource } = await import("@/server/services/work");
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 2);
    const result = await createTaskFromSource({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      workspaceSlug: input.workspaceSlug,
      brandSlug: input.brandSlug,
      title: `Review campaign blueprint · ${rec.name}`.slice(0, 160),
      description: [
        rec.whyThisCampaign,
        rec.whyNow,
        rec.potentialRisks || "",
      ]
        .filter(Boolean)
        .join("\n"),
      type: "APPROVAL",
      priority: "HIGH",
      source: "CAMPAIGN_RECOMMENDATION",
      sourceKey: `camp-rec-review:${rec.id}`,
      sourceContext: { recommendationId: rec.id },
      dueDate: due,
    });
    meta.taskId = result.task.id;
    href = `/w/${input.workspaceSlug}/b/${input.brandSlug}/work`;
  } else {
    return { error: "Unknown action" as const };
  }

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "STRATEGY_UPDATED",
    title: `Campaign recommendation · ${action}`,
    description: rec.name,
    href:
      href ||
      `/w/${input.workspaceSlug}/b/${input.brandSlug}/recommendations`,
  });

  const dashboard = await getRecommendationsDashboard({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
  });
  return { dashboard, meta, href, status };
}

export async function selectScenario(input: {
  brandId: string;
  recommendationId: string;
  scenarioId: string;
}) {
  const rec = await prisma.campaignRecommendation.findFirst({
    where: { id: input.recommendationId, brandId: input.brandId },
  });
  if (!rec) return null;
  await prisma.campaignScenario.updateMany({
    where: { recommendationId: rec.id },
    data: { selected: false },
  });
  await prisma.campaignScenario.update({
    where: { id: input.scenarioId },
    data: { selected: true },
  });
  await recordLearning({
    brandId: input.brandId,
    recommendationId: rec.id,
    outcome: "MODIFIED",
    note: "Scenario selected",
    meta: { scenarioId: input.scenarioId },
  });
  return getRecommendationExplanation(rec.id, input.brandId);
}
