import { NextResponse } from "next/server";
import { requireBrandAccess, requireUser } from "@/server/access";
import { socialAccounts } from "@/server/social/service";
import { getSocialProviderRegistry } from "@/server/social/registry";
import { assertNoTokenLeak } from "@/server/social/credentials";
import { socialErrorResponse } from "@/server/social/http";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const [accounts, providers] = await Promise.all([
      socialAccounts.listAccounts({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      }),
      Promise.resolve(
        getSocialProviderRegistry()
          .listProviders()
          .map((p) => p.descriptor()),
      ),
    ]);

    const payload = {
      accounts,
      providers: providers.map((p) => ({
        platform: p.platform,
        displayName: p.displayName,
        authType: p.authType,
        configured: p.configured,
        capabilities: {
          accountInfo: p.capabilities.accountInfo,
          publishing: p.capabilities.publishing,
          analytics: p.capabilities.analytics,
          mediaUpload: p.capabilities.mediaUpload,
          profile: p.capabilities.profile,
          connect: p.capabilities.connect,
        },
      })),
      unavailable: [
        { platform: "meta", reason: "unavailable / postponed" },
        { platform: "tiktok", reason: "unavailable / postponed" },
      ],
    };
    assertNoTokenLeak(payload);
    return NextResponse.json(payload);
  } catch (error) {
    return socialErrorResponse(error);
  }
}
