import { NextResponse } from "next/server";
import { ContentPlanningError } from "@/server/content-planning";

export function planningErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ContentPlanningError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "INVALID_TRANSITION" || error.code === "INVALID_STATUS"
            ? 409
            : error.code === "PUBLISH_NOT_ALLOWED"
              ? 405
              : 400;
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }
  console.error("[content-planning]", error);
  return NextResponse.json({ error: "Request failed." }, { status: 500 });
}
