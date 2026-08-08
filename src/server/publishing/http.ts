import { NextResponse } from "next/server";
import { PublisherError } from "@/server/publishing/types";

export function publishingErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof PublisherError) {
    const status =
      error.code === "AUTH_ERROR"
        ? 401
        : error.code === "RATE_LIMIT"
          ? 429
          : error.code === "PLATFORM_UNAVAILABLE" ||
              error.code === "UNSUPPORTED_CAPABILITY"
            ? 400
            : 400;
    return NextResponse.json(
      { error: error.userMessage, code: error.code },
      { status },
    );
  }
  console.error("[publishing]", error instanceof Error ? error.message : "error");
  return NextResponse.json(
    { error: "Publishing request failed." },
    { status: 500 },
  );
}
