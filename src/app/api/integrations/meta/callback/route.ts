import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleMetaOAuthCallback } from "@/server/services/meta/integration";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");

  try {
    const result = await handleMetaOAuthCallback({
      state,
      code,
      error,
      errorDescription,
      ip,
      userAgent,
    });

    const brand = await prisma.brand.findUnique({
      where: { id: result.brandId },
      include: { workspace: true },
    });
    const redirect = brand
      ? `/w/${brand.workspace.slug}/b/${brand.slug}/channels?meta=connected`
      : "/dashboard?meta=connected";

    return NextResponse.redirect(new URL(redirect, request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAUTH_FAILED";
    const fallback = new URL("/dashboard", request.url);
    fallback.searchParams.set("meta_error", message);
    return NextResponse.redirect(fallback);
  }
}
