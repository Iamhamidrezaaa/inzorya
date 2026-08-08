import { createHash } from "crypto";
import type {
  ContentLearningConfidence,
  ContentLearningStatus,
  ContentLearningType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

export const MIN_LEARNING_SAMPLE = 5;
export const STALE_AFTER_DAYS = 90;
export const NON_REAL_METRIC_SOURCES = ["mock", "legacy"] as const;

export type LearningAnalyzeStatus =
  | "NO_DATA"
  | "INSUFFICIENT_SAMPLE"
  | "CAPABILITY_NOT_AVAILABLE"
  | "NOT_CONNECTED"
  | "READY";

export type LearningScope = {
  workspaceId: string;
  brandId: string;
};

export type AnalyzeInput = {
  scope: LearningScope;
  platform?: string;
  from?: string;
  to?: string;
};

export type PublicLearning = {
  id: string;
  workspaceId: string;
  brandId: string;
  platform: string | null;
  dimension: string;
  type: ContentLearningType;
  statement: string;
  rationale: string;
  confidence: ContentLearningConfidence;
  sampleSize: number;
  metric: string;
  periodFrom: string | null;
  periodTo: string | null;
  lastObservedAt: string;
  status: ContentLearningStatus;
  fingerprint: string;
  outlierPresent: boolean;
  limitations: string[];
  usefulFeedback: boolean | null;
  createdAt: string;
  updatedAt: string;
  evidenceCount?: number;
};

export type PublicEvidence = {
  id: string;
  learningId: string;
  contentDraftId: string | null;
  socialPublicationId: string | null;
  contentMetricId: string | null;
  evidenceType: string;
  metric: string;
  value: number | null;
  summary: string;
  period: string | null;
  createdAt: string;
};

type MetricRow = {
  id: string;
  platform: string;
  contentType: string;
  title: string;
  publishedAt: Date;
  engagement: number | null;
  impressions: number | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  clicks: number | null;
  saves: number | null;
  contentDraftId: string | null;
  socialPublicationId: string | null;
  externalPostId: string | null;
  source: string;
};

type CandidateLearning = {
  fingerprint: string;
  platform: string | null;
  dimension: string;
  type: ContentLearningType;
  statement: string;
  rationale: string;
  confidence: ContentLearningConfidence;
  sampleSize: number;
  metric: string;
  periodFrom: Date | null;
  periodTo: Date | null;
  outlierPresent: boolean;
  limitations: string[];
  evidence: Array<{
    contentDraftId: string | null;
    socialPublicationId: string | null;
    contentMetricId: string | null;
    evidenceType: string;
    metric: string;
    value: number | null;
    summary: string;
    period: string | null;
  }>;
};

function fingerprintOf(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function metricValue(
  row: MetricRow,
  metric: "engagement" | "impressions" | "views" | "likes",
): number | null {
  const v = row[metric];
  return v == null ? null : Number(v);
}

function pickPrimaryMetric(
  rows: MetricRow[],
): "engagement" | "impressions" | "views" | "likes" | null {
  const counts = {
    engagement: 0,
    impressions: 0,
    views: 0,
    likes: 0,
  };
  for (const r of rows) {
    if (r.engagement != null) counts.engagement += 1;
    if (r.impressions != null) counts.impressions += 1;
    if (r.views != null) counts.views += 1;
    if (r.likes != null) counts.likes += 1;
  }
  const order = ["engagement", "impressions", "views", "likes"] as const;
  let best: (typeof order)[number] | null = null;
  let bestN = 0;
  for (const m of order) {
    if (counts[m] > bestN) {
      best = m;
      bestN = counts[m];
    }
  }
  return bestN > 0 ? best : null;
}

function confidenceFor(sampleSize: number, outlierPresent: boolean): ContentLearningConfidence {
  if (sampleSize < MIN_LEARNING_SAMPLE) return "LOW";
  if (outlierPresent || sampleSize < 10) return "LOW";
  if (sampleSize < 20) return "MEDIUM";
  return "HIGH";
}

function dayLabel(d: Date): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    d.getUTCDay()
  ]!;
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function toPublic(row: {
  id: string;
  workspaceId: string;
  brandId: string;
  platform: string | null;
  dimension: string;
  type: ContentLearningType;
  statement: string;
  rationale: string;
  confidence: ContentLearningConfidence;
  sampleSize: number;
  metric: string;
  periodFrom: Date | null;
  periodTo: Date | null;
  lastObservedAt: Date;
  status: ContentLearningStatus;
  fingerprint: string;
  outlierPresent: boolean;
  limitations: string[];
  usefulFeedback: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { evidence: number };
}): PublicLearning {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    brandId: row.brandId,
    platform: row.platform,
    dimension: row.dimension,
    type: row.type,
    statement: row.statement,
    rationale: row.rationale,
    confidence: row.confidence,
    sampleSize: row.sampleSize,
    metric: row.metric,
    periodFrom: row.periodFrom?.toISOString() ?? null,
    periodTo: row.periodTo?.toISOString() ?? null,
    lastObservedAt: row.lastObservedAt.toISOString(),
    status: row.status,
    fingerprint: row.fingerprint,
    outlierPresent: row.outlierPresent,
    limitations: row.limitations,
    usefulFeedback: row.usefulFeedback,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    evidenceCount: row._count?.evidence,
  };
}

function detectFormatLearnings(
  rows: MetricRow[],
  metric: "engagement" | "impressions" | "views" | "likes",
  periodFrom: Date | null,
  periodTo: Date | null,
): CandidateLearning[] {
  const byPlatform = new Map<string, MetricRow[]>();
  for (const r of rows) {
    const list = byPlatform.get(r.platform) ?? [];
    list.push(r);
    byPlatform.set(r.platform, list);
  }

  const out: CandidateLearning[] = [];

  for (const [platform, platformRows] of byPlatform) {
    const byFormat = new Map<string, { values: number[]; rows: MetricRow[] }>();
    for (const r of platformRows) {
      const v = metricValue(r, metric);
      if (v == null) continue;
      const key = (r.contentType || "UNKNOWN").toUpperCase();
      const cur = byFormat.get(key) ?? { values: [], rows: [] };
      cur.values.push(v);
      cur.rows.push(r);
      byFormat.set(key, cur);
    }

    const formats = [...byFormat.entries()].filter(
      ([, g]) => g.values.length >= 2,
    );
    if (formats.length < 2) continue;

    const totalSample = formats.reduce((n, [, g]) => n + g.values.length, 0);
    if (totalSample < MIN_LEARNING_SAMPLE) continue;

    const ranked = formats
      .map(([format, g]) => ({
        format,
        median: median(g.values)!,
        n: g.values.length,
        rows: g.rows,
        values: g.values,
      }))
      .sort((a, b) => b.median - a.median);

    const top = ranked[0]!;
    const second = ranked[1]!;
    if (top.median <= second.median) continue;

    const maxVal = Math.max(...top.values);
    const outlierPresent = maxVal > top.median * 3 && top.values.length >= 3;

    const evidenceRows = [...top.rows, ...second.rows].slice(0, 12);
    const fp = fingerprintOf([
      platform,
      "format",
      metric,
      "median_higher",
      `${top.format}>${second.format}`,
    ]);

    out.push({
      fingerprint: fp,
      platform,
      dimension: "format",
      type: "OBSERVATION",
      statement: `${top.format} showed higher median ${metric} than ${second.format} on ${platform} in this sample.`,
      rationale: `Deterministic median comparison of observed ${metric} across formats on ${platform}. Observed association — not causal. ${top.format} median=${top.median.toFixed(1)} (n=${top.n}); ${second.format} median=${second.median.toFixed(1)} (n=${second.n}).`,
      confidence: confidenceFor(totalSample, outlierPresent),
      sampleSize: totalSample,
      metric,
      periodFrom,
      periodTo,
      outlierPresent,
      limitations: [
        ...(outlierPresent
          ? ["outlierPresent: one or more posts may skew the observation"]
          : []),
        ...(totalSample < 10 ? ["SMALL_SAMPLE"] : []),
        "Observed association — not causal.",
        "Does not predict future performance.",
      ],
      evidence: evidenceRows.map((r) => ({
        contentDraftId: r.contentDraftId,
        socialPublicationId: r.socialPublicationId,
        contentMetricId: r.id,
        evidenceType: "metric",
        metric,
        value: metricValue(r, metric),
        summary: `${r.contentType}: ${metric}=${metricValue(r, metric)}`,
        period: r.publishedAt.toISOString().slice(0, 10),
      })),
    });
  }

  return out;
}

function detectPublishingDayLearnings(
  rows: MetricRow[],
  metric: "engagement" | "impressions" | "views" | "likes",
  periodFrom: Date | null,
  periodTo: Date | null,
): CandidateLearning[] {
  const byPlatform = new Map<string, MetricRow[]>();
  for (const r of rows) {
    const list = byPlatform.get(r.platform) ?? [];
    list.push(r);
    byPlatform.set(r.platform, list);
  }

  const out: CandidateLearning[] = [];

  for (const [platform, platformRows] of byPlatform) {
    const weekday: number[] = [];
    const weekend: number[] = [];
    const weekdayRows: MetricRow[] = [];
    const weekendRows: MetricRow[] = [];

    for (const r of platformRows) {
      const v = metricValue(r, metric);
      if (v == null) continue;
      if (isWeekend(r.publishedAt)) {
        weekend.push(v);
        weekendRows.push(r);
      } else {
        weekday.push(v);
        weekdayRows.push(r);
      }
    }

    const sampleSize = weekday.length + weekend.length;
    if (sampleSize < MIN_LEARNING_SAMPLE) continue;
    if (weekday.length < 2 || weekend.length < 2) continue;

    const weekMed = median(weekday)!;
    const endMed = median(weekend)!;
    if (weekMed === endMed) continue;

    const higherIsWeekday = weekMed > endMed;
    const higherLabel = higherIsWeekday ? "weekdays" : "weekends";
    const lowerLabel = higherIsWeekday ? "weekends" : "weekdays";
    const higherMed = higherIsWeekday ? weekMed : endMed;
    const lowerMed = higherIsWeekday ? endMed : weekMed;
    const higherRows = higherIsWeekday ? weekdayRows : weekendRows;
    const lowerRows = higherIsWeekday ? weekendRows : weekdayRows;

    const higherValues = higherIsWeekday ? weekday : weekend;
    const maxVal = Math.max(...higherValues);
    const outlierPresent =
      maxVal > higherMed * 3 && higherValues.length >= 3;

    const fp = fingerprintOf([
      platform,
      "publishing_day",
      metric,
      "weekday_vs_weekend",
      higherLabel,
    ]);

    out.push({
      fingerprint: fp,
      platform,
      dimension: "publishing_day",
      type: "OBSERVATION",
      statement: `Posts published on ${higherLabel} showed higher median ${metric} than ${lowerLabel} on ${platform} in this sample.`,
      rationale: `Observed association between publishing day bucket and ${metric} — not causal. ${higherLabel} median=${higherMed.toFixed(1)}; ${lowerLabel} median=${lowerMed.toFixed(1)}.`,
      confidence: confidenceFor(sampleSize, outlierPresent),
      sampleSize,
      metric,
      periodFrom,
      periodTo,
      outlierPresent,
      limitations: [
        ...(outlierPresent ? ["outlierPresent"] : []),
        ...(sampleSize < 10 ? ["SMALL_SAMPLE"] : []),
        "Observed association — not causal.",
        "Not an optimal posting-time recommendation.",
      ],
      evidence: [...higherRows, ...lowerRows].slice(0, 12).map((r) => ({
        contentDraftId: r.contentDraftId,
        socialPublicationId: r.socialPublicationId,
        contentMetricId: r.id,
        evidenceType: "metric",
        metric,
        value: metricValue(r, metric),
        summary: `${dayLabel(r.publishedAt)} ${metric}=${metricValue(r, metric)}`,
        period: r.publishedAt.toISOString().slice(0, 10),
      })),
    });
  }

  return out;
}

function detectTopicLearnings(
  rows: MetricRow[],
  metric: "engagement" | "impressions" | "views" | "likes",
  periodFrom: Date | null,
  periodTo: Date | null,
): CandidateLearning[] {
  const byPlatform = new Map<string, MetricRow[]>();
  for (const r of rows) {
    if (!r.title || r.title.trim().length < 2) continue;
    const list = byPlatform.get(r.platform) ?? [];
    list.push(r);
    byPlatform.set(r.platform, list);
  }

  const out: CandidateLearning[] = [];

  for (const [platform, platformRows] of byPlatform) {
    // Group by normalized short topic token (first 40 chars of title) only when repeated
    const byTopic = new Map<string, { values: number[]; rows: MetricRow[] }>();
    for (const r of platformRows) {
      const v = metricValue(r, metric);
      if (v == null) continue;
      const topic = r.title.trim().slice(0, 60);
      const cur = byTopic.get(topic) ?? { values: [], rows: [] };
      cur.values.push(v);
      cur.rows.push(r);
      byTopic.set(topic, cur);
    }

    const topics = [...byTopic.entries()].filter(([, g]) => g.values.length >= 2);
    if (topics.length < 2) continue;
    const totalSample = topics.reduce((n, [, g]) => n + g.values.length, 0);
    if (totalSample < MIN_LEARNING_SAMPLE) continue;

    const ranked = topics
      .map(([topic, g]) => ({
        topic,
        median: median(g.values)!,
        n: g.values.length,
        rows: g.rows,
        values: g.values,
      }))
      .sort((a, b) => b.median - a.median);

    const top = ranked[0]!;
    const second = ranked[1]!;
    if (top.median <= second.median) continue;

    const maxVal = Math.max(...top.values);
    const outlierPresent = maxVal > top.median * 3 && top.values.length >= 3;
    const fp = fingerprintOf([
      platform,
      "topic",
      metric,
      "median_higher",
      top.topic.slice(0, 40),
    ]);

    out.push({
      fingerprint: fp,
      platform,
      dimension: "topic",
      type: "OBSERVATION",
      statement: `Content titled "${top.topic}" showed higher median ${metric} than "${second.topic}" on ${platform} in this sample.`,
      rationale: `Deterministic topic-title grouping using persisted titles only. Observed association — not causal.`,
      confidence: confidenceFor(totalSample, outlierPresent),
      sampleSize: totalSample,
      metric,
      periodFrom,
      periodTo,
      outlierPresent,
      limitations: [
        ...(outlierPresent ? ["outlierPresent"] : []),
        ...(totalSample < 10 ? ["SMALL_SAMPLE"] : []),
        "Topic labels come from persisted titles — not invented.",
        "Observed association — not causal.",
      ],
      evidence: [...top.rows, ...second.rows].slice(0, 12).map((r) => ({
        contentDraftId: r.contentDraftId,
        socialPublicationId: r.socialPublicationId,
        contentMetricId: r.id,
        evidenceType: "metric",
        metric,
        value: metricValue(r, metric),
        summary: `${r.title}: ${metric}=${metricValue(r, metric)}`,
        period: r.publishedAt.toISOString().slice(0, 10),
      })),
    });
  }

  return out;
}

function detectFactCount(
  rows: MetricRow[],
  periodFrom: Date | null,
  periodTo: Date | null,
): CandidateLearning[] {
  if (rows.length < MIN_LEARNING_SAMPLE) return [];
  const byPlatform = new Map<string, number>();
  for (const r of rows) {
    byPlatform.set(r.platform, (byPlatform.get(r.platform) ?? 0) + 1);
  }
  const out: CandidateLearning[] = [];
  for (const [platform, count] of byPlatform) {
    if (count < MIN_LEARNING_SAMPLE) continue;
    const fp = fingerprintOf([platform, "volume", "count", "published_with_metrics"]);
    out.push({
      fingerprint: fp,
      platform,
      dimension: "volume",
      type: "FACT",
      statement: `${count} published posts with real metrics were observed on ${platform} during the selected period.`,
      rationale: `Count of ContentMetric rows with non-mock source attributed to ${platform}.`,
      confidence: confidenceFor(count, false),
      sampleSize: count,
      metric: "count",
      periodFrom,
      periodTo,
      outlierPresent: false,
      limitations: ["FACT about observed volume only — not a performance ranking."],
      evidence: rows
        .filter((r) => r.platform === platform)
        .slice(0, 8)
        .map((r) => ({
          contentDraftId: r.contentDraftId,
          socialPublicationId: r.socialPublicationId,
          contentMetricId: r.id,
          evidenceType: "publication",
          metric: "count",
          value: 1,
          summary: r.title || r.externalPostId || r.id,
          period: r.publishedAt.toISOString().slice(0, 10),
        })),
    });
  }
  return out;
}

export function createContentLearningEngine(deps?: { db?: PrismaClient }) {
  const db = deps?.db ?? defaultPrisma;

  async function loadRealMetrics(input: AnalyzeInput): Promise<MetricRow[]> {
    const from = input.from ? new Date(input.from) : undefined;
    const to = input.to ? new Date(input.to) : undefined;

    const where: Prisma.ContentMetricWhereInput = {
      brandId: input.scope.brandId,
      NOT: { source: { in: [...NON_REAL_METRIC_SOURCES] } },
      OR: [
        { socialPublicationId: { not: null } },
        { externalPostId: { not: null } },
      ],
      ...(input.platform
        ? { platform: { equals: input.platform, mode: "insensitive" } }
        : {}),
      ...(from || to
        ? {
            publishedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const rows = await db.contentMetric.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: 500,
    });

    return rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      contentType: r.contentType,
      title: r.title,
      publishedAt: r.publishedAt,
      engagement: r.engagement,
      impressions: r.impressions,
      reach: r.reach,
      views: r.views,
      likes: r.likes,
      comments: r.comments,
      shares: r.shares,
      clicks: r.clicks,
      saves: r.saves,
      contentDraftId: r.contentDraftId,
      socialPublicationId: r.socialPublicationId,
      externalPostId: r.externalPostId,
      source: r.source,
    }));
  }

  async function upsertCandidate(
    scope: LearningScope,
    candidate: CandidateLearning,
  ): Promise<PublicLearning> {
    const existing = await db.contentLearning.findUnique({
      where: {
        brandId_fingerprint: {
          brandId: scope.brandId,
          fingerprint: candidate.fingerprint,
        },
      },
      include: { _count: { select: { versions: true } } },
    });

    const now = new Date();

    if (!existing) {
      const created = await db.contentLearning.create({
        data: {
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
          platform: candidate.platform,
          dimension: candidate.dimension,
          type: candidate.type,
          statement: candidate.statement,
          rationale: candidate.rationale,
          confidence: candidate.confidence,
          sampleSize: candidate.sampleSize,
          metric: candidate.metric,
          periodFrom: candidate.periodFrom,
          periodTo: candidate.periodTo,
          lastObservedAt: now,
          status: "ACTIVE",
          fingerprint: candidate.fingerprint,
          outlierPresent: candidate.outlierPresent,
          limitations: candidate.limitations,
          evidence: {
            create: candidate.evidence.map((e) => ({
              contentDraftId: e.contentDraftId,
              socialPublicationId: e.socialPublicationId,
              contentMetricId: e.contentMetricId,
              evidenceType: e.evidenceType,
              metric: e.metric,
              value: e.value,
              summary: e.summary,
              period: e.period,
            })),
          },
        },
        include: { _count: { select: { evidence: true } } },
      });
      return toPublic(created);
    }

    const statementChanged = existing.statement !== candidate.statement;
    if (statementChanged || existing.sampleSize !== candidate.sampleSize) {
      await db.contentLearningVersion.create({
        data: {
          learningId: existing.id,
          version: (existing._count.versions ?? 0) + 1,
          statement: existing.statement,
          rationale: existing.rationale,
          confidence: existing.confidence,
          sampleSize: existing.sampleSize,
          metric: existing.metric,
          outlierPresent: existing.outlierPresent,
          snapshot: {
            periodFrom: existing.periodFrom?.toISOString() ?? null,
            periodTo: existing.periodTo?.toISOString() ?? null,
            limitations: existing.limitations,
          },
        },
      });
    }

    await db.contentLearningEvidence.deleteMany({
      where: { learningId: existing.id },
    });

    const updated = await db.contentLearning.update({
      where: { id: existing.id },
      data: {
        statement: candidate.statement,
        rationale: candidate.rationale,
        confidence: candidate.confidence,
        sampleSize: candidate.sampleSize,
        metric: candidate.metric,
        periodFrom: candidate.periodFrom,
        periodTo: candidate.periodTo,
        lastObservedAt: now,
        status: existing.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
        outlierPresent: candidate.outlierPresent,
        limitations: candidate.limitations,
        platform: candidate.platform,
        evidence: {
          create: candidate.evidence.map((e) => ({
            contentDraftId: e.contentDraftId,
            socialPublicationId: e.socialPublicationId,
            contentMetricId: e.contentMetricId,
            evidenceType: e.evidenceType,
            metric: e.metric,
            value: e.value,
            summary: e.summary,
            period: e.period,
          })),
        },
      },
      include: { _count: { select: { evidence: true } } },
    });

    return toPublic(updated);
  }

  return {
    async analyze(input: AnalyzeInput): Promise<{
      status: LearningAnalyzeStatus;
      learnings: PublicLearning[];
      sampleSize: number;
      limitations: string[];
    }> {
      const rows = await loadRealMetrics(input);
      if (rows.length === 0) {
        return {
          status: "NO_DATA",
          learnings: [],
          sampleSize: 0,
          limitations: [
            "No real ContentMetric rows (mock/legacy excluded).",
            "LinkedIn analytics may be CAPABILITY_NOT_AVAILABLE — do not invent metrics.",
          ],
        };
      }

      if (rows.length < MIN_LEARNING_SAMPLE) {
        return {
          status: "INSUFFICIENT_SAMPLE",
          learnings: [],
          sampleSize: rows.length,
          limitations: [
            `sampleSize ${rows.length} < ${MIN_LEARNING_SAMPLE}`,
            "SMALL_SAMPLE — no strong learning created",
          ],
        };
      }

      const metric = pickPrimaryMetric(rows);
      if (!metric) {
        return {
          status: "NO_DATA",
          learnings: [],
          sampleSize: rows.length,
          limitations: [
            "All candidate metrics were null — missing metrics stay unavailable (not zero).",
          ],
        };
      }

      const published = rows.map((r) => r.publishedAt.getTime());
      const periodFrom = new Date(Math.min(...published));
      const periodTo = new Date(Math.max(...published));

      const candidates = [
        ...detectFactCount(rows, periodFrom, periodTo),
        ...detectFormatLearnings(rows, metric, periodFrom, periodTo),
        ...detectPublishingDayLearnings(rows, metric, periodFrom, periodTo),
        ...detectTopicLearnings(rows, metric, periodFrom, periodTo),
      ];

      if (candidates.length === 0) {
        return {
          status: "INSUFFICIENT_SAMPLE",
          learnings: [],
          sampleSize: rows.length,
          limitations: [
            "Enough rows exist, but no comparable groups met deterministic thresholds.",
          ],
        };
      }

      const learnings: PublicLearning[] = [];
      for (const c of candidates) {
        learnings.push(await upsertCandidate(input.scope, c));
      }

      return {
        status: "READY",
        learnings,
        sampleSize: rows.length,
        limitations: [
          "Learnings are OBSERVATIONS/FACTS from historical data only.",
          "No predictions or automatic strategy changes.",
        ],
      };
    },

    async list(
      scope: LearningScope,
      opts?: {
        status?: ContentLearningStatus;
        platform?: string;
        dimension?: string;
        limit?: number;
      },
    ): Promise<PublicLearning[]> {
      const limit = Math.min(100, Math.max(1, opts?.limit ?? 40));
      const rows = await db.contentLearning.findMany({
        where: {
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
          ...(opts?.status ? { status: opts.status } : {}),
          ...(opts?.platform
            ? { platform: { equals: opts.platform, mode: "insensitive" } }
            : {}),
          ...(opts?.dimension ? { dimension: opts.dimension } : {}),
        },
        orderBy: [{ lastObservedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
        include: { _count: { select: { evidence: true } } },
      });
      return rows.map(toPublic);
    },

    async get(id: string, scope: LearningScope): Promise<PublicLearning | null> {
      const row = await db.contentLearning.findFirst({
        where: {
          id,
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
        },
        include: { _count: { select: { evidence: true } } },
      });
      return row ? toPublic(row) : null;
    },

    async getEvidence(
      id: string,
      scope: LearningScope,
    ): Promise<PublicEvidence[]> {
      const learning = await db.contentLearning.findFirst({
        where: {
          id,
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
        },
        select: { id: true },
      });
      if (!learning) return [];
      const rows = await db.contentLearningEvidence.findMany({
        where: { learningId: id },
        orderBy: { createdAt: "asc" },
        take: 50,
      });
      return rows.map((e) => ({
        id: e.id,
        learningId: e.learningId,
        contentDraftId: e.contentDraftId,
        socialPublicationId: e.socialPublicationId,
        contentMetricId: e.contentMetricId,
        evidenceType: e.evidenceType,
        metric: e.metric,
        value: e.value,
        summary: e.summary,
        period: e.period,
        createdAt: e.createdAt.toISOString(),
      }));
    },

    async archive(id: string, scope: LearningScope): Promise<PublicLearning> {
      const existing = await db.contentLearning.findFirst({
        where: {
          id,
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
        },
      });
      if (!existing) {
        throw new ContentLearningError("NOT_FOUND", "Learning not found");
      }
      const updated = await db.contentLearning.update({
        where: { id },
        data: { status: "ARCHIVED" },
        include: { _count: { select: { evidence: true } } },
      });
      return toPublic(updated);
    },

    async refresh(id: string, scope: LearningScope): Promise<{
      learning: PublicLearning | null;
      status: LearningAnalyzeStatus;
      limitations: string[];
    }> {
      const existing = await db.contentLearning.findFirst({
        where: {
          id,
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
        },
      });
      if (!existing) {
        throw new ContentLearningError("NOT_FOUND", "Learning not found");
      }

      const ageDays =
        (Date.now() - existing.lastObservedAt.getTime()) /
        (24 * 60 * 60 * 1000);
      if (ageDays >= STALE_AFTER_DAYS && existing.status === "ACTIVE") {
        await db.contentLearning.update({
          where: { id },
          data: { status: "STALE" },
        });
      }

      const analyzed = await this.analyze({
        scope,
        platform: existing.platform ?? undefined,
        from: existing.periodFrom?.toISOString(),
        to: existing.periodTo?.toISOString(),
      });

      const refreshed = await db.contentLearning.findFirst({
        where: {
          brandId: scope.brandId,
          fingerprint: existing.fingerprint,
        },
        include: { _count: { select: { evidence: true } } },
      });

      return {
        learning: refreshed ? toPublic(refreshed) : null,
        status: analyzed.status,
        limitations: analyzed.limitations,
      };
    },

    async getRelevant(input: {
      scope: LearningScope;
      platform?: string;
      dimension?: string;
      topic?: string;
      objective?: string;
      format?: string;
      limit?: number;
    }): Promise<{
      available: boolean;
      reason?: string;
      learnings: PublicLearning[];
      limitations: string[];
    }> {
      const limit = Math.min(30, Math.max(1, input.limit ?? 10));
      const rows = await db.contentLearning.findMany({
        where: {
          workspaceId: input.scope.workspaceId,
          brandId: input.scope.brandId,
          status: { in: ["ACTIVE", "STALE"] },
          ...(input.platform
            ? { platform: { equals: input.platform, mode: "insensitive" } }
            : {}),
          ...(input.dimension ? { dimension: input.dimension } : {}),
          ...(input.format
            ? {
                OR: [
                  { statement: { contains: input.format, mode: "insensitive" } },
                  { dimension: "format" },
                ],
              }
            : {}),
          ...(input.topic
            ? {
                OR: [
                  { statement: { contains: input.topic, mode: "insensitive" } },
                  { dimension: "topic" },
                ],
              }
            : {}),
        },
        orderBy: [{ sampleSize: "desc" }, { lastObservedAt: "desc" }],
        take: limit,
        include: { _count: { select: { evidence: true } } },
      });

      if (rows.length === 0) {
        return {
          available: false,
          reason: "NO_LEARNING_DATA",
          learnings: [],
          limitations: [
            "No ACTIVE/STALE learnings for this scope. Run analyze when real metrics exist.",
          ],
        };
      }

      return {
        available: true,
        learnings: rows.map(toPublic),
        limitations: [
          "Historical evidence only — not predictions.",
          "Explicit user constraints always override learnings.",
        ],
      };
    },

    async setUsefulFeedback(
      id: string,
      scope: LearningScope,
      useful: boolean,
    ): Promise<PublicLearning> {
      const existing = await db.contentLearning.findFirst({
        where: {
          id,
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
        },
      });
      if (!existing) {
        throw new ContentLearningError("NOT_FOUND", "Learning not found");
      }
      const updated = await db.contentLearning.update({
        where: { id },
        data: { usefulFeedback: useful },
        include: { _count: { select: { evidence: true } } },
      });
      return toPublic(updated);
    },
  };
}

export type ContentLearningEngine = ReturnType<
  typeof createContentLearningEngine
>;

export class ContentLearningError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN" | "VALIDATION_ERROR";

  constructor(code: ContentLearningError["code"], message: string) {
    super(message);
    this.name = "ContentLearningError";
    this.code = code;
  }
}

let defaultEngine: ContentLearningEngine | null = null;

export function getContentLearningEngine(): ContentLearningEngine {
  if (!defaultEngine) defaultEngine = createContentLearningEngine();
  return defaultEngine;
}

export function resetContentLearningEngine(): void {
  defaultEngine = null;
}

export function setContentLearningEngineForTests(
  engine: ContentLearningEngine | null,
): void {
  defaultEngine = engine;
}
