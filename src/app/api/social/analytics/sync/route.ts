import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  getSocialAnalyticsIngestionService,
  socialAnalyticsErrorResponse,
  SocialAnalyticsError,
  MAX_SYNC_RANGE_DAYS,
} from "@/server/social-analytics-ingestion";
import { assertNoTokenLeak } from "@/server/social/credentials";

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  socialAccountId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  publicationId: z.string().min(1).optional(),
});

/** POST /api/social/analytics/sync — bounded manual sync */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new SocialAnalyticsError(
        "VALIDATION_ERROR",
        parsed.error.message,
      );
    }
    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const scope = {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    };
    const service = getSocialAnalyticsIngestionService();

    if (parsed.data.publicationId) {
      const result = await service.ingestPublication(
        parsed.data.publicationId,
        scope,
      );
      assertNoTokenLeak(result);
      return NextResponse.json(result);
    }

    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (Number.isNaN(days) || days < 0 || days > MAX_SYNC_RANGE_DAYS) {
      throw new SocialAnalyticsError(
        "VALIDATION_ERROR",
        `Date range must be 0–${MAX_SYNC_RANGE_DAYS} days`,
      );
    }

    const result = await service.processAnalyticsSync({
      socialAccountId: parsed.data.socialAccountId,
      from: parsed.data.from,
      to: parsed.data.to,
      scope,
    });
    assertNoTokenLeak(result);
    return NextResponse.json(result);
  } catch (error) {
    return socialAnalyticsErrorResponse(error);
  }
}
