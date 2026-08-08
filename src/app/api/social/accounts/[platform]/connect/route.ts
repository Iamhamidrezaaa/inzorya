import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { socialAccounts } from "@/server/social/service";
import { socialErrorResponse } from "@/server/social/http";

type RouteContext = { params: Promise<{ platform: string }> };

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { platform } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const started = await socialAccounts.startConnect({
      platform,
      userId: user.id!,
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({
      ok: true,
      authorizationUrl: started.authorizationUrl,
      platform: started.platform,
    });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
