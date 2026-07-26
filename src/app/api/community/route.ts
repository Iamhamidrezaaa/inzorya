import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { AIPlatformError } from "@/server/ai";
import {
  COMMUNITY_CHANNELS,
  COMMUNITY_TONES,
  INTENT_TYPES,
  QUALITY_DIMENSIONS,
  RESPONSE_MODES,
  SUGGESTION_KINDS,
} from "@/lib/community";
import {
  collaborateOnConversation,
  getCommunityBootstrap,
  reviewSuggestedReply,
  scanCommunityInbox,
  updateAutoReplyRule,
  updateCommunitySettings,
} from "@/server/services/community";

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

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const bootstrap = await getCommunityBootstrap({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({
      ...bootstrap,
      meta: {
        channels: COMMUNITY_CHANNELS,
        responseModes: RESPONSE_MODES,
        tones: COMMUNITY_TONES,
        intentTypes: INTENT_TYPES,
        suggestionKinds: SUGGESTION_KINDS,
        qualityDimensions: QUALITY_DIMENSIONS,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load community manager." },
      { status: 500 },
    );
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

    if (intent === "scan") {
      const dashboard = await scanCommunityInbox({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        conversationIds: body.conversationIds,
        language: String(body.language || "en"),
      });
      return NextResponse.json({ dashboard });
    }

    if (intent === "settings") {
      const rule = await updateCommunitySettings({
        brandId: access.brand.id,
        responseMode: body.responseMode,
        tone: body.tone,
        autoCategories: body.autoCategories,
        enabled: body.enabled,
      });
      return NextResponse.json({ rule });
    }

    if (intent === "auto_rule") {
      const rule = await updateAutoReplyRule({
        brandId: access.brand.id,
        ruleId: String(body.ruleId || ""),
        enabled: body.enabled,
        autoSend: body.autoSend,
        template: body.template,
      });
      if (!rule) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ rule });
    }

    if (intent === "review_reply") {
      const reply = await reviewSuggestedReply({
        brandId: access.brand.id,
        userId: user.id!,
        replyId: String(body.replyId || ""),
        action: body.action || "approve",
        editedBody: body.editedBody,
      });
      if (!reply) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ reply });
    }

    if (intent === "collaborate") {
      const conversation = await collaborateOnConversation({
        brandId: access.brand.id,
        userId: user.id!,
        conversationId: String(body.conversationId || ""),
        assigneeId: body.assigneeId,
        note: body.note,
        status: body.status,
        mention: body.mention,
      });
      if (!conversation) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ conversation });
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
