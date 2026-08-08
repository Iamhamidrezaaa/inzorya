import { z } from "zod";
import type { ContentFormat, ContentPlatform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ToolDefinition } from "@/server/agent/types";
import {
  clampLimit,
  resolveScopedBrandId,
} from "@/server/agent/tools/scope";

const inputSchema = z.object({
  brandId: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
  contentType: z.string().min(1).optional(),
  channel: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});

const contentItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  contentType: z.string(),
  channel: z.string(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  caption: z.string().nullable(),
  campaign: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  pillar: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
});

const outputSchema = z.object({
  items: z.array(contentItemSchema),
  total: z.number(),
  limit: z.number(),
});

export type ContentGetHistoryOutput = z.infer<typeof outputSchema>;

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const contentGetHistoryTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  ContentGetHistoryOutput
> = {
  id: "content.getHistory",
  name: "Content History",
  description:
    "Read existing ContentItem history for the brand (studio content). No fabricated analytics.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);
    const limit = clampLimit(input.limit, 20, 50);

    const from = parseDate(input.from);
    const to = parseDate(input.to);

    const dateFilter: Prisma.ContentItemWhereInput[] = [];
    if (from || to) {
      const range: Prisma.DateTimeFilter = {};
      if (from) range.gte = from;
      if (to) range.lte = to;
      dateFilter.push({
        OR: [
          { publishedAt: range },
          { scheduledAt: range },
          { createdAt: range },
        ],
      });
    }

    const where: Prisma.ContentItemWhereInput = {
      brandId,
      deletedAt: null,
      status: { not: "ARCHIVED" },
      ...(input.channel
        ? { platform: input.channel.toUpperCase() as ContentPlatform }
        : {}),
      ...(input.contentType
        ? { format: input.contentType.toUpperCase() as ContentFormat }
        : {}),
      ...(dateFilter.length ? { AND: dateFilter } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.contentItem.count({ where }),
      prisma.contentItem.findMany({
        where,
        select: {
          id: true,
          title: true,
          body: true,
          status: true,
          platform: true,
          format: true,
          scheduledAt: true,
          publishedAt: true,
          campaign: { select: { id: true, name: true } },
          pillar: { select: { id: true, name: true } },
        },
        orderBy: [
          { publishedAt: "desc" },
          { scheduledAt: "desc" },
          { updatedAt: "desc" },
        ],
        take: limit,
      }),
    ]);

    return {
      total,
      limit,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        contentType: row.format,
        channel: row.platform,
        status: row.status,
        scheduledAt: row.scheduledAt?.toISOString() ?? null,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        caption: row.body ? row.body.slice(0, 500) : null,
        campaign: row.campaign,
        pillar: row.pillar,
      })),
    };
  },
};
