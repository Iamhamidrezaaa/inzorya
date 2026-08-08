import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ToolDefinition } from "@/server/agent/types";
import {
  parseOptionalDate,
  resolvePerformanceAvailability,
} from "@/server/agent/tools/analytics-availability";
import { resolveScopedBrandId } from "@/server/agent/tools/scope";

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
  contentTypes: z
    .array(
      z.object({
        type: z.string(),
        count: z.number(),
        metrics: z.object({
          reach: z.number(),
          impressions: z.number(),
          likes: z.number(),
          comments: z.number(),
          shares: z.number(),
          saves: z.number(),
          engagement: z.number(),
          avgEngagement: z.number(),
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
    "Compare aggregated real performance metrics across content types. No statistical conclusions beyond counts/sums.",
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

    const rows = await prisma.contentMetric.findMany({ where });
    if (rows.length < 2) {
      return {
        available: false,
        reason: "INSUFFICIENT_PERFORMANCE_DATA",
      };
    }

    const byType = new Map<
      string,
      {
        count: number;
        reach: number;
        impressions: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        engagement: number;
      }
    >();

    for (const r of rows) {
      const key = r.contentType || "UNKNOWN";
      const cur = byType.get(key) ?? {
        count: 0,
        reach: 0,
        impressions: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        engagement: 0,
      };
      cur.count += 1;
      cur.reach += r.reach;
      cur.impressions += r.impressions;
      cur.likes += r.likes;
      cur.comments += r.comments;
      cur.shares += r.shares;
      cur.saves += r.saves;
      cur.engagement += r.engagement;
      byType.set(key, cur);
    }

    if (byType.size < 1) {
      return {
        available: false,
        reason: "INSUFFICIENT_PERFORMANCE_DATA",
      };
    }

    return {
      available: true,
      comparisonBasis: "sum_and_avg_of_stored_content_metrics",
      contentTypes: Array.from(byType.entries()).map(([type, m]) => ({
        type,
        count: m.count,
        metrics: {
          reach: m.reach,
          impressions: m.impressions,
          likes: m.likes,
          comments: m.comments,
          shares: m.shares,
          saves: m.saves,
          engagement: m.engagement,
          avgEngagement: m.count ? m.engagement / m.count : 0,
        },
      })),
    };
  },
};
