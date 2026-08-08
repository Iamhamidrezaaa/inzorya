import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ToolDefinition } from "@/server/agent/types";
import {
  parseOptionalDate,
  resolveMetricQueryScope,
  resolvePerformanceAvailability,
} from "@/server/agent/tools/analytics-availability";
import { resolveScopedBrandId } from "@/server/agent/tools/scope";

const nullableNumber = z.number().nullable();

const inputSchema = z.object({
  brandId: z.string().min(1).optional(),
  channel: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  comparisonBasis: z.string().optional(),
  sampleSize: z.number().optional(),
  lastUpdatedAt: z.string().nullable().optional(),
  limitations: z.array(z.string()).optional(),
  contentTypes: z
    .array(
      z.object({
        type: z.string(),
        count: z.number(),
        smallSample: z.boolean(),
        metrics: z.object({
          reach: nullableNumber,
          impressions: nullableNumber,
          likes: nullableNumber,
          comments: nullableNumber,
          shares: nullableNumber,
          saves: nullableNumber,
          engagement: nullableNumber,
          avgEngagement: nullableNumber,
        }),
      }),
    )
    .optional(),
});

export const analyticsCompareContentTypesTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "analytics.compareContentTypes",
  name: "Compare Content Types",
  description:
    "Compare aggregated real performance metrics across content types. Exposes sample size and small-sample warnings. No predictions.",
  version: "1.1.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);
    const status = await resolvePerformanceAvailability(brandId);
    if (!status.available) {
      return {
        available: false,
        reason: status.reason,
        limitations: status.limitations,
      };
    }

    const from = parseOptionalDate(input.from);
    const to = parseOptionalDate(input.to);
    const scope = await resolveMetricQueryScope(brandId);

    const orFilters: Prisma.ContentMetricWhereInput[] = [];
    if (scope.contentItemIds.length > 0) {
      orFilters.push({ externalId: { in: scope.contentItemIds } });
    }
    if (scope.externalPostIds.length > 0) {
      orFilters.push({ externalPostId: { in: scope.externalPostIds } });
    }
    if (scope.publicationIds.length > 0) {
      orFilters.push({ socialPublicationId: { in: scope.publicationIds } });
    }
    if (orFilters.length === 0) {
      return { available: false, reason: "INSUFFICIENT_PERFORMANCE_DATA" };
    }

    const where: Prisma.ContentMetricWhereInput = {
      brandId,
      NOT: { source: "mock" },
      OR: orFilters,
      ...(input.channel
        ? { platform: { equals: input.channel, mode: "insensitive" } }
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

    const rows = await prisma.contentMetric.findMany({ where });
    if (rows.length < 2) {
      return {
        available: false,
        reason: "INSUFFICIENT_PERFORMANCE_DATA",
        sampleSize: rows.length,
        limitations: ["Need at least 2 metric rows to compare types"],
      };
    }

    const byType = new Map<
      string,
      {
        count: number;
        reach: number;
        reachN: number;
        impressions: number;
        impressionsN: number;
        likes: number;
        likesN: number;
        comments: number;
        commentsN: number;
        shares: number;
        sharesN: number;
        saves: number;
        savesN: number;
        engagement: number;
        engagementN: number;
      }
    >();

    for (const r of rows) {
      const key = r.contentType || "UNKNOWN";
      const cur = byType.get(key) ?? {
        count: 0,
        reach: 0,
        reachN: 0,
        impressions: 0,
        impressionsN: 0,
        likes: 0,
        likesN: 0,
        comments: 0,
        commentsN: 0,
        shares: 0,
        sharesN: 0,
        saves: 0,
        savesN: 0,
        engagement: 0,
        engagementN: 0,
      };
      cur.count += 1;
      if (r.reach != null) {
        cur.reach += r.reach;
        cur.reachN += 1;
      }
      if (r.impressions != null) {
        cur.impressions += r.impressions;
        cur.impressionsN += 1;
      }
      if (r.likes != null) {
        cur.likes += r.likes;
        cur.likesN += 1;
      }
      if (r.comments != null) {
        cur.comments += r.comments;
        cur.commentsN += 1;
      }
      if (r.shares != null) {
        cur.shares += r.shares;
        cur.sharesN += 1;
      }
      if (r.saves != null) {
        cur.saves += r.saves;
        cur.savesN += 1;
      }
      if (r.engagement != null) {
        cur.engagement += r.engagement;
        cur.engagementN += 1;
      }
      byType.set(key, cur);
    }

    return {
      available: true,
      comparisonBasis: "sum_and_avg_of_stored_content_metrics",
      sampleSize: rows.length,
      lastUpdatedAt: status.lastUpdatedAt ?? null,
      limitations: [
        ...(status.limitations ?? []),
        ...(rows.length < 5 ? ["SMALL_SAMPLE"] : []),
        "Comparison describes observed totals only — no causal claims",
      ],
      contentTypes: Array.from(byType.entries()).map(([type, m]) => ({
        type,
        count: m.count,
        smallSample: m.count < 5,
        metrics: {
          reach: m.reachN ? m.reach : null,
          impressions: m.impressionsN ? m.impressions : null,
          likes: m.likesN ? m.likes : null,
          comments: m.commentsN ? m.comments : null,
          shares: m.sharesN ? m.shares : null,
          saves: m.savesN ? m.saves : null,
          engagement: m.engagementN ? m.engagement : null,
          avgEngagement: m.engagementN ? m.engagement / m.count : null,
        },
      })),
    };
  },
};
