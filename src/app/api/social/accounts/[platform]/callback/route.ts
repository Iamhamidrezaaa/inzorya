import { NextResponse } from "next/server";
import { requireUser } from "@/server/access";
import { prisma } from "@/lib/db";
import { socialAccounts } from "@/server/social/service";
import { hashOAuthState } from "@/server/social/credentials";
import { SocialIntegrationError } from "@/server/social/types";

type RouteContext = { params: Promise<{ platform: string }> };

async function resolveReturnPath(state: string | null): Promise<string> {
  if (!state) return "/dashboard";
  const oauthState = await prisma.socialOAuthState.findUnique({
    where: { stateHash: hashOAuthState(state) },
  });
  if (!oauthState) return "/dashboard";
  const brand = await prisma.brand.findUnique({
    where: { id: oauthState.brandId },
    include: { workspace: true },
  });
  if (!brand) return "/dashboard";
  return `/w/${brand.workspace.slug}/b/${brand.slug}/social-accounts`;
}

export async function GET(request: Request, context: RouteContext) {
  const { platform } = await context.params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const returnPath = await resolveReturnPath(state);

  try {
    const user = await requireUser();

    if (oauthError) {
      const url = new URL(returnPath, request.url);
      url.searchParams.set("socialError", "Connection was cancelled or denied.");
      return NextResponse.redirect(url);
    }
    if (!code || !state) {
      const url = new URL(returnPath, request.url);
      url.searchParams.set("socialError", "Invalid connection response.");
      return NextResponse.redirect(url);
    }

    await socialAccounts.completeConnect({
      platform,
      code,
      state,
      userId: user.id!,
    });

    const url = new URL(returnPath, request.url);
    url.searchParams.set("connected", platform);
    return NextResponse.redirect(url);
  } catch (error) {
    const message =
      error instanceof SocialIntegrationError
        ? error.userMessage
        : error instanceof Error && error.message === "UNAUTHORIZED"
          ? "Please sign in and try connecting again."
          : "Connection failed. Please try again.";
    const url = new URL(returnPath, request.url);
    url.searchParams.set("socialError", message);
    return NextResponse.redirect(url);
  }
}
