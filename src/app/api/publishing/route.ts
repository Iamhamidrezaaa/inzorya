import { NextResponse } from "next/server";
import { SocialPublicationStatus } from "@prisma/client";
import { requireBrandAccess, requireUser } from "@/server/access";
import { publishing } from "@/server/publishing";
import { publishingErrorResponse } from "@/server/publishing/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const access = await requireBrandAccess(
      searchParams.get("workspaceSlug") || "",
      searchParams.get("brandSlug") || "",
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const status = searchParams.get("status") as SocialPublicationStatus | null;
    const draftId = searchParams.get("draftId");
    const publications = await publishing.list(
      { workspaceId: access.workspace.id, brandId: access.brand.id },
      status ? { status } : undefined,
    );
    const filtered = draftId
      ? publications.filter((p) => p.contentDraftId === draftId)
      : publications;
    const payload = { publications: filtered };
    assertNoTokenLeak(payload);
    return NextResponse.json(payload);
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
