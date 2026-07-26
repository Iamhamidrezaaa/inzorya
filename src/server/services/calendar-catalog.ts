import type { ImportFormat, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseCsv, parseIcs, slugifyKey } from "@/lib/calendar";
import {
  archiveCalendarEvent,
  recordEventHistory,
  restoreCalendarEvent,
  upsertCalendarEvent,
} from "@/server/services/calendar";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim()) return row[k];
      const found = Object.keys(row).find(
        (rk) => rk.toLowerCase() === k.toLowerCase(),
      );
      if (found && row[found] != null && String(row[found]).trim()) {
        return row[found];
      }
    }
    return undefined;
  };

  const countriesRaw = get("countries", "country", "countryCodes");
  const tagsRaw = get("tags", "tag");
  const industriesRaw = get("industries", "industry");

  const split = (v: unknown) =>
    Array.isArray(v)
      ? v.map(String)
      : String(v || "")
          .split(/[|,]/)
          .map((s) => s.trim())
          .filter(Boolean);

  return {
    key: get("key"),
    name: get("name", "title", "SUMMARY"),
    title: get("title", "name"),
    description: get("description", "DESCRIPTION"),
    categoryKey: get("categoryKey", "category") || "company_custom",
    source: get("source") || "CUSTOM",
    sourceKey: get("sourceKey") || "custom",
    month: get("month") != null ? Number(get("month")) : null,
    day: get("day") != null ? Number(get("day")) : null,
    startDate: get("startDate", "start"),
    endDate: get("endDate", "end"),
    recurrence: get("recurrence") || "ANNUAL",
    importance: get("importance") || "MEDIUM",
    status: get("status") || "ACTIVE",
    verificationStatus: get("verificationStatus") || "DRAFT",
    countries: split(countriesRaw).length ? split(countriesRaw) : ["GLOBAL"],
    tags: split(tagsRaw),
    industries: split(industriesRaw),
    language: get("language") || "en",
    timezone: get("timezone") || "UTC",
    state: get("state"),
    province: get("province"),
    city: get("city"),
  };
}

export async function runImportPipeline(input: {
  format: ImportFormat | string;
  payload: string;
  fileName?: string;
  sourceUrl?: string;
  actorId?: string;
}) {
  const format = String(input.format || "JSON").toUpperCase() as ImportFormat;
  const job = await prisma.marketingImportJob.create({
    data: {
      format,
      status: "RUNNING",
      fileName: input.fileName || null,
      sourceUrl: input.sourceUrl || null,
      meta: asJson({ startedAt: new Date().toISOString() }),
    },
  });

  const log = async (level: string, message: string, row?: number) => {
    await prisma.marketingImportLog.create({
      data: { jobId: job.id, level, message, row },
    });
  };

  try {
    let rows: Array<Record<string, unknown>> = [];

    if (format === "REST") {
      const url = input.sourceUrl || input.payload.trim();
      if (!url.startsWith("http")) {
        throw new Error("REST import requires an http(s) URL");
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`REST fetch failed: ${res.status}`);
      const json = await res.json();
      rows = Array.isArray(json) ? json : json.events || [];
      await log("info", `Fetched ${rows.length} rows from REST`);
    } else if (format === "ICS") {
      rows = parseIcs(input.payload);
      await log("info", `Parsed ${rows.length} VEVENT blocks`);
    } else if (format === "CSV" || format === "EXCEL") {
      rows = parseCsv(input.payload) as Array<Record<string, unknown>>;
      await log("info", `Parsed ${rows.length} CSV/Excel rows`);
    } else {
      const parsed = JSON.parse(input.payload);
      rows = Array.isArray(parsed) ? parsed : parsed.events || [];
      await log("info", `Parsed ${rows.length} JSON rows`);
    }

    let success = 0;
    let failed = 0;
    const ids: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const n = normalizeRow(rows[i]);
        const name = String(n.name || "").trim();
        if (!name) throw new Error("Missing name");
        const event = await upsertCalendarEvent({
          key: n.key ? String(n.key) : undefined,
          name,
          title: n.title ? String(n.title) : name,
          description: n.description ? String(n.description) : undefined,
          source: String(n.source),
          sourceKey: String(n.sourceKey),
          categoryKey: String(n.categoryKey),
          countryCodes: n.countries as string[],
          month: n.month as number | null,
          day: n.day as number | null,
          startDate: n.startDate ? String(n.startDate) : null,
          endDate: n.endDate ? String(n.endDate) : null,
          recurrence: String(n.recurrence),
          importance: String(n.importance),
          status: String(n.status),
          verificationStatus: String(n.verificationStatus),
          tags: n.tags as string[],
          industries: n.industries as string[],
          language: String(n.language),
          timezone: String(n.timezone),
          state: n.state ? String(n.state) : undefined,
          province: n.province ? String(n.province) : undefined,
          city: n.city ? String(n.city) : undefined,
          actorId: input.actorId,
          translations: [
            {
              language: String(n.language || "en"),
              title: name,
              description: n.description ? String(n.description) : undefined,
              keywords: n.tags as string[],
              slug: slugifyKey(name),
            },
          ],
        });
        if (event) {
          success++;
          ids.push(event.id);
        }
      } catch (e) {
        failed++;
        await log(
          "error",
          e instanceof Error ? e.message : "Row failed",
          i + 1,
        );
      }
    }

    await prisma.marketingImportJob.update({
      where: { id: job.id },
      data: {
        status: failed && !success ? "FAILED" : "COMPLETED",
        total: rows.length,
        success,
        failed,
        meta: asJson({ ids: ids.slice(0, 100) }),
      },
    });

    return {
      jobId: job.id,
      total: rows.length,
      success,
      failed,
      ids,
    };
  } catch (e) {
    await log("error", e instanceof Error ? e.message : "Import failed");
    await prisma.marketingImportJob.update({
      where: { id: job.id },
      data: { status: "FAILED" },
    });
    throw e;
  }
}

export async function bulkOperateEvents(input: {
  action:
    | "archive"
    | "restore"
    | "delete"
    | "tag"
    | "update"
    | "translate";
  ids: string[];
  actorId?: string;
  tags?: string[];
  patch?: Record<string, unknown>;
  translation?: {
    language: string;
    title?: string;
    description?: string;
    keywords?: string[];
  };
}) {
  const ids = input.ids.filter(Boolean);
  let affected = 0;

  if (input.action === "archive") {
    for (const id of ids) {
      await archiveCalendarEvent(id, input.actorId);
      affected++;
    }
  }

  if (input.action === "restore") {
    for (const id of ids) {
      await restoreCalendarEvent(id, input.actorId);
      affected++;
    }
  }

  if (input.action === "delete") {
    for (const id of ids) {
      await prisma.marketingEvent.delete({ where: { id } }).catch(() => null);
      affected++;
    }
  }

  if (input.action === "tag" && input.tags?.length) {
    for (const id of ids) {
      const event = await prisma.marketingEvent.findUnique({ where: { id } });
      if (!event) continue;
      const merged = Array.from(new Set([...event.tags, ...input.tags]));
      await prisma.marketingEvent.update({
        where: { id },
        data: { tags: merged },
      });
      for (const tagName of input.tags) {
        const tagKey = slugifyKey(tagName);
        const tag = await prisma.marketingTag.upsert({
          where: { key: tagKey },
          create: { key: tagKey, name: tagName },
          update: { name: tagName },
        });
        await prisma.marketingEventTag.upsert({
          where: { eventId_tagId: { eventId: id, tagId: tag.id } },
          create: { eventId: id, tagId: tag.id },
          update: {},
        });
      }
      await recordEventHistory({
        eventId: id,
        action: "modified",
        message: `Bulk tagged: ${input.tags.join(", ")}`,
        actorId: input.actorId,
      });
      affected++;
    }
  }

  if (input.action === "update" && input.patch) {
    for (const id of ids) {
      const event = await prisma.marketingEvent.findUnique({ where: { id } });
      if (!event) continue;
      await upsertCalendarEvent({
        id,
        name: String(input.patch.name || event.name),
        title: String(input.patch.title || event.title || event.name),
        description:
          input.patch.description != null
            ? String(input.patch.description)
            : event.description || undefined,
        categoryKey: input.patch.categoryKey
          ? String(input.patch.categoryKey)
          : undefined,
        importance: input.patch.importance
          ? String(input.patch.importance)
          : event.importance,
        status: input.patch.status ? String(input.patch.status) : event.status,
        verificationStatus: input.patch.verificationStatus
          ? String(input.patch.verificationStatus)
          : event.verificationStatus,
        countryCodes: event.countries,
        tags: event.tags,
        industries: event.industries,
        month: event.month,
        day: event.day,
        actorId: input.actorId,
      });
      affected++;
    }
  }

  if (input.action === "translate" && input.translation?.language) {
    for (const id of ids) {
      const event = await prisma.marketingEvent.findUnique({ where: { id } });
      if (!event) continue;
      const title = input.translation.title || event.title || event.name;
      const language = input.translation.language;
      await prisma.marketingLocalization.upsert({
        where: { eventId_language: { eventId: id, language } },
        create: {
          eventId: id,
          language,
          title,
          description: input.translation.description || event.description,
          keywords: input.translation.keywords || event.tags,
          slug: slugifyKey(title),
          seoTitle: title,
        },
        update: {
          title,
          description: input.translation.description || event.description,
          keywords: input.translation.keywords || event.tags,
        },
      });
      await prisma.marketingTranslation.upsert({
        where: { eventId_language: { eventId: id, language } },
        create: {
          eventId: id,
          language,
          title,
          description: input.translation.description || event.description,
          keywords: input.translation.keywords || event.tags,
          slug: slugifyKey(title),
        },
        update: {
          title,
          description: input.translation.description || event.description,
          keywords: input.translation.keywords || event.tags,
        },
      });
      await recordEventHistory({
        eventId: id,
        action: "modified",
        message: `Bulk translation (${language})`,
        actorId: input.actorId,
      });
      affected++;
    }
  }

  return { affected };
}

export async function mergeDuplicateEvents(input: {
  keepId: string;
  mergeIds: string[];
  actorId?: string;
}) {
  const keep = await prisma.marketingEvent.findUnique({
    where: { id: input.keepId },
  });
  if (!keep) return null;

  const mergeIds = input.mergeIds.filter((id) => id !== input.keepId);
  const tags = new Set(keep.tags);
  const countries = new Set(keep.countries);
  const industries = new Set(keep.industries);

  for (const id of mergeIds) {
    const other = await prisma.marketingEvent.findUnique({ where: { id } });
    if (!other) continue;
    other.tags.forEach((t) => tags.add(t));
    other.countries.forEach((c) => countries.add(c));
    other.industries.forEach((i) => industries.add(i));

    // Move opportunities references stay on event — don't reassign to avoid unique conflicts
    await archiveCalendarEvent(id, input.actorId);
    await recordEventHistory({
      eventId: id,
      action: "archived",
      message: `Merged into ${keep.key}`,
      actorId: input.actorId,
      meta: { mergedInto: keep.id },
    });
  }

  await prisma.marketingEvent.update({
    where: { id: keep.id },
    data: {
      tags: Array.from(tags),
      countries: Array.from(countries),
      industries: Array.from(industries),
      version: keep.version + 1,
    },
  });
  await recordEventHistory({
    eventId: keep.id,
    action: "modified",
    message: `Merged ${mergeIds.length} duplicates`,
    actorId: input.actorId,
    meta: { mergeIds },
  });

  return { keepId: keep.id, merged: mergeIds.length };
}

export async function listImportJobs(take = 20) {
  return prisma.marketingImportJob.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { logs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
}
