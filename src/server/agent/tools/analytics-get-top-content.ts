import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ToolDefinition } from "@/server/agent/types";
import {
  parseOptionalDate,
  resolveMetricQueryScope,
  resolvePerformanceAvailability,
} from "@/server/agent/tools/analytics-availability";
import {
  clampLimit,
  resolveScopedBrandId,
} from "@/server/agent/tools/scope";

const nullableNumber = z.number().nullable();

const inputSchema = z.object({
  brandId: z.string().min(1).optional(),
  channel: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  rankingBasis: z.string().optional(),
  rankingMetric: z.string().optional(),
  sampleSize: z.number().optional(),
  period: z
    .object({
      from: z.string().nullable(),
      to: z.string().nullable(),
    })
    .optional(),
  platform: z.string().nullable().optional(),
  lastUpdatedAt: z.string().nullable().optional(),
  limitations: z.array(z.string()).optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        contentType: z.string(),
        channel: z.string(),
        publishedAt: z.string().nullable(),
        metrics: z.object({
          engagement: nullableNumber,
          reach: nullableNumber,
          impressions: nullableNumber,
          likes: nullableNumber,
          comments: nullableNumber,
          shares: nullableNumber,
          saves: nullableNumber,
        }),
      }),
    )
    .optional(),
});

export const analyticsGetTopContentTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "analytics.getTopContent",
  name: "Top Content",
  description:
    "Rank existing content by real stored engagement metrics. Explains ranking metric, sample size, and period. Does not invent ranking.",
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

    const limit = clampLimit(input.limit, 10, 30);
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
      return { available: false, reason: "NO_PERFORMANCE_METRICS" };
    }

    const where: Prisma.ContentMetricWhereInput = {
      brandId,
      NOT: { source: "mock" },
      OR: orFilters,
      ...(input.channel
        ? { platform: { equals: input.channel, mode: "insensitive" } }
        : {}),
      ...(input.contentType
        ? { contentType: { equals: input.contentType, mode: "insensitive" } }
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

    const rows = await prisma.contentMetric.findMany({
      where,
      orderBy: [{ engagement: "desc" }, { reach: "desc" }],
      take: limit,
    });

    if (rows.length === 0) {
      return {
        available: false,
        reason: "NO_PERFORMANCE_METRICS",
      };
    }

    return {
      available: true,
      rankingBasis: "engagement_then_reach",
      rankingMetric: "engagement",
      sampleSize: rows.length,
      period: { from: input.from ?? null, to: input.to ?? null },
      platform: input.channel ?? null,
      lastUpdatedAt: status.lastUpdatedAt ?? null,
      limitations: [
        ...(status.limitations ?? []),
        ...(rows.length < 5 ? ["SMALL_SAMPLE"] : []),
        "Ranking is Top by engagement (then reach) — not 'best content'",
      ],
      items: rows.map((r) => ({
        id: r.externalPostId ?? r.externalId,
        title: r.title,
        contentType: r.contentType,
        channel: r.platform,
        publishedAt: r.publishedAt.toISOString(),
        metrics: {
          engagement: r.engagement,
          reach: r.reach,
          impressions: r.impressions,
          likes: r.likes,
          comments: r.comments,
          shares: r.shares,
          saves: r.saves,
        },
      })),
    };
  },
};
