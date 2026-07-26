import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  EVENT_STATUSES,
  IMPORTANCE_LEVELS,
  IMPORT_FORMATS,
  RECURRENCE_TYPES,
  TIME_FILTERS,
  VERIFICATION_STATUSES,
} from "@/lib/calendar";
import {
  archiveCalendarEvent,
  bulkExportEvents,
  bulkImportEvents,
  duplicateCalendarEvent,
  ensureCalendarCatalog,
  getCalendarEventDetail,
  getUpcomingEvents,
  listCalendarMeta,
  restoreCalendarEvent,
  searchCalendarEvents,
  upsertCalendarEvent,
} from "@/server/services/calendar";
import {
  bulkOperateEvents,
  listImportJobs,
  mergeDuplicateEvents,
  runImportPipeline,
} from "@/server/services/calendar-catalog";

const scopeSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const view = searchParams.get("view") || "search";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (view === "meta") {
      const meta = await listCalendarMeta();
      return NextResponse.json({
        ...meta,
        filters: {
          time: TIME_FILTERS,
          recurrence: RECURRENCE_TYPES,
          importance: IMPORTANCE_LEVELS,
          statuses: EVENT_STATUSES,
          verification: VERIFICATION_STATUSES,
          importFormats: IMPORT_FORMATS,
        },
      });
    }

    if (view === "detail") {
      const id = searchParams.get("id") || searchParams.get("key") || "";
      const event = await getCalendarEventDetail(id);
      if (!event) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ event });
    }

    if (view === "upcoming") {
      const result = await getUpcomingEvents({
        country: searchParams.get("country") || undefined,
        category: searchParams.get("category") || undefined,
        limit: Number(searchParams.get("limit") || 40),
      });
      return NextResponse.json(result);
    }

    if (view === "categories") {
      const meta = await listCalendarMeta();
      return NextResponse.json({ categories: meta.categories });
    }

    if (view === "countries") {
      const meta = await listCalendarMeta();
      return NextResponse.json({
        countries: meta.countries,
        regions: meta.regions,
      });
    }

    if (view === "seasons") {
      const meta = await listCalendarMeta();
      return NextResponse.json({ seasons: meta.seasons });
    }

    if (view === "localization") {
      const id = searchParams.get("id") || "";
      const event = await getCalendarEventDetail(id);
      if (!event) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({
        localizations: event.localizations,
        translations: event.translations,
      });
    }

    if (view === "imports") {
      const jobs = await listImportJobs();
      return NextResponse.json({ jobs });
    }

    if (view === "export") {
      const rows = await bulkExportEvents({
        q: searchParams.get("q") || undefined,
        category: searchParams.get("category") || undefined,
        country: searchParams.get("country") || undefined,
        status: searchParams.get("status") || "ACTIVE",
      });
      return NextResponse.json({ events: rows });
    }

    const month = searchParams.get("month");
    const quarter = searchParams.get("quarter");
    const result = await searchCalendarEvents({
      q: searchParams.get("q") || undefined,
      category: searchParams.get("category") || undefined,
      country: searchParams.get("country") || undefined,
      industry: searchParams.get("industry") || undefined,
      month: month ? Number(month) : undefined,
      quarter: quarter ? Number(quarter) : undefined,
      season: searchParams.get("season") || undefined,
      seasonKey: searchParams.get("seasonKey") || undefined,
      tags: searchParams.get("tags")
        ? searchParams.get("tags")!.split(",").filter(Boolean)
        : undefined,
      importance: searchParams.get("importance") || undefined,
      status: searchParams.get("status") || undefined,
      verificationStatus: searchParams.get("verificationStatus") || undefined,
      language: searchParams.get("language") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      timeFilter:
        (searchParams.get("timeFilter") as
          | "upcoming"
          | "today"
          | "this_week"
          | "this_month"
          | "this_quarter"
          | "past"
          | undefined) || "upcoming",
      limit: Number(searchParams.get("limit") || 50),
      offset: Number(searchParams.get("offset") || 0),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load calendar." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = String(body.intent || "");
    const scope = scopeSchema.parse(body);
    const access = await requireBrandAccess(
      scope.workspaceSlug,
      scope.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "ensure") {
      const stats = await ensureCalendarCatalog();
      return NextResponse.json({ ok: true, stats });
    }

    if (intent === "upsert") {
      const event = await upsertCalendarEvent({
        ...(body.event || body),
        actorId: user.id!,
      });
      return NextResponse.json({ event });
    }

    if (intent === "archive") {
      const event = await archiveCalendarEvent(String(body.id || ""), user.id!);
      return NextResponse.json({ event });
    }

    if (intent === "restore") {
      const event = await restoreCalendarEvent(String(body.id || ""), user.id!);
      return NextResponse.json({ event });
    }

    if (intent === "duplicate") {
      const event = await duplicateCalendarEvent(String(body.id || ""));
      if (!event) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ event });
    }

    if (intent === "import") {
      // Legacy JSON array
      if (Array.isArray(body.events)) {
        const result = await bulkImportEvents(body.events);
        return NextResponse.json(result);
      }
      const result = await runImportPipeline({
        format: body.format || "JSON",
        payload: String(body.payload || ""),
        fileName: body.fileName,
        sourceUrl: body.sourceUrl,
        actorId: user.id!,
      });
      return NextResponse.json(result);
    }

    if (intent === "bulk") {
      const result = await bulkOperateEvents({
        action: body.action,
        ids: Array.isArray(body.ids) ? body.ids.map(String) : [],
        actorId: user.id!,
        tags: body.tags,
        patch: body.patch,
        translation: body.translation,
      });
      return NextResponse.json(result);
    }

    if (intent === "merge") {
      const result = await mergeDuplicateEvents({
        keepId: String(body.keepId || ""),
        mergeIds: Array.isArray(body.mergeIds) ? body.mergeIds.map(String) : [],
        actorId: user.id!,
      });
      if (!result) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: 500 },
    );
  }
}
