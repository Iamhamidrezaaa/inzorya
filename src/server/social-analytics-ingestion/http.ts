import { NextResponse } from "next/server";
import { SocialAnalyticsError } from "@/server/social-analytics-ingestion/types";
import { SocialIntegrationError } from "@/server/social/types";

export function socialAnalyticsErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof SocialAnalyticsError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "REAUTH_REQUIRED" || error.code === "AUTH_ERROR"
            ? 401
            : error.code === "RATE_LIMIT"
              ? 429
              : 400;
    return NextResponse.json(
      {
        error: error.userMessage,
        code: error.code,
        ...(error.retryAfterMs != null
          ? { retryAfterMs: error.retryAfterMs }
          : {}),
      },
      {
        status,
        headers:
          error.code === "RATE_LIMIT" && error.retryAfterMs
            ? { "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)) }
            : undefined,
      },
    );
  }
  if (error instanceof SocialIntegrationError) {
    return NextResponse.json(
      { error: error.userMessage, code: error.code },
      { status: 400 },
    );
  }
  console.error(
    "[social-analytics]",
    error instanceof Error ? error.message : error,
  );
  return NextResponse.json(
    { error: "Analytics request failed." },
    { status: 500 },
  );
}
