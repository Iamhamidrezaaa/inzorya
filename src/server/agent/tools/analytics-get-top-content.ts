import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ToolDefinition } from "@/server/agent/types";
import {
  parseOptionalDate,
  resolvePerformanceAvailability,
} from "@/server/agent/tools/analytics-availability";
import {
  clampLimit,
  resolveScopedBrandId,
} from "@/server/agent/tools/scope";

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
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        contentType: z.string(),
        channel: z.string(),
        publishedAt: z.string().nullable(),
        metrics: z.object({
          engagement: z.number(),
          reach: z.number(),
          impressions: z.number(),
          likes: z.number(),
          comments: z.number(),
          shares: z.number(),
          saves: z.number(),
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
    "Rank existing content by real stored engagement metrics. Does not invent ranking.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);
    const status = await resolvePerformanceAvailability(brandId);
    if (!status.available) {
      return { available: false, reason: status.reason };
    }

    const limit = clampLimit(input.limit, 10, 30);
    const from = parseOptionalDate(input.from);
    const to = parseOptionalDate(input.to);

    const contentIds = (
      await prisma.contentItem.findMany({
        where: { brandId, deletedAt: null },
        select: { id: true },
        take: 500,
      })
    ).map((c) => c.id);

    const where: Prisma.ContentMetricWhereInput = {
      brandId,
      externalId: { in: contentIds },
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
      items: rows.map((r) => ({
        id: r.externalId,
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
