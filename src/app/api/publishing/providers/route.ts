import { NextResponse } from "next/server";
import { requireUser } from "@/server/access";
import { publishing } from "@/server/publishing";
import { publishingErrorResponse } from "@/server/publishing/http";
import { assertNoTokenLeak } from "@/server/social/credentials";

export async function GET() {
  try {
    await requireUser();
    const providers = await publishing.listProviders();
    const payload = {
      providers,
      unavailable: [
        { platform: "meta", status: "UNAVAILABLE" },
        { platform: "tiktok", status: "UNAVAILABLE" },
      ],
      removed: [{ platform: "pinterest", status: "REMOVED" }],
    };
    assertNoTokenLeak(payload);
    return NextResponse.json(payload);
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
