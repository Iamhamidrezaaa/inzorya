import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  getSocialAnalyticsProviderRegistry,
  isAnalyticsPlatformRemoved,
  isAnalyticsPlatformUnavailable,
  socialAnalyticsErrorResponse,
} from "@/server/social-analytics-ingestion";
import { assertNoTokenLeak } from "@/server/social/credentials";

/** GET /api/social/analytics/providers */
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

    const providers = getSocialAnalyticsProviderRegistry()
      .listAnalyticsProviders()
      .map((p) => p.descriptor());

    const payload = {
      providers,
      unavailable: ["meta", "facebook", "instagram", "tiktok"],
      removed: ["pinterest"],
      notes: [
        "Configured credentials do not imply analytics capability.",
        "Meta and TikTok are unavailable — not implemented.",
        "Pinterest is removed.",
      ],
    };
    assertNoTokenLeak(payload);
    return NextResponse.json(payload);
  } catch (error) {
    return socialAnalyticsErrorResponse(error);
  }
}

export function platformPolicyStatus(platform: string) {
  if (isAnalyticsPlatformRemoved(platform)) return "REMOVED";
  if (isAnalyticsPlatformUnavailable(platform)) return "UNAVAILABLE";
  return null;
}
