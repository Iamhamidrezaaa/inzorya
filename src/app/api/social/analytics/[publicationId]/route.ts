import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  getSocialAnalyticsIngestionService,
  socialAnalyticsErrorResponse,
} from "@/server/social-analytics-ingestion";
import { assertNoTokenLeak } from "@/server/social/credentials";

type RouteContext = { params: Promise<{ publicationId: string }> };

/** GET /api/social/analytics/[publicationId] */
export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { publicationId } = await context.params;
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const data =
      await getSocialAnalyticsIngestionService().getPublicationAnalytics(
        publicationId,
        {
          workspaceId: access.workspace.id,
          brandId: access.brand.id,
        },
      );
    assertNoTokenLeak(data);
    return NextResponse.json(data);
  } catch (error) {
    return socialAnalyticsErrorResponse(error);
  }
}
