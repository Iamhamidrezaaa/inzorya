import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import { socialAccounts } from "@/server/social/service";
import { assertNoTokenLeak } from "@/server/social/credentials";
import { socialErrorResponse } from "@/server/social/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const account = await socialAccounts.getAccount(id, {
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });
    assertNoTokenLeak(account);
    return NextResponse.json({ account });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
