import { NextResponse } from "next/server";
import { ContentLearningError } from "@/server/content-learning/engine";

export function learningErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ContentLearningError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "FORBIDDEN"
          ? 403
          : 400;
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }
  console.error(
    "[content-learning]",
    error instanceof Error ? error.message : error,
  );
  return NextResponse.json(
    { error: "Learning request failed." },
    { status: 500 },
  );
}
