import { NextResponse } from "next/server";
import { requireUser } from "@/server/access";
import { publishing } from "@/server/publishing";
import { publishingErrorResponse } from "@/server/publishing/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

type RouteContext = { params: Promise<{ platform: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { platform } = await context.params;
    const caps = await publishing.getProviderCapabilities(platform);
    assertNoTokenLeak(caps);
    return NextResponse.json(caps);
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
