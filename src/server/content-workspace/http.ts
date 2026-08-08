import { NextResponse } from "next/server";
import { ContentWorkspaceError } from "@/server/content-workspace/types";

export function contentWorkspaceErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ContentWorkspaceError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "PUBLISH_NOT_ALLOWED"
            ? 405
            : error.code === "INVALID_TRANSITION"
              ? 409
              : 400;
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Request failed." }, { status: 500 });
}
