import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ToolDefinition } from "@/server/agent/types";
import {
  parseOptionalDate,
  resolveMetricQueryScope,
  resolvePerformanceAvailability,
  sumNullable,
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
  limit: z.number().int().positive().optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  source: z.string().optional(),
  lastUpdatedAt: z.string().nullable().optional(),
  dataAgeMs: z.number().nullable().optional(),
  sampleSize: z.number().optional(),
  limitations: z.array(z.string()).optional(),
  channel: z.string().nullable(),
  period: z
    .object({
      from: z.string().nullable(),
      to: z.string().nullable(),
    })
    .optional(),
  metrics: z
    .object({
      contentCount: z.number(),
      reach: nullableNumber,
      impressions: nullableNumber,
      likes: nullableNumber,
      comments: nullableNumber,
      shares: nullableNumber,
      saves: nullableNumber,
      engagement: nullableNumber,
    })
    .optional(),
  content: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        channel: z.string(),
        contentType: z.string(),
        publishedAt: z.string().nullable(),
        metrics: z.object({
          reach: nullableNumber,
          impressions: nullableNumber,
          likes: nullableNumber,
          comments: nullableNumber,
          shares: nullableNumber,
          saves: nullableNumber,
          engagement: nullableNumber,
          ctr: nullableNumber,
        }),
      }),
    )
    .optional(),
});

export const analyticsGetPerformanceTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "analytics.getPerformance",
  name: "Analytics Performance",
  description:
    "Read real stored performance metrics for the brand when a non-mock analytics source exists. Missing metrics stay null — never invent zeros.",
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
        channel: input.channel ?? null,
        limitations: status.limitations,
      };
    }

    const limit = clampLimit(input.limit, 20, 50);
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
      return {
        available: false,
        reason: "NO_PERFORMANCE_METRICS_IN_RANGE",
        channel: input.channel ?? null,
        period: { from: input.from ?? null, to: input.to ?? null },
        limitations: ["No content or publications to attribute"],
      };
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

    const rows = await prisma.contentMetric.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit,
    });

    if (rows.length === 0) {
      return {
        available: false,
        reason: "NO_PERFORMANCE_METRICS_IN_RANGE",
        channel: input.channel ?? null,
        period: {
          from: input.from ?? null,
          to: input.to ?? null,
        },
        limitations: status.limitations,
      };
    }

    const lastUpdated =
      status.lastUpdatedAt ??
      rows
        .map((r) => r.collectedAt ?? r.updatedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0]
        ?.toISOString() ??
      null;

    return {
      available: true,
      source: status.source,
      lastUpdatedAt: lastUpdated,
      dataAgeMs: lastUpdated
        ? Date.now() - new Date(lastUpdated).getTime()
        : null,
      sampleSize: rows.length,
      limitations: [
        ...(status.limitations ?? []),
        ...(rows.length < 5 ? ["SMALL_SAMPLE"] : []),
      ],
      channel: input.channel ?? null,
      period: {
        from: input.from ?? null,
        to: input.to ?? null,
      },
      metrics: {
        contentCount: rows.length,
        reach: sumNullable(rows.map((r) => r.reach)),
        impressions: sumNullable(rows.map((r) => r.impressions)),
        likes: sumNullable(rows.map((r) => r.likes)),
        comments: sumNullable(rows.map((r) => r.comments)),
        shares: sumNullable(rows.map((r) => r.shares)),
        saves: sumNullable(rows.map((r) => r.saves)),
        engagement: sumNullable(rows.map((r) => r.engagement)),
      },
      content: rows.map((r) => ({
        id: r.externalPostId ?? r.externalId,
        title: r.title,
        channel: r.platform,
        contentType: r.contentType,
        publishedAt: r.publishedAt.toISOString(),
        metrics: {
          reach: r.reach,
          impressions: r.impressions,
          likes: r.likes,
          comments: r.comments,
          shares: r.shares,
          saves: r.saves,
          engagement: r.engagement,
          ctr: r.ctr,
        },
      })),
    };
  },
};
