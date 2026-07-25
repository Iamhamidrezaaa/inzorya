import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { AIPlatformError } from "@/server/ai";
import {
  CONTEXT_SOURCE_OPTIONS,
  FOLLOW_UP_ACTIONS,
  STARTER_SUGGESTIONS,
  STRATEGY_CONVERSATION_TYPES,
} from "@/lib/strategist";
import {
  createConversation,
  getConversationDetail,
  getStrategistBootstrap,
  inspectConversationContext,
  saveStrategyDocument,
  sendStrategistMessage,
  setRecommendationDecision,
  updateConversation,
  updateStrategyDocument,
} from "@/server/services/strategist";

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
    const conversationId = searchParams.get("conversationId");
    const view = searchParams.get("view") || "bootstrap";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (view === "conversation" && conversationId) {
      const conversation = await getConversationDetail(
        conversationId,
        access.brand.id,
      );
      if (!conversation) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ conversation });
    }

    if (view === "context" && conversationId) {
      const context = await inspectConversationContext({
        brandId: access.brand.id,
        conversationId,
      });
      if (!context) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ context });
    }

    const bootstrap = await getStrategistBootstrap({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      userId: user.id!,
    });

    return NextResponse.json({
      ...bootstrap,
      meta: {
        conversationTypes: STRATEGY_CONVERSATION_TYPES,
        contextSources: CONTEXT_SOURCE_OPTIONS,
        starters: STARTER_SUGGESTIONS,
        followUps: FOLLOW_UP_ACTIONS,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to load strategist." }, { status: 500 });
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

    if (intent === "create_conversation") {
      const conversation = await createConversation({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        title: body.title,
        type: body.type,
        contextSources: body.contextSources,
      });
      return NextResponse.json({ conversation });
    }

    if (intent === "update_conversation") {
      const conversation = await updateConversation({
        conversationId: String(body.conversationId || ""),
        brandId: access.brand.id,
        title: body.title,
        pinned: body.pinned,
        archived: body.archived,
        type: body.type,
        contextSources: body.contextSources,
      });
      if (!conversation) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ conversation });
    }

    if (intent === "send_message") {
      const result = await sendStrategistMessage({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        conversationId: String(body.conversationId || ""),
        question: String(body.question || ""),
        followUpKind: body.followUpKind || null,
        regenerateOfMessageId: body.regenerateOfMessageId || null,
      });
      return NextResponse.json(result);
    }

    if (intent === "save_document") {
      const document = await saveStrategyDocument({
        brandId: access.brand.id,
        userId: user.id!,
        conversationId: String(body.conversationId || ""),
        messageId: body.messageId,
        title: body.title,
      });
      return NextResponse.json({ document });
    }

    if (intent === "update_document") {
      const document = await updateStrategyDocument({
        brandId: access.brand.id,
        documentId: String(body.documentId || ""),
        favorited: body.favorited,
        archived: body.archived,
        sharedInternally: body.sharedInternally,
        duplicate: body.duplicate,
      });
      if (!document) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ document });
    }

    if (intent === "decide_recommendation") {
      const result = await setRecommendationDecision({
        brandId: access.brand.id,
        userId: user.id!,
        recommendationId: String(body.recommendationId || ""),
        status: body.status === "REJECTED" ? "REJECTED" : "ACCEPTED",
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
