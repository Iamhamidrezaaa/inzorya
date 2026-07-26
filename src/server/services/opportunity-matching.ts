import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  MATCH_RULES,
  impactTierFor,
  includesLoose,
  overlapScore,
  scoreLevelFor,
  tokenize,
} from "@/lib/matching";
import { nextOccurrenceDate, utcToday } from "@/lib/calendar";
import { ensureCalendarCatalog } from "@/server/services/calendar";
import { ensureKnowledgeGraph } from "@/server/services/knowledge-graph";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

type RuleResult = {
  key: string;
  passed: boolean;
  detail: string;
  weight: number;
  contribution: number;
  raw: number;
};

type BrandContext = {
  workspaceId: string;
  brandId: string;
  name: string;
  industry: string | null;
  brandVoice: string | null;
  targetAudience: string | null;
  country: string | null;
  languages: string[];
  products: string;
  goals: string[];
  platforms: string[];
  tone: string | null;
  channels: string[];
  statusActive: boolean;
};

async function loadBrandContext(brandId: string): Promise<BrandContext | null> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      businessProfile: true,
      marketingStrategy: true,
      channelConnections: {
        include: { socialChannel: true },
      },
      workspace: { select: { id: true } },
    },
  });
  if (!brand || brand.archivedAt) return null;

  const platforms = [
    ...(brand.marketingStrategy?.preferredPlatforms || []),
    ...(brand.businessProfile?.preferredPlatforms || []),
    ...brand.channelConnections
      .filter((c) => c.status === "CONNECTED")
      .map((c) => c.socialChannel.platform),
  ].map((p) => p.toLowerCase());

  return {
    workspaceId: brand.workspaceId,
    brandId: brand.id,
    name: brand.name,
    industry: brand.industry || brand.businessProfile?.industry || null,
    brandVoice: brand.brandVoice || brand.businessProfile?.brandPersonality || null,
    targetAudience:
      brand.targetAudience || brand.businessProfile?.targetAudience || null,
    country: brand.businessProfile?.country || null,
    languages: brand.businessProfile?.languages || [],
    products: [
      brand.businessProfile?.mainProducts || "",
      brand.description || "",
    ].join(" "),
    goals: [
      ...(brand.marketingStrategy?.goals || []),
      ...tokenize(brand.businessProfile?.businessGoals),
    ],
    platforms: Array.from(new Set(platforms)),
    tone:
      brand.marketingStrategy?.tone ||
      brand.businessProfile?.preferredTone ||
      null,
    channels: Array.from(new Set(platforms)),
    statusActive: !brand.archivedAt,
  };
}

function evaluateRules(input: {
  brand: BrandContext;
  event: {
    name: string;
    description: string | null;
    countries: string[];
    industries: string[];
    tags: string[];
    language: string;
    month: number | null;
    day: number | null;
    preparationDays: number | null;
    planningWindowDays: number | null;
    knowledge: Array<{ kind: string; key: string; name: string }>;
    seasons: Array<{ key: string; name: string; kind: string }>;
  };
  eventDate: Date;
  today: Date;
}): { results: RuleResult[]; missing: string[] } {
  const missing: string[] = [];
  const brand = input.brand;
  const event = input.event;
  const knowledgeByKind = (kind: string) =>
    event.knowledge.filter((k) => k.kind === kind).map((k) => k.key);

  const industryTokens = [
    ...event.industries,
    ...knowledgeByKind("INDUSTRY"),
    ...tokenize(event.name),
    ...tokenize(event.description),
  ];
  const brandIndustryTokens = tokenize(brand.industry);
  if (!brand.industry) missing.push("Brand industry");

  const industryHit = overlapScore(brandIndustryTokens, industryTokens);
  const industryLoose = includesLoose(brand.industry, industryTokens);
  const industryRaw =
    industryHit.score ||
    (industryLoose.length ? Math.min(100, industryLoose.length * 40) : 0) ||
    (event.industries.length === 0 && knowledgeByKind("INDUSTRY").length === 0
      ? 35
      : 0);

  const businessTypes = knowledgeByKind("BUSINESS_TYPE");
  const btHit = overlapScore(brandIndustryTokens, businessTypes);
  const businessRaw =
    btHit.score ||
    (businessTypes.length === 0 ? 30 : includesLoose(brand.industry, businessTypes).length ? 70 : 10);

  const productNodes = [
    ...knowledgeByKind("PRODUCT_CATEGORY"),
    ...event.tags,
  ];
  const productTokens = tokenize(brand.products);
  if (!productTokens.length) missing.push("Brand products/services");
  const productHit = overlapScore(productTokens, productNodes);
  const productRaw =
    productHit.score ||
    (productNodes.length === 0 ? 25 : includesLoose(brand.products, productNodes).length ? 65 : 5);

  const audienceNodes = knowledgeByKind("AUDIENCE");
  const audienceTokens = tokenize(brand.targetAudience);
  if (!audienceTokens.length) missing.push("Target audience");
  const audienceHit = overlapScore(audienceTokens, [
    ...audienceNodes,
    ...event.tags,
  ]);
  const audienceRaw =
    audienceHit.score ||
    (audienceNodes.length === 0
      ? 30
      : includesLoose(brand.targetAudience, audienceNodes).length
        ? 75
        : 8);

  const countries = event.countries.map((c) => c.toUpperCase());
  const isGlobal = !countries.length || countries.includes("GLOBAL");
  const brandCountry = (brand.country || "").toUpperCase();
  if (!brandCountry) missing.push("Brand country");
  const locationRaw = isGlobal
    ? 70
    : brandCountry && countries.includes(brandCountry)
      ? 100
      : brandCountry
        ? 15
        : 40;

  const langRaw =
    !brand.languages.length
      ? ((missing.push("Brand languages"), 40) as number)
      : brand.languages.some(
            (l) =>
              l.toLowerCase().startsWith(event.language.toLowerCase()) ||
              event.language.toLowerCase().startsWith(l.toLowerCase().slice(0, 2)),
          )
        ? 100
        : 20;

  const goalNodes = knowledgeByKind("OBJECTIVE");
  const goalHit = overlapScore(
    brand.goals.map((g) => g.toLowerCase()),
    goalNodes,
  );
  if (!brand.goals.length) missing.push("Marketing goals");
  const goalRaw =
    goalHit.score ||
    (goalNodes.length === 0 ? 35 : brand.goals.length ? 20 : 10);

  const channelNodes = knowledgeByKind("CHANNEL");
  const channelHit = overlapScore(brand.channels, channelNodes);
  if (!brand.channels.length) missing.push("Distribution channels");
  const channelRaw =
    channelHit.score ||
    (channelNodes.length === 0
      ? brand.channels.length
        ? 45
        : 25
      : includesLoose(brand.channels.join(" "), channelNodes).length
        ? 80
        : 10);

  const seasonNodes = event.seasons.map((s) => s.key);
  const month = event.month || eventDateMonth(input.eventDate);
  const seasonHint =
    month >= 3 && month <= 5
      ? "spring"
      : month >= 6 && month <= 8
        ? "summer"
        : month >= 9 && month <= 11
          ? "autumn"
          : "winter";
  const seasonRaw =
    seasonNodes.length === 0
      ? 40
      : seasonNodes.some((s) => s.includes(seasonHint)) ||
          event.seasons.some((s) => s.kind === "RETAIL" || s.kind === "BUSINESS")
        ? 85
        : 35;

  const toneNodes = knowledgeByKind("EMOTIONAL_TONE");
  const toneHay = `${brand.tone || ""} ${brand.brandVoice || ""}`.toLowerCase();
  if (!toneHay.trim()) missing.push("Brand tone / voice");
  const toneRaw =
    toneNodes.length === 0
      ? 40
      : toneNodes.some((t) => toneHay.includes(t.replace(/_/g, " ")) || toneHay.includes(t))
        ? 90
        : 25;

  const daysUntil = Math.ceil(
    (input.eventDate.getTime() - input.today.getTime()) / 86400000,
  );
  const prepNeed =
    event.preparationDays ||
    event.planningWindowDays ||
    14;
  const preparationRaw =
    daysUntil < 0
      ? 0
      : daysUntil >= prepNeed
        ? 100
        : daysUntil >= Math.ceil(prepNeed / 2)
          ? 55
          : 20;

  const map: Record<string, { raw: number; detail: string; passed: boolean }> = {
    industry: {
      raw: industryRaw,
      passed: industryRaw >= 40,
      detail:
        industryHit.hits.length || industryLoose.length
          ? `Industry overlap: ${(industryHit.hits.length ? industryHit.hits : industryLoose).join(", ")}`
          : industryRaw >= 35
            ? "No industry tags on event — neutral baseline"
            : "No industry overlap found",
    },
    business_type: {
      raw: businessRaw,
      passed: businessRaw >= 40,
      detail: businessTypes.length
        ? `Business types considered: ${businessTypes.join(", ")}`
        : "No business-type nodes linked",
    },
    product: {
      raw: productRaw,
      passed: productRaw >= 40,
      detail: productHit.hits.length
        ? `Product/service hits: ${productHit.hits.join(", ")}`
        : "Weak product/service overlap",
    },
    audience: {
      raw: audienceRaw,
      passed: audienceRaw >= 40,
      detail: audienceHit.hits.length
        ? `Audience hits: ${audienceHit.hits.join(", ")}`
        : "Weak audience overlap",
    },
    location: {
      raw: locationRaw,
      passed: locationRaw >= 40,
      detail: isGlobal
        ? "Event is global"
        : brandCountry
          ? `Brand country ${brandCountry}; event countries ${countries.join(", ") || "n/a"}`
          : "Brand country missing",
    },
    language: {
      raw: langRaw,
      passed: langRaw >= 40,
      detail: `Event language ${event.language}; brand languages ${brand.languages.join(", ") || "n/a"}`,
    },
    goal: {
      raw: goalRaw,
      passed: goalRaw >= 40,
      detail: goalHit.hits.length
        ? `Goal hits: ${goalHit.hits.join(", ")}`
        : "No strong goal overlap",
    },
    channel: {
      raw: channelRaw,
      passed: channelRaw >= 40,
      detail: channelHit.hits.length
        ? `Channel hits: ${channelHit.hits.join(", ")}`
        : "Limited channel overlap",
    },
    season: {
      raw: seasonRaw,
      passed: seasonRaw >= 40,
      detail: event.seasons.length
        ? `Seasons: ${event.seasons.map((s) => s.name).join(", ")}`
        : `Inferred season ${seasonHint}`,
    },
    tone: {
      raw: toneRaw,
      passed: toneRaw >= 40,
      detail: toneNodes.length
        ? `Tone nodes: ${toneNodes.join(", ")}`
        : "No tone nodes on event",
    },
    preparation: {
      raw: preparationRaw,
      passed: preparationRaw >= 40,
      detail: `Days until event: ${daysUntil}; preparation need: ${prepNeed}`,
    },
  };

  const results: RuleResult[] = MATCH_RULES.map((rule) => {
    const r = map[rule.key];
    const contribution = (r.raw / 100) * rule.weight;
    return {
      key: rule.key,
      passed: r.passed,
      detail: r.detail,
      weight: rule.weight,
      contribution,
      raw: r.raw,
    };
  });

  return { results, missing: Array.from(new Set(missing)) };
}

function eventDateMonth(d: Date) {
  return d.getUTCMonth() + 1;
}

function buildPreparation(eventDate: Date, prepDays: number) {
  const planningStart = new Date(eventDate);
  planningStart.setUTCDate(planningStart.getUTCDate() - prepDays);
  const contentDeadline = new Date(eventDate);
  contentDeadline.setUTCDate(contentDeadline.getUTCDate() - Math.max(3, Math.floor(prepDays * 0.4)));
  const designDeadline = new Date(eventDate);
  designDeadline.setUTCDate(designDeadline.getUTCDate() - Math.max(2, Math.floor(prepDays * 0.25)));
  const approvalDeadline = new Date(eventDate);
  approvalDeadline.setUTCDate(approvalDeadline.getUTCDate() - Math.max(1, Math.floor(prepDays * 0.15)));
  const publishingStart = new Date(eventDate);
  publishingStart.setUTCDate(publishingStart.getUTCDate() - Math.min(2, prepDays));
  const publishingEnd = new Date(eventDate);
  publishingEnd.setUTCDate(publishingEnd.getUTCDate() + 1);
  const expirationAt = new Date(eventDate);
  expirationAt.setUTCDate(expirationAt.getUTCDate() + 2);
  return {
    planningStart,
    contentDeadline,
    designDeadline,
    approvalDeadline,
    publishingStart,
    publishingEnd,
    expirationAt,
  };
}

export async function ensureMatchRules() {
  for (const r of MATCH_RULES) {
    await prisma.opportunityRule.upsert({
      where: { key: r.key },
      create: {
        key: r.key,
        name: r.name,
        description: r.description,
        weight: r.weight,
        active: true,
      },
      update: {
        name: r.name,
        description: r.description,
        weight: r.weight,
        active: true,
      },
    });
  }
}

export async function runDeterministicMatching(input: {
  workspaceId: string;
  brandId: string;
  horizonDays?: number;
  actorNote?: string;
}) {
  await ensureCalendarCatalog();
  await ensureKnowledgeGraph();
  await ensureMatchRules();

  const brand = await loadBrandContext(input.brandId);
  if (!brand) throw new Error("Brand not found");

  const today = utcToday();
  const horizon = input.horizonDays || 120;
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + horizon);

  const overrides = await prisma.opportunityOverride.findMany({
    where: { brandId: input.brandId, active: true },
  });
  const blacklisted = new Set(
    overrides
      .filter((o) => o.kind === "BLACKLIST" || o.kind === "IGNORE_EVENT")
      .map((o) => o.eventId)
      .filter(Boolean) as string[],
  );
  const whitelisted = new Set(
    overrides
      .filter((o) => o.kind === "WHITELIST" || o.kind === "FORCE_MATCH")
      .map((o) => o.eventId)
      .filter(Boolean) as string[],
  );
  const pinned = new Set(
    overrides
      .filter((o) => o.kind === "PIN")
      .map((o) => o.eventId)
      .filter(Boolean) as string[],
  );
  const priorityMap = new Map(
    overrides
      .filter((o) => o.kind === "PRIORITY" && o.eventId)
      .map((o) => [o.eventId!, o.priority ?? 0]),
  );

  const events = await prisma.marketingEvent.findMany({
    where: { status: "ACTIVE", active: true },
    include: {
      knowledgeLinks: { include: { node: true } },
      seasons: { include: { season: true } },
    },
    take: 400,
  });

  const campaigns = await prisma.campaign.findMany({
    where: {
      brandId: input.brandId,
      archivedAt: null,
      status: { in: ["PLANNING", "ACTIVE"] },
    },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  let matched = 0;
  let skipped = 0;

  for (const event of events) {
    if (blacklisted.has(event.id) && !whitelisted.has(event.id)) {
      skipped++;
      continue;
    }

    const eventDate = nextOccurrenceDate({
      recurrence: event.recurrence,
      month: event.month,
      day: event.day,
      startDate: event.startDate,
      from: today,
    });
    if (eventDate < today || eventDate > end) {
      // still allow whitelist force
      if (!whitelisted.has(event.id)) {
        skipped++;
        continue;
      }
    }

    const { results, missing } = evaluateRules({
      brand,
      event: {
        name: event.name,
        description: event.description,
        countries: event.countries,
        industries: event.industries,
        tags: event.tags,
        language: event.language,
        month: event.month,
        day: event.day,
        preparationDays: event.preparationDays,
        planningWindowDays: event.planningWindowDays,
        knowledge: event.knowledgeLinks.map((l) => ({
          kind: l.node.kind,
          key: l.node.key,
          name: l.node.name,
        })),
        seasons: event.seasons.map((s) => ({
          key: s.season.key,
          name: s.season.name,
          kind: s.season.kind,
        })),
      },
      eventDate,
      today,
    });

    let overall = clamp(
      results.reduce((sum, r) => sum + r.contribution, 0),
    );

    if (whitelisted.has(event.id)) {
      overall = Math.max(overall, 85);
    }
    if (priorityMap.has(event.id)) {
      overall = clamp(overall + (priorityMap.get(event.id) || 0));
    }

    const level = scoreLevelFor(overall);
    if (level === "ignore" && !whitelisted.has(event.id) && !pinned.has(event.id)) {
      skipped++;
      continue;
    }

    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    const confidence = clamp(
      55 +
        results.filter((r) => r.passed).length * 3 -
        missing.length * 4,
    );
    const prepDays =
      event.preparationDays || event.planningWindowDays || 14;
    const prep = buildPreparation(eventDate, prepDays);
    const why = results
      .filter((r) => r.passed)
      .map((r) => r.detail)
      .slice(0, 6)
      .join(" · ");
    const rulesMatched = results.filter((r) => r.passed).map((r) => r.key);
    const rulesFailed = results.filter((r) => !r.passed).map((r) => r.key);

    const opportunity = await prisma.businessOpportunity.upsert({
      where: {
        brandId_eventId_eventDate: {
          brandId: input.brandId,
          eventId: event.id,
          eventDate,
        },
      },
      create: {
        workspaceId: brand.workspaceId,
        brandId: input.brandId,
        eventId: event.id,
        title: event.title || event.name,
        summary: event.description || event.name,
        matchReason: why || "Deterministic match",
        eventDate,
        status: level === "ignore" ? "IGNORED" : "NEW",
        impactTier: impactTierFor(level),
        matchSource: whitelisted.has(event.id) ? "MANUAL" : "DETERMINISTIC",
        scoreLevel: level,
        confidence,
        whyMatched: why,
        rulesMatched,
        rulesFailed,
        missingInfo: missing,
        pinned: pinned.has(event.id),
        ignored: level === "ignore",
        priorityOverride: priorityMap.get(event.id) ?? null,
        ...prep,
        score: {
          create: {
            relevance: overall,
            urgency: byKey.preparation?.raw || 0,
            expectedReach: byKey.audience?.raw || 0,
            salesPotential: byKey.goal?.raw || 0,
            engagementPotential: byKey.channel?.raw || 0,
            difficulty: clamp(100 - (byKey.preparation?.raw || 50)),
            confidence,
            overall,
            industryScore: byKey.industry?.raw || 0,
            audienceScore: byKey.audience?.raw || 0,
            productScore: byKey.product?.raw || 0,
            goalScore: byKey.goal?.raw || 0,
            seasonScore: byKey.season?.raw || 0,
            locationScore: byKey.location?.raw || 0,
            channelScore: byKey.channel?.raw || 0,
            preparationScore: byKey.preparation?.raw || 0,
            brandCompatibilityScore: byKey.tone?.raw || 0,
            explanation: why || "Deterministic scoring",
          },
        },
      },
      update: {
        title: event.title || event.name,
        summary: event.description || event.name,
        matchReason: why || "Deterministic match",
        impactTier: impactTierFor(level),
        matchSource: whitelisted.has(event.id) ? "MANUAL" : "DETERMINISTIC",
        scoreLevel: level,
        confidence,
        whyMatched: why,
        rulesMatched,
        rulesFailed,
        missingInfo: missing,
        pinned: pinned.has(event.id),
        ignored: level === "ignore",
        priorityOverride: priorityMap.get(event.id) ?? null,
        status:
          level === "ignore"
            ? "IGNORED"
            : eventDate < today
              ? "EXPIRED"
              : undefined,
        ...prep,
        score: {
          upsert: {
            create: {
              relevance: overall,
              urgency: byKey.preparation?.raw || 0,
              expectedReach: byKey.audience?.raw || 0,
              salesPotential: byKey.goal?.raw || 0,
              engagementPotential: byKey.channel?.raw || 0,
              difficulty: clamp(100 - (byKey.preparation?.raw || 50)),
              confidence,
              overall,
              industryScore: byKey.industry?.raw || 0,
              audienceScore: byKey.audience?.raw || 0,
              productScore: byKey.product?.raw || 0,
              goalScore: byKey.goal?.raw || 0,
              seasonScore: byKey.season?.raw || 0,
              locationScore: byKey.location?.raw || 0,
              channelScore: byKey.channel?.raw || 0,
              preparationScore: byKey.preparation?.raw || 0,
              brandCompatibilityScore: byKey.tone?.raw || 0,
              explanation: why || "Deterministic scoring",
            },
            update: {
              relevance: overall,
              urgency: byKey.preparation?.raw || 0,
              expectedReach: byKey.audience?.raw || 0,
              salesPotential: byKey.goal?.raw || 0,
              engagementPotential: byKey.channel?.raw || 0,
              difficulty: clamp(100 - (byKey.preparation?.raw || 50)),
              confidence,
              overall,
              industryScore: byKey.industry?.raw || 0,
              audienceScore: byKey.audience?.raw || 0,
              productScore: byKey.product?.raw || 0,
              goalScore: byKey.goal?.raw || 0,
              seasonScore: byKey.season?.raw || 0,
              locationScore: byKey.location?.raw || 0,
              channelScore: byKey.channel?.raw || 0,
              preparationScore: byKey.preparation?.raw || 0,
              brandCompatibilityScore: byKey.tone?.raw || 0,
              explanation: why || "Deterministic scoring",
            },
          },
        },
      },
    });

    await prisma.opportunityEvidence.deleteMany({
      where: { opportunityId: opportunity.id },
    });
    await prisma.opportunityEvidence.createMany({
      data: results.map((r) => ({
        opportunityId: opportunity.id,
        ruleKey: r.key,
        passed: r.passed,
        detail: r.detail,
        weight: r.weight,
        contribution: r.contribution,
      })),
    });

    await prisma.opportunityHistory.create({
      data: {
        opportunityId: opportunity.id,
        brandId: input.brandId,
        eventId: event.id,
        action: "scored",
        message: `Score ${overall} (${level})`,
        meta: asJson({
          overall,
          level,
          confidence,
          rulesMatched,
          rulesFailed,
          missing,
        }),
      },
    });

    // Conflicts
    await prisma.opportunityConflict.deleteMany({
      where: { opportunityId: opportunity.id, resolved: false },
    });
    const conflicts: Array<{
      kind:
        | "COMPETING_CAMPAIGN"
        | "SCHEDULE_COLLISION"
        | "DUPLICATE_OPPORTUNITY"
        | "EXPIRED_PREPARATION"
        | "RESOURCE_CONFLICT";
      title: string;
      detail: string;
    }> = [];

    for (const c of campaigns) {
      if (!c.startDate || !c.endDate) continue;
      if (eventDate >= c.startDate && eventDate <= c.endDate) {
        conflicts.push({
          kind: "SCHEDULE_COLLISION",
          title: `Schedule collision with ${c.name}`,
          detail: `Event date overlaps campaign window for ${c.name}.`,
        });
        conflicts.push({
          kind: "COMPETING_CAMPAIGN",
          title: `Competing campaign ${c.name}`,
          detail: "Active/planning campaign may compete for the same window.",
        });
      }
    }

    const dupes = await prisma.businessOpportunity.count({
      where: {
        brandId: input.brandId,
        eventId: event.id,
        id: { not: opportunity.id },
        status: { notIn: ["DISMISSED", "IGNORED"] },
      },
    });
    if (dupes > 0) {
      conflicts.push({
        kind: "DUPLICATE_OPPORTUNITY",
        title: "Duplicate opportunity rows",
        detail: "Another opportunity row exists for this event.",
      });
    }

    if (prep.planningStart < today && eventDate >= today) {
      conflicts.push({
        kind: "EXPIRED_PREPARATION",
        title: "Preparation window already open/late",
        detail: "Planning start is in the past relative to today.",
      });
    }

    if (level === "critical" && campaigns.length >= 3) {
      conflicts.push({
        kind: "RESOURCE_CONFLICT",
        title: "Resource pressure",
        detail: "Multiple active campaigns may limit bandwidth for a critical opportunity.",
      });
    }

    if (conflicts.length) {
      await prisma.opportunityConflict.createMany({
        data: conflicts.map((c) => ({
          opportunityId: opportunity.id,
          kind: c.kind,
          title: c.title,
          detail: c.detail,
        })),
      });
    }

    matched++;
  }

  return getMatchingDashboard({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    meta: { matched, skipped },
  });
}

const opportunityInclude = {
  event: {
    select: {
      id: true,
      key: true,
      name: true,
      countries: true,
      industries: true,
      tags: true,
      month: true,
      day: true,
    },
  },
  score: true,
  evidence: { orderBy: { contribution: "desc" as const } },
  conflicts: { where: { resolved: false }, take: 10 },
  history: { orderBy: { createdAt: "desc" as const }, take: 10 },
};

export async function getMatchingDashboard(input: {
  workspaceId: string;
  brandId: string;
  meta?: { matched?: number; skipped?: number };
}) {
  await ensureMatchRules();
  const today = utcToday();
  const rows = await prisma.businessOpportunity.findMany({
    where: {
      brandId: input.brandId,
      matchSource: { in: ["DETERMINISTIC", "MANUAL"] },
    },
    include: opportunityInclude,
    orderBy: [{ pinned: "desc" }, { eventDate: "asc" }],
    take: 200,
  });

  const overrides = await prisma.opportunityOverride.findMany({
    where: { brandId: input.brandId, active: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const upcoming = rows.filter(
    (r) =>
      r.eventDate >= today &&
      !r.ignored &&
      r.status !== "IGNORED" &&
      r.status !== "EXPIRED",
  );
  const critical = upcoming.filter((r) => r.scoreLevel === "critical");
  const ignored = rows.filter(
    (r) => r.ignored || r.status === "IGNORED" || r.scoreLevel === "ignore",
  );
  const expired = rows.filter(
    (r) => r.eventDate < today || r.status === "EXPIRED",
  );
  const lowConfidence = upcoming.filter(
    (r) => (r.confidence ?? 100) < 55,
  );
  const conflicts = rows.flatMap((r) =>
    r.conflicts.map((c) => ({ ...c, opportunityId: r.id, titleOpp: r.title })),
  );

  return {
    upcoming,
    critical,
    ignored,
    expired,
    lowConfidence,
    overrides,
    conflicts,
    recentlyExpired: expired.slice(0, 20),
    manualOverrides: overrides,
    counts: {
      upcoming: upcoming.length,
      critical: critical.length,
      ignored: ignored.length,
      expired: expired.length,
      lowConfidence: lowConfidence.length,
      overrides: overrides.length,
      conflicts: conflicts.length,
    },
    meta: input.meta || null,
  };
}

export async function getOpportunityExplanation(
  opportunityId: string,
  brandId: string,
) {
  return prisma.businessOpportunity.findFirst({
    where: { id: opportunityId, brandId },
    include: {
      ...opportunityInclude,
      event: {
        include: {
          knowledgeLinks: { include: { node: true } },
          seasons: { include: { season: true } },
        },
      },
    },
  });
}

export async function getOpportunityHistory(brandId: string, take = 50) {
  return prisma.opportunityHistory.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getOpportunityConflicts(brandId: string) {
  return prisma.opportunityConflict.findMany({
    where: {
      resolved: false,
      opportunity: { brandId },
    },
    include: {
      opportunity: {
        select: { id: true, title: true, eventDate: true, scoreLevel: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function applyOpportunityOverride(input: {
  brandId: string;
  eventId?: string;
  opportunityId?: string;
  kind:
    | "FORCE_MATCH"
    | "IGNORE_EVENT"
    | "PIN"
    | "PRIORITY"
    | "BLACKLIST"
    | "WHITELIST";
  priority?: number;
  note?: string;
  active?: boolean;
}) {
  let eventId = input.eventId || null;
  if (!eventId && input.opportunityId) {
    const opp = await prisma.businessOpportunity.findFirst({
      where: { id: input.opportunityId, brandId: input.brandId },
    });
    eventId = opp?.eventId || null;
    if (opp && input.kind === "PIN") {
      await prisma.businessOpportunity.update({
        where: { id: opp.id },
        data: { pinned: true },
      });
    }
    if (opp && (input.kind === "IGNORE_EVENT" || input.kind === "BLACKLIST")) {
      await prisma.businessOpportunity.update({
        where: { id: opp.id },
        data: { ignored: true, status: "IGNORED", scoreLevel: "ignore" },
      });
    }
    if (opp && input.kind === "FORCE_MATCH") {
      await prisma.businessOpportunity.update({
        where: { id: opp.id },
        data: {
          ignored: false,
          status: "NEW",
          scoreLevel: "critical",
          matchSource: "MANUAL",
          confidence: 95,
        },
      });
    }
  }

  const override = await prisma.opportunityOverride.create({
    data: {
      brandId: input.brandId,
      eventId,
      kind: input.kind,
      priority: input.priority ?? null,
      note: input.note || null,
      active: input.active ?? true,
    },
  });

  await prisma.opportunityHistory.create({
    data: {
      opportunityId: input.opportunityId || null,
      brandId: input.brandId,
      eventId,
      action: "override",
      message: `${input.kind} applied`,
      meta: asJson({ priority: input.priority, note: input.note }),
    },
  });

  return override;
}
