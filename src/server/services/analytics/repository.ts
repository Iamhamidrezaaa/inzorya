import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  METRIC_CATALOG,
  generateMockAnalytics,
  type AnalyticsBundle,
  type TimeRangeKey,
} from "@/lib/analytics/mock-provider";

export type AnalyticsQuery = {
  brandId: string;
  rangeKey: TimeRangeKey;
  customStart?: string;
  customEnd?: string;
  platform?: string;
  campaign?: string;
  contentType?: string;
  author?: string;
  status?: string;
  q?: string;
};

export interface AnalyticsCache {
  get(key: string): Promise<AnalyticsBundle | null>;
  set(key: string, value: AnalyticsBundle, ttlMs?: number): Promise<void>;
}

/** In-memory cache interface — swap for Redis later without service changes. */
export class MemoryAnalyticsCache implements AnalyticsCache {
  private store = new Map<string, { value: AnalyticsBundle; expires: number }>();
  async get(key: string) {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expires) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }
  async set(key: string, value: AnalyticsBundle, ttlMs = 60_000) {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }
}

export interface AnalyticsRepository {
  getBundle(query: AnalyticsQuery): Promise<AnalyticsBundle>;
  ensureSeeded(brandId: string): Promise<void>;
  listReports(brandId: string): Promise<unknown[]>;
  listTemplates(brandId: string): Promise<unknown[]>;
  saveReport(input: {
    brandId: string;
    name: string;
    rangeLabel?: string;
    metrics: string[];
    charts: string[];
    payload?: unknown;
    templateId?: string | null;
  }): Promise<unknown>;
  saveTemplate(input: {
    brandId: string;
    name: string;
    description?: string;
    metrics: string[];
    charts: string[];
  }): Promise<unknown>;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function applyFilters(bundle: AnalyticsBundle, query: AnalyticsQuery): AnalyticsBundle {
  let posts = bundle.content.posts;
  if (query.platform) {
    posts = posts.filter((p) => p.platform === query.platform);
  }
  if (query.contentType) {
    posts = posts.filter((p) => p.contentType === query.contentType);
  }
  if (query.author) {
    posts = posts.filter((p) => p.author === query.author);
  }
  if (query.status) {
    posts = posts.filter((p) => p.status === query.status);
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    posts = posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.platform.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q),
    );
  }

  let campaigns = bundle.campaigns;
  if (query.campaign) {
    campaigns = campaigns.filter((c) => c.id === query.campaign);
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    campaigns = campaigns.filter((c) => c.name.toLowerCase().includes(q));
  }

  let channels = bundle.channels;
  if (query.platform) {
    channels = channels.filter((c) => c.platform === query.platform);
  }

  return {
    ...bundle,
    content: { ...bundle.content, posts },
    campaigns,
    channels,
  };
}

export class MockAnalyticsRepository implements AnalyticsRepository {
  constructor(private cache: AnalyticsCache = new MemoryAnalyticsCache()) {}

  async ensureSeeded(brandId: string) {
    const count = await prisma.analyticsSnapshot.count({ where: { brandId } });
    if (count > 0) return;

    for (const m of METRIC_CATALOG) {
      await prisma.metric.upsert({
        where: { key: m.key },
        create: m,
        update: { name: m.name, category: m.category, unit: m.unit },
      });
    }

    const bundle = generateMockAnalytics({ brandId, rangeKey: "30d" });

    for (const point of bundle.series) {
      await prisma.analyticsSnapshot.upsert({
        where: {
          brandId_date_granularity_source: {
            brandId,
            date: new Date(point.date),
            granularity: "day",
            source: "mock",
          },
        },
        create: {
          brandId,
          date: new Date(point.date),
          granularity: "day",
          source: "mock",
          values: asJson(point.values),
        },
        update: { values: asJson(point.values) },
      });
    }

    for (const [i, kpi] of bundle.kpis.entries()) {
      await prisma.kpi.upsert({
        where: { brandId_metricKey: { brandId, metricKey: kpi.key } },
        create: {
          brandId,
          metricKey: kpi.key,
          label: kpi.label,
          currentValue: kpi.current,
          previousValue: kpi.previous,
          changePct: kpi.changePct,
          sparkline: kpi.sparkline,
          unit: kpi.unit,
          sortOrder: i,
        },
        update: {
          currentValue: kpi.current,
          previousValue: kpi.previous,
          changePct: kpi.changePct,
          sparkline: kpi.sparkline,
        },
      });
    }

    const lastDate = new Date(bundle.range.end);
    await prisma.audienceSnapshot.upsert({
      where: { brandId_date: { brandId, date: lastDate } },
      create: {
        brandId,
        date: lastDate,
        locations: asJson(bundle.audience.locations),
        ages: asJson(bundle.audience.ages),
        genders: asJson(bundle.audience.genders),
        languages: asJson(bundle.audience.languages),
        activeHours: asJson(bundle.audience.activeHours),
        devices: asJson(bundle.audience.devices),
      },
      update: {
        locations: asJson(bundle.audience.locations),
        ages: asJson(bundle.audience.ages),
        genders: asJson(bundle.audience.genders),
        languages: asJson(bundle.audience.languages),
        activeHours: asJson(bundle.audience.activeHours),
        devices: asJson(bundle.audience.devices),
      },
    });

    for (const post of bundle.content.posts) {
      await prisma.contentMetric.upsert({
        where: { brandId_externalId: { brandId, externalId: post.id } },
        create: {
          brandId,
          externalId: post.id,
          title: post.title,
          platform: post.platform,
          contentType: post.contentType,
          author: post.author,
          status: post.status,
          publishedAt: new Date(post.publishedAt),
          reach: post.reach,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          saves: post.saves,
          ctr: post.ctr,
          engagement: post.engagement,
        },
        update: {
          reach: post.reach,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          saves: post.saves,
          ctr: post.ctr,
          engagement: post.engagement,
        },
      });
    }

    for (const c of bundle.campaigns) {
      await prisma.campaignMetric.upsert({
        where: { brandId_campaignKey: { brandId, campaignKey: c.id } },
        create: {
          brandId,
          campaignKey: c.id,
          name: c.name,
          status: c.status,
          reach: c.reach,
          engagement: c.engagement,
          clicks: c.clicks,
          conversions: c.conversions,
          spend: c.spend,
          revenue: c.revenue,
          roi: c.roi,
        },
        update: {
          reach: c.reach,
          engagement: c.engagement,
          clicks: c.clicks,
          conversions: c.conversions,
          spend: c.spend,
          revenue: c.revenue,
          roi: c.roi,
        },
      });
    }

    for (const ch of bundle.channels) {
      for (const point of ch.series) {
        await prisma.channelMetric.upsert({
          where: {
            brandId_platform_date: {
              brandId,
              platform: ch.platform,
              date: new Date(point.date),
            },
          },
          create: {
            brandId,
            platform: ch.platform,
            date: new Date(point.date),
            followers: ch.followers,
            reach: point.reach,
            engagement: point.engagement,
            impressions: Math.round(point.reach * 1.4),
            messages: ch.messages,
            profileVisits: ch.profileVisits,
          },
          update: {
            reach: point.reach,
            engagement: point.engagement,
          },
        });
      }
    }

    await prisma.insight.deleteMany({ where: { brandId } });
    await prisma.insight.createMany({
      data: bundle.insights.map((ins) => ({
        brandId,
        kind: ins.kind,
        severity: ins.severity,
        title: ins.title,
        body: ins.body,
        metricKey: ins.metricKey,
        changePct: ins.changePct,
        ruleKey: ins.ruleKey,
        rangeStart: new Date(bundle.range.start),
        rangeEnd: new Date(bundle.range.end),
      })),
    });

    const templates = await prisma.reportTemplate.count({ where: { brandId } });
    if (templates === 0) {
      await prisma.reportTemplate.createMany({
        data: [
          {
            brandId,
            name: "Executive weekly",
            description: "KPI overview + engagement + growth",
            metrics: ["followers", "reach", "engagement", "revenue"],
            charts: ["kpi", "engagement", "growth"],
          },
          {
            brandId,
            name: "Content performance",
            description: "Top posts and content table",
            metrics: ["reach", "likes", "saves", "ctr"],
            charts: ["content", "heatmap"],
          },
        ],
      });
    }
  }

  async getBundle(query: AnalyticsQuery) {
    const cacheKey = JSON.stringify(query);
    const cached = await this.cache.get(cacheKey);
    if (cached) return applyFilters(cached, query);

    await this.ensureSeeded(query.brandId);
    const bundle = generateMockAnalytics({
      brandId: query.brandId,
      rangeKey: query.rangeKey,
      customStart: query.customStart,
      customEnd: query.customEnd,
    });
    await this.cache.set(cacheKey, bundle);
    return applyFilters(bundle, query);
  }

  async listReports(brandId: string) {
    return prisma.report.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async listTemplates(brandId: string) {
    await this.ensureSeeded(brandId);
    return prisma.reportTemplate.findMany({
      where: { brandId },
      orderBy: { name: "asc" },
    });
  }

  async saveReport(input: {
    brandId: string;
    name: string;
    rangeLabel?: string;
    metrics: string[];
    charts: string[];
    payload?: unknown;
    templateId?: string | null;
  }) {
    return prisma.report.create({
      data: {
        brandId: input.brandId,
        name: input.name,
        rangeLabel: input.rangeLabel,
        metrics: input.metrics,
        charts: input.charts,
        templateId: input.templateId || null,
        payload: input.payload ? asJson(input.payload) : undefined,
      },
    });
  }

  async saveTemplate(input: {
    brandId: string;
    name: string;
    description?: string;
    metrics: string[];
    charts: string[];
  }) {
    return prisma.reportTemplate.create({
      data: {
        brandId: input.brandId,
        name: input.name,
        description: input.description,
        metrics: input.metrics,
        charts: input.charts,
      },
    });
  }
}

const defaultRepo = new MockAnalyticsRepository();

export async function getAnalyticsOverview(query: AnalyticsQuery) {
  return defaultRepo.getBundle(query);
}

export async function getAnalyticsReports(brandId: string) {
  return defaultRepo.listReports(brandId);
}

export async function getAnalyticsTemplates(brandId: string) {
  return defaultRepo.listTemplates(brandId);
}

export async function createAnalyticsReport(
  input: Parameters<AnalyticsRepository["saveReport"]>[0],
) {
  return defaultRepo.saveReport(input);
}

export async function createAnalyticsTemplate(
  input: Parameters<AnalyticsRepository["saveTemplate"]>[0],
) {
  return defaultRepo.saveTemplate(input);
}
