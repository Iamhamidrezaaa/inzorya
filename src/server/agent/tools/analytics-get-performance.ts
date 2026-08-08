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
  limit: z.number().int().positive().optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  source: z.string().optional(),
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
      reach: z.number(),
      impressions: z.number(),
      likes: z.number(),
      comments: z.number(),
      shares: z.number(),
      saves: z.number(),
      engagement: z.number(),
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
          reach: z.number(),
          impressions: z.number(),
          likes: z.number(),
          comments: z.number(),
          shares: z.number(),
          saves: z.number(),
          engagement: z.number(),
          ctr: z.number(),
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
    "Read real stored performance metrics for the brand when a non-mock analytics source exists.",
  version: "1.0.0",
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
      };
    }

    const limit = clampLimit(input.limit, 20, 50);
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

    const metrics = rows.reduce(
      (acc, r) => {
        acc.contentCount += 1;
        acc.reach += r.reach;
        acc.impressions += r.impressions;
        acc.likes += r.likes;
        acc.comments += r.comments;
        acc.shares += r.shares;
        acc.saves += r.saves;
        acc.engagement += r.engagement;
        return acc;
      },
      {
        contentCount: 0,
        reach: 0,
        impressions: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        engagement: 0,
      },
    );

    if (rows.length === 0) {
      return {
        available: false,
        reason: "NO_PERFORMANCE_METRICS_IN_RANGE",
        channel: input.channel ?? null,
        period: {
          from: input.from ?? null,
          to: input.to ?? null,
        },
      };
    }

    return {
      available: true,
      source: status.source,
      channel: input.channel ?? null,
      period: {
        from: input.from ?? null,
        to: input.to ?? null,
      },
      metrics,
      content: rows.map((r) => ({
        id: r.externalId,
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
