import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  getSocialAnalyticsIngestionService,
  socialAnalyticsErrorResponse,
} from "@/server/social-analytics-ingestion";
import { assertNoTokenLeak } from "@/server/social/credentials";

/** GET /api/social/analytics — brand-level ingested metrics summary */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const data = await getSocialAnalyticsIngestionService().listBrandAnalytics(
      {
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      },
      { limit: Number(searchParams.get("limit") || 40) || 40 },
    );
    assertNoTokenLeak(data);
    return NextResponse.json(data);
  } catch (error) {
    return socialAnalyticsErrorResponse(error);
  }
}
