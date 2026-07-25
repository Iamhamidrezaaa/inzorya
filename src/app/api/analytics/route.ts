import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  createAnalyticsReport,
  createAnalyticsTemplate,
  getAnalyticsOverview,
  getAnalyticsReports,
  getAnalyticsTemplates,
} from "@/server/services/analytics/repository";
import type { TimeRangeKey } from "@/lib/analytics/mock-provider";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const view = searchParams.get("view") || "overview";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (view === "reports") {
      const [reports, templates] = await Promise.all([
        getAnalyticsReports(access.brand.id),
        getAnalyticsTemplates(access.brand.id),
      ]);
      return NextResponse.json({ reports, templates });
    }

    const bundle = await getAnalyticsOverview({
      brandId: access.brand.id,
      rangeKey: (searchParams.get("range") || "30d") as TimeRangeKey,
      customStart: searchParams.get("start") || undefined,
      customEnd: searchParams.get("end") || undefined,
      platform: searchParams.get("platform") || undefined,
      campaign: searchParams.get("campaign") || undefined,
      contentType: searchParams.get("contentType") || undefined,
      author: searchParams.get("author") || undefined,
      status: searchParams.get("status") || undefined,
      q: searchParams.get("q") || undefined,
    });

    return NextResponse.json({ analytics: bundle, source: "mock" });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load analytics." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = body.intent as string;

    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "save_report") {
      const parsed = z
        .object({
          name: z.string().min(1).max(120),
          rangeLabel: z.string().optional(),
          metrics: z.array(z.string()),
          charts: z.array(z.string()),
          templateId: z.string().optional().nullable(),
          payload: z.unknown().optional(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid report." }, { status: 400 });
      }
      const report = await createAnalyticsReport({
        brandId: access.brand.id,
        ...parsed.data,
      });
      return NextResponse.json({ ok: true, report });
    }

    if (intent === "save_template") {
      const parsed = z
        .object({
          name: z.string().min(1).max(120),
          description: z.string().optional(),
          metrics: z.array(z.string()),
          charts: z.array(z.string()),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid template." }, { status: 400 });
      }
      const template = await createAnalyticsTemplate({
        brandId: access.brand.id,
        ...parsed.data,
      });
      return NextResponse.json({ ok: true, template });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
}
