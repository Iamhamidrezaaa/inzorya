import { z } from "zod";
import { searchCalendarEvents } from "@/server/services/calendar";
import type { ToolDefinition } from "@/server/agent/types";
import { clampLimit } from "@/server/agent/tools/scope";

const inputSchema = z.object({
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
});

const eventSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  title: z.string().nullable().optional(),
  date: z.string().nullable(),
  category: z.string().nullable(),
  geography: z.object({
    countries: z.array(z.string()),
    region: z.string().nullable(),
  }),
  industries: z.array(z.string()),
  tags: z.array(z.string()),
  preparationDays: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
  verificationStatus: z.string().nullable().optional(),
  importance: z.string().nullable().optional(),
});

const outputSchema = z.object({
  total: z.number(),
  limit: z.number(),
  events: z.array(eventSchema),
});

export type CalendarGetEventsOutput = z.infer<typeof outputSchema>;

export const calendarGetEventsTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  CalendarGetEventsOutput
> = {
  id: "calendar.getEvents",
  name: "Calendar Events",
  description:
    "Read marketing calendar events via existing Calendar Intelligence (searchCalendarEvents).",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input) {
    const limit = clampLimit(input.limit, 40, 100);

    // Fetch a wider page when region post-filter may drop rows.
    const fetchLimit = input.region ? Math.min(limit * 3, 200) : limit;

    const result = await searchCalendarEvents({
      category: input.category,
      country: input.country,
      industry: input.industry,
      tags: input.tags,
      startDate: input.from,
      endDate: input.to,
      timeFilter: input.from || input.to ? undefined : "upcoming",
      limit: fetchLimit,
    });

    let events = result.events;
    if (input.region) {
      const regionKey = input.region.toLowerCase();
      events = events.filter((e) => {
        const key = (e.region as { key?: string } | null)?.key?.toLowerCase();
        return key === regionKey;
      });
    }
    events = events.slice(0, limit);

    return {
      total: input.region ? events.length : result.total,
      limit,
      events: events.map((e) => ({
        id: e.id,
        key: e.key,
        name: e.name,
        title: e.title ?? null,
        date: e.nextDate ?? null,
        category:
          (e.marketingCategory as { key?: string } | null)?.key ??
          (e.category as { key?: string } | null)?.key ??
          null,
        geography: {
          countries: e.countries ?? [],
          region: (e.region as { key?: string } | null)?.key ?? null,
        },
        industries: e.industries ?? [],
        tags: e.tags ?? [],
        preparationDays: e.preparationDays ?? null,
        source:
          (e.sourceRef as { key?: string } | null)?.key ??
          (typeof e.source === "string" ? e.source : null),
        verificationStatus: e.verificationStatus ?? null,
        importance: e.importance ?? null,
      })),
    };
  },
};
