import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  getSocialAnalyticsProviderRegistry,
  isAnalyticsPlatformRemoved,
  isAnalyticsPlatformUnavailable,
  socialAnalyticsErrorResponse,
} from "@/server/social-analytics-ingestion";
import { assertNoTokenLeak } from "@/server/social/credentials";

type RouteContext = { params: Promise<{ platform: string }> };

/** GET /api/social/analytics/providers/[platform]/capabilities */
export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { platform } = await context.params;
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const id = platform.toLowerCase();
    if (isAnalyticsPlatformRemoved(id)) {
      return NextResponse.json({
        platform: id,
        available: false,
        reason: "REMOVED",
        capabilities: {
          postMetrics: false,
          accountMetrics: false,
          audienceMetrics: false,
        },
      });
    }
    if (isAnalyticsPlatformUnavailable(id)) {
      return NextResponse.json({
        platform: id,
        available: false,
        reason: "UNAVAILABLE",
        capabilities: {
          postMetrics: false,
          accountMetrics: false,
          audienceMetrics: false,
        },
      });
    }

    const provider =
      getSocialAnalyticsProviderRegistry().getAnalyticsProvider(id);
    if (!provider) {
      return NextResponse.json({
        platform: id,
        available: false,
        reason: "CAPABILITY_NOT_AVAILABLE",
        capabilities: {
          postMetrics: false,
          accountMetrics: false,
          audienceMetrics: false,
        },
      });
    }

    const descriptor = provider.descriptor();
    const payload = {
      platform: descriptor.platform,
      available: Object.values(descriptor.capabilities).some(Boolean),
      configured: descriptor.configured,
      verificationStatus: descriptor.verificationStatus,
      capabilities: descriptor.capabilities,
    };
    assertNoTokenLeak(payload);
    return NextResponse.json(payload);
  } catch (error) {
    return socialAnalyticsErrorResponse(error);
  }
}
