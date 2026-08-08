import { NextResponse } from "next/server";
import { SocialIntegrationError } from "@/server/social/types";

export function socialErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof SocialIntegrationError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "UNSUPPORTED_PLATFORM" ||
              error.code === "UNSUPPORTED_CAPABILITY"
            ? 400
            : error.code === "PUBLISH_REQUIRES_APPROVAL"
              ? 409
              : error.code === "REAUTH_REQUIRED" || error.code === "AUTH_ERROR"
                ? 401
                : 400;
    return NextResponse.json(
      {
        error: error.userMessage,
        code: error.code,
      },
      { status },
    );
  }
  console.error("[social]", error instanceof Error ? error.message : error);
  return NextResponse.json(
    { error: "Something went wrong with this social connection." },
    { status: 500 },
  );
}
