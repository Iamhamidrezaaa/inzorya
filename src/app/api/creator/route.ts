import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { AIPlatformError } from "@/server/ai";
import {
  CREATOR_CONTENT_TYPES,
  CREATOR_OBJECTIVES,
  CREATOR_PLATFORMS,
  REWRITE_STYLES,
  SCORE_DIMENSIONS,
  VARIATION_COUNTS,
} from "@/lib/creator";
import {
  generateContent,
  getCreatorBootstrap,
  getGeneratedContent,
  pushVariationToStudio,
  restoreVersion,
  rewriteVariation,
  setVariationFavorite,
  updateGeneratedContent,
  variationToMarkdown,
} from "@/server/services/creator";

const scopeSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const contentId = searchParams.get("contentId");
    const view = searchParams.get("view") || "bootstrap";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (view === "content" && contentId) {
      const content = await getGeneratedContent(contentId, access.brand.id);
      if (!content) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ content });
    }

    if (view === "export" && contentId) {
      const variationId = searchParams.get("variationId");
      const content = await getGeneratedContent(contentId, access.brand.id);
      if (!content) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const variation =
        content.variations.find((v: { id: string }) => v.id === variationId) ||
        content.variations[0];
      if (!variation) {
        return NextResponse.json({ error: "No variation." }, { status: 404 });
      }
      const markdown = variationToMarkdown(variation);
      return NextResponse.json({
        markdown,
        title: variation.title,
        docxText: markdown,
      });
    }

    const bootstrap = await getCreatorBootstrap({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({
      ...bootstrap,
      meta: {
        platforms: CREATOR_PLATFORMS,
        objectives: CREATOR_OBJECTIVES,
        contentTypes: CREATOR_CONTENT_TYPES,
        variationCounts: VARIATION_COUNTS,
        rewriteStyles: REWRITE_STYLES,
        scoreDimensions: SCORE_DIMENSIONS,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to load creator." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = String(body.intent || "");
    const scope = scopeSchema.parse(body);
    const access = await requireBrandAccess(
      scope.workspaceSlug,
      scope.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "generate") {
      const content = await generateContent({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        platform: String(body.platform || "INSTAGRAM"),
        objective: body.objective || "ENGAGEMENT",
        contentType: body.contentType || "INSTAGRAM_CAPTION",
        campaignId: body.campaignId || null,
        campaignName: body.campaignName || null,
        variationCount: body.variationCount,
        language: String(body.language || "en"),
      });
      return NextResponse.json({ content });
    }

    if (intent === "rewrite") {
      const content = await rewriteVariation({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        contentId: String(body.contentId || ""),
        variationId: String(body.variationId || ""),
        style: String(body.style || "friendlier"),
        language: String(body.language || "en"),
      });
      if (!content) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ content });
    }

    if (intent === "update") {
      const content = await updateGeneratedContent({
        brandId: access.brand.id,
        contentId: String(body.contentId || ""),
        favorited: body.favorited,
        archived: body.archived,
        status: body.status,
        duplicate: body.duplicate,
        userId: user.id!,
      });
      if (!content) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ content });
    }

    if (intent === "restore") {
      const content = await restoreVersion({
        brandId: access.brand.id,
        contentId: String(body.contentId || ""),
        userId: user.id!,
      });
      if (!content) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ content });
    }

    if (intent === "favorite_variation") {
      const variation = await setVariationFavorite({
        brandId: access.brand.id,
        variationId: String(body.variationId || ""),
        favorited: Boolean(body.favorited),
      });
      if (!variation) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ variation });
    }

    if (intent === "push_studio") {
      const result = await pushVariationToStudio({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        workspaceSlug: scope.workspaceSlug,
        brandSlug: scope.brandSlug,
        contentId: String(body.contentId || ""),
        variationId: String(body.variationId || ""),
      });
      if (!result) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    if (error instanceof AIPlatformError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: 500 },
    );
  }
}
