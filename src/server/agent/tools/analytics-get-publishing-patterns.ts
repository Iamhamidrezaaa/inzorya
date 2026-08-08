import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ToolDefinition } from "@/server/agent/types";
import { parseOptionalDate } from "@/server/agent/tools/analytics-availability";
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
  patternKind: z.literal("publishing_history").optional(),
  note: z.string().optional(),
  period: z
    .object({
      from: z.string().nullable(),
      to: z.string().nullable(),
    })
    .optional(),
  totals: z
    .object({
      items: z.number(),
      withPublishTimestamp: z.number(),
    })
    .optional(),
  byDayOfWeek: z
    .array(z.object({ day: z.number(), label: z.string(), count: z.number() }))
    .optional(),
  byHourUtc: z
    .array(z.object({ hour: z.number(), count: z.number() }))
    .optional(),
  byChannel: z
    .array(z.object({ channel: z.string(), count: z.number() }))
    .optional(),
  byContentType: z
    .array(z.object({ contentType: z.string(), count: z.number() }))
    .optional(),
  frequency: z
    .object({
      daysSpanned: z.number().nullable(),
      averagePerWeek: z.number().nullable(),
    })
    .optional(),
});

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const analyticsGetPublishingPatternsTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "analytics.getPublishingPatterns",
  name: "Publishing Patterns",
  description:
    "Observable publishing history from ContentItem timestamps. Does not claim best times to post.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);
    const from = parseOptionalDate(input.from);
    const to = parseOptionalDate(input.to);

    const dateOr: Prisma.ContentItemWhereInput[] = [];
    if (from || to) {
      const range: Prisma.DateTimeFilter = {};
      if (from) range.gte = from;
      if (to) range.lte = to;
      dateOr.push(
        { publishedAt: range },
        { scheduledAt: range },
      );
    }

    const where: Prisma.ContentItemWhereInput = {
      brandId,
      deletedAt: null,
      status: { not: "ARCHIVED" },
      ...(input.channel
        ? { platform: input.channel.toUpperCase() as never }
        : {}),
      ...(dateOr.length ? { OR: dateOr } : {}),
    };

    const rows = await prisma.contentItem.findMany({
      where,
      select: {
        platform: true,
        format: true,
        publishedAt: true,
        scheduledAt: true,
      },
      take: 500,
      orderBy: { updatedAt: "desc" },
    });

    if (rows.length === 0) {
      return {
        available: false,
        reason: "NO_PUBLISHING_HISTORY",
        period: { from: input.from ?? null, to: input.to ?? null },
      };
    }

    const dayCounts = new Array(7).fill(0) as number[];
    const hourCounts = new Array(24).fill(0) as number[];
    const channelCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    let withTs = 0;
    let minTs: number | null = null;
    let maxTs: number | null = null;

    for (const row of rows) {
      channelCounts.set(
        row.platform,
        (channelCounts.get(row.platform) ?? 0) + 1,
      );
      typeCounts.set(row.format, (typeCounts.get(row.format) ?? 0) + 1);

      const ts = row.publishedAt ?? row.scheduledAt;
      if (!ts) continue;
      withTs += 1;
      const t = ts.getTime();
      minTs = minTs == null ? t : Math.min(minTs, t);
      maxTs = maxTs == null ? t : Math.max(maxTs, t);
      dayCounts[ts.getUTCDay()]! += 1;
      hourCounts[ts.getUTCHours()]! += 1;
    }

    let averagePerWeek: number | null = null;
    let daysSpanned: number | null = null;
    if (minTs != null && maxTs != null) {
      daysSpanned = Math.max(1, Math.ceil((maxTs - minTs) / 86_400_000) + 1);
      averagePerWeek = (withTs / daysSpanned) * 7;
    }

    return {
      available: true,
      patternKind: "publishing_history",
      note: "Counts reflect historical publish/schedule timestamps only. Not performance recommendations.",
      period: { from: input.from ?? null, to: input.to ?? null },
      totals: { items: rows.length, withPublishTimestamp: withTs },
      byDayOfWeek: dayCounts.map((count, day) => ({
        day,
        label: DAY_LABELS[day]!,
        count,
      })),
      byHourUtc: hourCounts.map((count, hour) => ({ hour, count })),
      byChannel: Array.from(channelCounts.entries()).map(
        ([channel, count]) => ({ channel, count }),
      ),
      byContentType: Array.from(typeCounts.entries()).map(
        ([contentType, count]) => ({ contentType, count }),
      ),
      frequency: { daysSpanned, averagePerWeek },
    };
  },
};
