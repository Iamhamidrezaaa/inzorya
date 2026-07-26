import type {
  CalendarEventStatus,
  EventImportance,
  EventRecurrence,
  EventVerificationStatus,
  MarketingEventSource,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  CALENDAR_CATEGORIES,
  CALENDAR_SOURCES,
  SEED_COUNTRIES,
  SEED_REGIONS,
  SEED_SEASONS,
  SOURCE_TO_CATEGORY,
  buildSearchText,
  nextOccurrenceDate,
  quarterForMonth,
  seasonForMonth,
  slugifyKey,
  utcToday,
  type CalendarSearchInput,
} from "@/lib/calendar";
import { SEED_EVENTS } from "@/lib/opportunities";

export const eventInclude = {
  marketingCategory: true,
  subcategory: true,
  sourceRef: true,
  region: true,
  countryLinks: { include: { country: true } },
  tagLinks: { include: { tag: true } },
  secondarySources: { include: { source: true } },
  translations: true,
  localizations: true,
  seasons: { include: { season: true } },
  verifications: { orderBy: { verifiedAt: "desc" as const }, take: 5 },
  history: { orderBy: { createdAt: "desc" as const }, take: 20 },
  versions: { orderBy: { version: "desc" as const }, take: 10 },
  category: true,
} as const;

function parseRecurrence(raw: unknown): EventRecurrence {
  const key = String(raw || "ANNUAL").toUpperCase();
  if (["ONE_TIME", "ANNUAL", "MONTHLY", "WEEKLY", "CUSTOM"].includes(key)) {
    return key as EventRecurrence;
  }
  return "ANNUAL";
}

function parseImportance(raw: unknown): EventImportance {
  const key = String(raw || "MEDIUM").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(key)) {
    return key as EventImportance;
  }
  return "MEDIUM";
}

function parseStatus(raw: unknown): CalendarEventStatus {
  const key = String(raw || "ACTIVE").toUpperCase();
  if (["DRAFT", "ACTIVE", "ARCHIVED"].includes(key)) {
    return key as CalendarEventStatus;
  }
  return "ACTIVE";
}

function parseVerification(raw: unknown): EventVerificationStatus {
  const key = String(raw || "DRAFT").toUpperCase();
  if (
    ["OFFICIAL", "VERIFIED", "COMMUNITY_VERIFIED", "DRAFT", "ARCHIVED"].includes(
      key,
    )
  ) {
    return key as EventVerificationStatus;
  }
  return "DRAFT";
}

export async function recordEventHistory(input: {
  eventId: string;
  action: string;
  message: string;
  actorId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await prisma.marketingEventHistory.create({
    data: {
      eventId: input.eventId,
      action: input.action,
      message: input.message,
      actorId: input.actorId || null,
      meta: input.meta as Prisma.InputJsonValue | undefined,
    },
  });
}

async function snapshotEventVersion(eventId: string, note?: string) {
  const event = await prisma.marketingEvent.findUnique({
    where: { id: eventId },
    include: {
      translations: true,
      localizations: true,
      tagLinks: { include: { tag: true } },
      countryLinks: { include: { country: true } },
      secondarySources: { include: { source: true } },
    },
  });
  if (!event) return;
  await prisma.marketingEventVersion.upsert({
    where: {
      eventId_version: { eventId, version: event.version },
    },
    create: {
      eventId,
      version: event.version,
      note: note || null,
      snapshot: event as unknown as Prisma.InputJsonValue,
    },
    update: {
      note: note || null,
      snapshot: event as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function ensureCalendarCatalog() {
  for (const r of SEED_REGIONS) {
    await prisma.marketingRegion.upsert({
      where: { key: r.key },
      create: { key: r.key, name: r.name, kind: r.kind },
      update: { name: r.name, kind: r.kind },
    });
  }
  const regions = await prisma.marketingRegion.findMany();
  const regionByKey = Object.fromEntries(regions.map((r) => [r.key, r.id]));

  for (const c of SEED_COUNTRIES) {
    await prisma.marketingCountry.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        regionId: regionByKey[c.regionKey] || null,
      },
      update: {
        name: c.name,
        regionId: regionByKey[c.regionKey] || null,
      },
    });
  }

  for (const s of CALENDAR_SOURCES) {
    await prisma.marketingSource.upsert({
      where: { key: s.key },
      create: { key: s.key, name: s.name },
      update: { name: s.name },
    });
  }

  for (const season of SEED_SEASONS) {
    await prisma.marketingSeason.upsert({
      where: { key: season.key },
      create: {
        key: season.key,
        name: season.name,
        kind: season.kind,
        startMonth: season.startMonth,
        startDay: season.startDay,
        endMonth: season.endMonth,
        endDay: season.endDay,
        hemisphere: season.hemisphere,
      },
      update: {
        name: season.name,
        kind: season.kind,
        startMonth: season.startMonth,
        startDay: season.startDay,
        endMonth: season.endMonth,
        endDay: season.endDay,
        hemisphere: season.hemisphere,
      },
    });
  }

  for (const c of CALENDAR_CATEGORIES) {
    await prisma.marketingCategory.upsert({
      where: { key: c.key },
      create: {
        key: c.key,
        name: c.name,
        sortOrder: c.sortOrder,
      },
      update: { name: c.name, sortOrder: c.sortOrder },
    });
  }

  const categories = await prisma.marketingCategory.findMany();
  const catByKey = Object.fromEntries(categories.map((c) => [c.key, c.id]));
  const sources = await prisma.marketingSource.findMany();
  const sourceByKey = Object.fromEntries(sources.map((s) => [s.key, s.id]));
  const countries = await prisma.marketingCountry.findMany();
  const countryByCode = Object.fromEntries(countries.map((c) => [c.code, c.id]));
  const globalRegionId = regionByKey.global || null;

  // Enrich / sync foundation events from opportunity seed (no AI)
  for (const e of SEED_EVENTS) {
    const marketingCategoryId =
      catByKey[SOURCE_TO_CATEGORY[e.source] || "custom_events"] || null;
    const sourceId =
      sourceByKey[
        e.source === "INTERNATIONAL_DAY"
          ? "international_day"
          : e.source === "COUNTRY_HOLIDAY"
            ? "national_holiday"
            : e.source === "FOOD_CALENDAR"
              ? "food"
              : e.source === "RETAIL_CALENDAR" || e.source === "SHOPPING"
                ? "retail"
                : e.source === "TECHNOLOGY"
                  ? "technology"
                  : e.source === "SPORTS"
                    ? "sports"
                    : e.source === "ENTERTAINMENT"
                      ? "entertainment"
                      : e.source === "RELIGIOUS"
                        ? "religious"
                        : e.source === "SEASONAL" || e.source === "WEATHER_SEASON"
                          ? "seasonal"
                          : e.source === "INDUSTRY_CONFERENCE"
                            ? "industry"
                            : e.source === "LOCAL"
                              ? "local"
                              : "custom"
      ] || null;

    const event = await prisma.marketingEvent.upsert({
      where: { key: e.key },
      create: {
        key: e.key,
        name: e.name,
        title: e.name,
        description: e.description,
        source: e.source as MarketingEventSource,
        sourceId,
        marketingCategoryId,
        month: e.month,
        day: e.day,
        quarter: quarterForMonth(e.month),
        recurrence: "ANNUAL",
        importance: "MEDIUM",
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        active: true,
        language: "en",
        timezone: "UTC",
        regionId: globalRegionId,
        countries: e.countries || [],
        industries: e.industries || [],
        tags: e.tags || [],
        audienceHints: e.audienceHints || [],
        searchText: buildSearchText([
          e.name,
          e.description,
          e.tags,
          e.industries,
          e.countries,
        ]),
        importedAt: new Date(),
      },
      update: {
        name: e.name,
        title: e.name,
        description: e.description,
        sourceId,
        marketingCategoryId,
        month: e.month,
        day: e.day,
        quarter: quarterForMonth(e.month),
        recurrence: "ANNUAL",
        active: true,
        status: "ACTIVE",
        countries: e.countries || [],
        industries: e.industries || [],
        tags: e.tags || [],
        audienceHints: e.audienceHints || [],
        searchText: buildSearchText([
          e.name,
          e.description,
          e.tags,
          e.industries,
          e.countries,
        ]),
      },
    });

    for (const tagName of e.tags || []) {
      const tagKey = slugifyKey(tagName);
      if (!tagKey) continue;
      const tag = await prisma.marketingTag.upsert({
        where: { key: tagKey },
        create: { key: tagKey, name: tagName },
        update: { name: tagName },
      });
      await prisma.marketingEventTag.upsert({
        where: {
          eventId_tagId: { eventId: event.id, tagId: tag.id },
        },
        create: { eventId: event.id, tagId: tag.id },
        update: {},
      });
    }

    const countryCodes = e.countries?.length ? e.countries : ["GLOBAL"];
    for (const code of countryCodes) {
      const countryId = countryByCode[code.toUpperCase()];
      if (!countryId) continue;
      await prisma.marketingEventCountry.upsert({
        where: {
          eventId_countryId: { eventId: event.id, countryId },
        },
        create: { eventId: event.id, countryId },
        update: {},
      });
    }

    await prisma.marketingTranslation.upsert({
      where: {
        eventId_language: { eventId: event.id, language: "en" },
      },
      create: {
        eventId: event.id,
        language: "en",
        title: e.name,
        description: e.description,
        slug: e.key,
        keywords: e.tags || [],
      },
      update: {
        title: e.name,
        description: e.description,
        slug: e.key,
        keywords: e.tags || [],
      },
    });

    await prisma.marketingLocalization.upsert({
      where: {
        eventId_language: { eventId: event.id, language: "en" },
      },
      create: {
        eventId: event.id,
        language: "en",
        title: e.name,
        description: e.description,
        slug: e.key,
        keywords: e.tags || [],
        seoTitle: e.name,
        seoKeywords: e.tags || [],
      },
      update: {
        title: e.name,
        description: e.description,
        slug: e.key,
        keywords: e.tags || [],
        seoTitle: e.name,
        seoKeywords: e.tags || [],
      },
    });
  }

  return {
    categories: categories.length,
    countries: countries.length,
    sources: sources.length,
  };
}

function timeWindow(filter?: string) {
  const today = utcToday();
  const end = new Date(today);
  if (filter === "today") {
    return { start: today, end: today };
  }
  if (filter === "this_week") {
    end.setUTCDate(end.getUTCDate() + 7);
    return { start: today, end };
  }
  if (filter === "this_month") {
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start: today, end };
  }
  if (filter === "this_quarter") {
    end.setUTCMonth(end.getUTCMonth() + 3);
    return { start: today, end };
  }
  if (filter === "past") {
    return { start: null as Date | null, end: today, past: true };
  }
  // upcoming default — next 180 days
  end.setUTCDate(end.getUTCDate() + 180);
  return { start: today, end };
}

export async function searchCalendarEvents(input: CalendarSearchInput) {
  await ensureCalendarCatalog();
  const limit = Math.min(input.limit || 50, 200);
  const offset = input.offset || 0;
  const window = timeWindow(input.timeFilter || "upcoming");

  const where: Prisma.MarketingEventWhereInput = {};
  if (input.status) {
    where.status = input.status as CalendarEventStatus;
  } else if (!input.timeFilter || input.timeFilter !== "past") {
    // default active catalog unless explicitly filtered
    where.status = { in: ["ACTIVE", "DRAFT"] };
  }
  const and: Prisma.MarketingEventWhereInput[] = [];

  if (input.q) {
    const q = input.q.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { searchText: { contains: q.toLowerCase() } },
        { tags: { has: q.toLowerCase() } },
        {
          translations: {
            some: {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { keywords: { has: q.toLowerCase() } },
                { slug: { contains: q.toLowerCase() } },
              ],
            },
          },
        },
        {
          localizations: {
            some: {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { keywords: { has: q.toLowerCase() } },
                { slug: { contains: q.toLowerCase() } },
              ],
            },
          },
        },
      ],
    });
  }

  if (input.category) {
    where.marketingCategory = { key: input.category };
  }
  if (input.country) {
    const code = input.country.toUpperCase();
    and.push({
      OR: [
        { countries: { has: code } },
        { countryLinks: { some: { country: { code } } } },
      ],
    });
  }
  if (input.industry) {
    where.industries = { has: input.industry.toLowerCase() };
  }
  if (input.month) {
    where.month = input.month;
  }
  if (input.quarter) {
    where.quarter = input.quarter;
  }
  if (input.season) {
    const months =
      input.season === "spring"
        ? [3, 4, 5]
        : input.season === "summer"
          ? [6, 7, 8]
          : input.season === "autumn"
            ? [9, 10, 11]
            : [12, 1, 2];
    where.month = { in: months };
  }
  if (input.seasonKey) {
    and.push({
      seasons: { some: { season: { key: input.seasonKey } } },
    });
  }
  if (input.tags?.length) {
    where.tags = { hasSome: input.tags };
  }
  if (input.importance) {
    where.importance = parseImportance(input.importance);
  }
  if (input.verificationStatus) {
    where.verificationStatus = parseVerification(input.verificationStatus);
  }
  if (input.language) {
    and.push({
      OR: [
        { language: input.language },
        { localizations: { some: { language: input.language } } },
      ],
    });
  }
  if (input.startDate || input.endDate) {
    // date-range filter applied after nextOccurrence scoring
  }
  if (and.length) where.AND = and;

  const rows = await prisma.marketingEvent.findMany({
    where,
    include: eventInclude,
    orderBy: [{ month: "asc" }, { day: "asc" }, { name: "asc" }],
    take: 500,
  });

  const rangeStart = input.startDate ? utcToday(new Date(input.startDate)) : null;
  const rangeEnd = input.endDate ? utcToday(new Date(input.endDate)) : null;

  const scored = rows
    .map((e) => {
      const next = nextOccurrenceDate({
        recurrence: e.recurrence,
        month: e.month,
        day: e.day,
        startDate: e.startDate,
      });
      return { event: e, nextDate: next };
    })
    .filter(({ nextDate }) => {
      if (rangeStart && nextDate < rangeStart) return false;
      if (rangeEnd && nextDate > rangeEnd) return false;
      if (window.past) return nextDate < (window.end as Date);
      if (window.start && nextDate < window.start) return false;
      if (window.end && nextDate > window.end) return false;
      return true;
    })
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

  const slice = scored.slice(offset, offset + limit);

  return {
    total: scored.length,
    offset,
    limit,
    events: slice.map(({ event, nextDate }) => ({
      ...event,
      nextDate: nextDate.toISOString().slice(0, 10),
      season: event.month ? seasonForMonth(event.month) : null,
    })),
  };
}

export async function getUpcomingEvents(input?: {
  days?: number;
  country?: string;
  category?: string;
  limit?: number;
}) {
  return searchCalendarEvents({
    timeFilter: "upcoming",
    country: input?.country,
    category: input?.category,
    limit: input?.limit || 40,
  });
}

export async function getCalendarEventDetail(idOrKey: string) {
  await ensureCalendarCatalog();
  return prisma.marketingEvent.findFirst({
    where: {
      OR: [{ id: idOrKey }, { key: idOrKey }],
    },
    include: eventInclude,
  });
}

export async function listCalendarMeta() {
  await ensureCalendarCatalog();
  const [categories, countries, regions, sources, tags, seasons, counts] =
    await Promise.all([
      prisma.marketingCategory.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.marketingCountry.findMany({ orderBy: { name: "asc" } }),
      prisma.marketingRegion.findMany({ orderBy: { name: "asc" } }),
      prisma.marketingSource.findMany({ orderBy: { name: "asc" } }),
      prisma.marketingTag.findMany({ orderBy: { name: "asc" }, take: 200 }),
      prisma.marketingSeason.findMany({ orderBy: { name: "asc" } }),
      prisma.marketingEvent.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

  return {
    categories,
    countries,
    regions,
    sources,
    tags,
    seasons,
    counts: Object.fromEntries(
      counts.map((c) => [c.status, c._count._all]),
    ),
  };
}

export async function upsertCalendarEvent(input: {
  id?: string;
  key?: string;
  name: string;
  title?: string;
  description?: string;
  source?: MarketingEventSource | string;
  sourceKey?: string;
  secondarySourceKeys?: string[];
  categoryKey?: string;
  subcategoryKey?: string;
  countryCodes?: string[];
  regionKey?: string;
  state?: string;
  province?: string;
  city?: string;
  language?: string;
  timezone?: string;
  month?: number | null;
  day?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  recurrence?: string;
  recurrenceRule?: string | null;
  importance?: string;
  status?: string;
  verificationStatus?: string;
  seasonKeys?: string[];
  industries?: string[];
  tags?: string[];
  audienceHints?: string[];
  actorId?: string;
  translations?: Array<{
    language: string;
    title: string;
    description?: string;
    keywords?: string[];
    slug?: string;
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string[];
  }>;
}) {
  await ensureCalendarCatalog();

  const key = input.key || slugifyKey(input.name);
  if (!key) throw new Error("Invalid event key.");

  const category = input.categoryKey
    ? await prisma.marketingCategory.findUnique({
        where: { key: input.categoryKey },
      })
    : null;
  const subcategory = input.subcategoryKey
    ? await prisma.marketingCategory.findUnique({
        where: { key: input.subcategoryKey },
      })
    : null;
  const sourceRef = input.sourceKey
    ? await prisma.marketingSource.findUnique({
        where: { key: input.sourceKey },
      })
    : null;
  const region = input.regionKey
    ? await prisma.marketingRegion.findUnique({
        where: { key: input.regionKey },
      })
    : null;

  const status = parseStatus(input.status);
  const verificationStatus = parseVerification(input.verificationStatus);
  const month = input.month ?? null;
  const countries = (input.countryCodes || []).map((c) => c.toUpperCase());
  const industries = input.industries || [];
  const tags = input.tags || [];
  const searchText = buildSearchText([
    input.name,
    input.title,
    input.description,
    tags,
    industries,
    countries,
    input.city,
    input.state,
    input.province,
  ]);

  const data = {
    key,
    name: input.name,
    title: input.title || input.name,
    description: input.description || null,
    source: (input.source || "CUSTOM") as MarketingEventSource,
    sourceId: sourceRef?.id || null,
    marketingCategoryId: category?.id || null,
    subcategoryId: subcategory?.id || null,
    regionId: region?.id || null,
    state: input.state || null,
    province: input.province || null,
    city: input.city || null,
    language: input.language || "en",
    timezone: input.timezone || "UTC",
    month,
    day: input.day ?? null,
    quarter: month != null ? quarterForMonth(month) : null,
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
    recurrence: parseRecurrence(input.recurrence),
    recurrenceRule: input.recurrenceRule || null,
    importance: parseImportance(input.importance),
    status,
    verificationStatus,
    active: status === "ACTIVE",
    countries,
    industries,
    tags,
    audienceHints: input.audienceHints || [],
    searchText,
    importedAt: new Date(),
  };

  let event;
  if (input.id) {
    const existing = await prisma.marketingEvent.findUnique({
      where: { id: input.id },
    });
    if (!existing) throw new Error("Event not found.");
    await snapshotEventVersion(existing.id, "pre-update");
    event = await prisma.marketingEvent.update({
      where: { id: input.id },
      data: {
        ...data,
        version: existing.version + 1,
      },
      include: eventInclude,
    });
    await recordEventHistory({
      eventId: event.id,
      action: "modified",
      message: "Event updated",
      actorId: input.actorId,
    });
  } else {
    const existingByKey = await prisma.marketingEvent.findUnique({
      where: { key },
    });
    if (existingByKey) {
      await snapshotEventVersion(existingByKey.id, "pre-update");
      event = await prisma.marketingEvent.update({
        where: { key },
        data: {
          ...data,
          version: existingByKey.version + 1,
        },
        include: eventInclude,
      });
      await recordEventHistory({
        eventId: event.id,
        action: "modified",
        message: "Event upserted by key",
        actorId: input.actorId,
      });
    } else {
      event = await prisma.marketingEvent.create({
        data: { ...data, version: 1 },
        include: eventInclude,
      });
      await recordEventHistory({
        eventId: event.id,
        action: "created",
        message: "Event created",
        actorId: input.actorId,
      });
    }
  }

  // Sync country links
  await prisma.marketingEventCountry.deleteMany({ where: { eventId: event.id } });
  for (const code of countries) {
    const country = await prisma.marketingCountry.findUnique({
      where: { code },
    });
    if (!country) continue;
    await prisma.marketingEventCountry.create({
      data: { eventId: event.id, countryId: country.id },
    });
  }

  // Sync tags
  await prisma.marketingEventTag.deleteMany({ where: { eventId: event.id } });
  for (const tagName of tags) {
    const tagKey = slugifyKey(tagName);
    if (!tagKey) continue;
    const tag = await prisma.marketingTag.upsert({
      where: { key: tagKey },
      create: { key: tagKey, name: tagName },
      update: { name: tagName },
    });
    await prisma.marketingEventTag.create({
      data: { eventId: event.id, tagId: tag.id },
    });
  }

  // Secondary sources
  await prisma.marketingEventSecondarySource.deleteMany({
    where: { eventId: event.id },
  });
  for (const sk of input.secondarySourceKeys || []) {
    const src = await prisma.marketingSource.findUnique({ where: { key: sk } });
    if (!src || src.id === event.sourceId) continue;
    await prisma.marketingEventSecondarySource.create({
      data: { eventId: event.id, sourceId: src.id },
    });
  }

  // Seasons
  await prisma.marketingEventSeason.deleteMany({ where: { eventId: event.id } });
  for (const sk of input.seasonKeys || []) {
    const season = await prisma.marketingSeason.findUnique({ where: { key: sk } });
    if (!season) continue;
    await prisma.marketingEventSeason.create({
      data: { eventId: event.id, seasonId: season.id },
    });
  }

  for (const tr of input.translations || []) {
    const slug = tr.slug || slugifyKey(tr.title);
    await prisma.marketingTranslation.upsert({
      where: {
        eventId_language: { eventId: event.id, language: tr.language },
      },
      create: {
        eventId: event.id,
        language: tr.language,
        title: tr.title,
        description: tr.description || null,
        slug,
        keywords: tr.keywords || [],
        seoTitle: tr.seoTitle || tr.title,
        seoDescription: tr.seoDescription || null,
      },
      update: {
        title: tr.title,
        description: tr.description || null,
        slug,
        keywords: tr.keywords || [],
        seoTitle: tr.seoTitle || tr.title,
        seoDescription: tr.seoDescription || null,
      },
    });
    await prisma.marketingLocalization.upsert({
      where: {
        eventId_language: { eventId: event.id, language: tr.language },
      },
      create: {
        eventId: event.id,
        language: tr.language,
        title: tr.title,
        description: tr.description || null,
        slug,
        keywords: tr.keywords || [],
        seoTitle: tr.seoTitle || tr.title,
        seoDescription: tr.seoDescription || null,
        seoKeywords: tr.seoKeywords || tr.keywords || [],
      },
      update: {
        title: tr.title,
        description: tr.description || null,
        slug,
        keywords: tr.keywords || [],
        seoTitle: tr.seoTitle || tr.title,
        seoDescription: tr.seoDescription || null,
        seoKeywords: tr.seoKeywords || tr.keywords || [],
      },
    });
  }

  if (verificationStatus !== "DRAFT") {
    await prisma.marketingVerification.create({
      data: {
        eventId: event.id,
        status: verificationStatus,
        note: "Status set on save",
        verifiedBy: input.actorId || null,
      },
    });
    await prisma.marketingEvent.update({
      where: { id: event.id },
      data: { lastVerifiedAt: new Date() },
    });
  }

  await snapshotEventVersion(event.id, "published-snapshot");

  return getCalendarEventDetail(event.id);
}

export async function archiveCalendarEvent(id: string, actorId?: string) {
  const event = await prisma.marketingEvent.update({
    where: { id },
    data: {
      status: "ARCHIVED",
      active: false,
      verificationStatus: "ARCHIVED",
    },
    include: eventInclude,
  });
  await recordEventHistory({
    eventId: id,
    action: "archived",
    message: "Event archived",
    actorId,
  });
  return event;
}

export async function restoreCalendarEvent(id: string, actorId?: string) {
  const event = await prisma.marketingEvent.update({
    where: { id },
    data: {
      status: "ACTIVE",
      active: true,
      verificationStatus: "VERIFIED",
    },
    include: eventInclude,
  });
  await recordEventHistory({
    eventId: id,
    action: "restored",
    message: "Event restored",
    actorId,
  });
  return event;
}

export async function duplicateCalendarEvent(id: string) {
  const source = await getCalendarEventDetail(id);
  if (!source) return null;
  const newKey = `${source.key}_copy_${Date.now().toString(36)}`;
  return upsertCalendarEvent({
    key: newKey,
    name: `${source.name} (Copy)`,
    title: source.title || source.name,
    description: source.description || undefined,
    source: source.source,
    sourceKey: source.sourceRef?.key,
    categoryKey: source.marketingCategory?.key,
    subcategoryKey: source.subcategory?.key,
    countryCodes: source.countries,
    regionKey: source.region?.key,
    city: source.city || undefined,
    language: source.language,
    timezone: source.timezone,
    month: source.month,
    day: source.day,
    startDate: source.startDate
      ? source.startDate.toISOString().slice(0, 10)
      : null,
    endDate: source.endDate ? source.endDate.toISOString().slice(0, 10) : null,
    recurrence: source.recurrence,
    recurrenceRule: source.recurrenceRule,
    importance: source.importance,
    status: "DRAFT",
    industries: source.industries,
    tags: source.tags,
    audienceHints: source.audienceHints,
    translations: source.translations.map((t) => ({
      language: t.language,
      title: t.title,
      description: t.description || undefined,
      keywords: t.keywords,
    })),
  });
}

export async function bulkImportEvents(
  rows: Array<Record<string, unknown>>,
) {
  const created: string[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = String(row.name || row.title || "").trim();
      if (!name) throw new Error("Missing name");
      const event = await upsertCalendarEvent({
        key: row.key ? String(row.key) : undefined,
        name,
        title: row.title ? String(row.title) : name,
        description: row.description ? String(row.description) : undefined,
        source: (row.source as MarketingEventSource) || "CUSTOM",
        sourceKey: row.sourceKey ? String(row.sourceKey) : "custom",
        categoryKey: row.categoryKey
          ? String(row.categoryKey)
          : "custom_events",
        countryCodes: Array.isArray(row.countries)
          ? row.countries.map(String)
          : row.country
            ? [String(row.country)]
            : ["GLOBAL"],
        month: row.month != null ? Number(row.month) : null,
        day: row.day != null ? Number(row.day) : null,
        startDate: row.startDate ? String(row.startDate) : null,
        endDate: row.endDate ? String(row.endDate) : null,
        recurrence: row.recurrence ? String(row.recurrence) : "ANNUAL",
        importance: row.importance ? String(row.importance) : "MEDIUM",
        status: row.status ? String(row.status) : "ACTIVE",
        industries: Array.isArray(row.industries)
          ? row.industries.map(String)
          : [],
        tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
        language: row.language ? String(row.language) : "en",
        timezone: row.timezone ? String(row.timezone) : "UTC",
      });
      if (event) created.push(event.id);
    } catch (e) {
      errors.push({
        row: i + 1,
        error: e instanceof Error ? e.message : "Import failed",
      });
    }
  }

  return { created: created.length, ids: created, errors };
}

export async function bulkExportEvents(input?: CalendarSearchInput) {
  const result = await searchCalendarEvents({
    ...input,
    limit: 500,
    status: input?.status || "ACTIVE",
  });
  return result.events.map((e) => ({
    key: e.key,
    name: e.name,
    title: e.title,
    description: e.description,
    categoryKey: e.marketingCategory?.key,
    source: e.source,
    sourceKey: e.sourceRef?.key,
    month: e.month,
    day: e.day,
    startDate: e.startDate,
    endDate: e.endDate,
    recurrence: e.recurrence,
    importance: e.importance,
    status: e.status,
    countries: e.countries,
    industries: e.industries,
    tags: e.tags,
    language: e.language,
    timezone: e.timezone,
    nextDate: e.nextDate,
  }));
}
