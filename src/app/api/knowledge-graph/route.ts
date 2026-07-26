import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  NODE_KINDS,
  RELATION_STRENGTHS,
  RELATION_TYPES,
} from "@/lib/knowledge-graph";
import {
  connectKnowledgeNodes,
  disconnectKnowledgeNodes,
  ensureKnowledgeGraph,
  findRelatedByKind,
  getEventKnowledge,
  getKnowledgeNodeDetail,
  linkEventToKnowledge,
  listKnowledgeMeta,
  mergeKnowledgeNodes,
  previewEventGraph,
  searchKnowledgeNodes,
  splitKnowledgeNode,
  unlinkEventKnowledge,
  updateEventPreparation,
  updateKnowledgeRelation,
  upsertKnowledgeNode,
} from "@/server/services/knowledge-graph";

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
    const view = searchParams.get("view") || "search";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (view === "meta") {
      const meta = await listKnowledgeMeta();
      return NextResponse.json({
        ...meta,
        strengths: RELATION_STRENGTHS,
        kinds: NODE_KINDS,
        relationTypeSeeds: RELATION_TYPES,
      });
    }

    if (view === "detail") {
      const id = searchParams.get("id") || searchParams.get("key") || "";
      const kind = searchParams.get("kind") || undefined;
      const node = await getKnowledgeNodeDetail(id, kind);
      if (!node) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ node });
    }

    if (view === "related") {
      const nodeId = searchParams.get("nodeId") || "";
      const related = await findRelatedByKind({
        nodeId,
        kind: searchParams.get("kind") || undefined,
        limit: Number(searchParams.get("limit") || 40),
      });
      return NextResponse.json({ related });
    }

    if (view === "event") {
      const eventId = searchParams.get("eventId") || "";
      const links = await getEventKnowledge(eventId);
      return NextResponse.json({ links });
    }

    if (view === "preview") {
      const eventId = searchParams.get("eventId") || "";
      const preview = await previewEventGraph(eventId);
      return NextResponse.json(preview);
    }

    const nodes = await searchKnowledgeNodes({
      q: searchParams.get("q") || undefined,
      kind: searchParams.get("kind") || undefined,
      limit: Number(searchParams.get("limit") || 50),
    });
    return NextResponse.json({ nodes });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load knowledge graph." },
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

    if (intent === "ensure") {
      const stats = await ensureKnowledgeGraph();
      return NextResponse.json({ ok: true, stats });
    }

    if (intent === "upsert_node") {
      const node = await upsertKnowledgeNode(body.node || body);
      return NextResponse.json({ node });
    }

    if (intent === "connect") {
      const relation = await connectKnowledgeNodes({
        fromNodeId: String(body.fromNodeId || ""),
        toNodeId: String(body.toNodeId || ""),
        typeKey: body.typeKey,
        strength: body.strength,
        note: body.note,
      });
      return NextResponse.json({ relation });
    }

    if (intent === "disconnect") {
      const result = await disconnectKnowledgeNodes({
        fromNodeId: String(body.fromNodeId || ""),
        toNodeId: String(body.toNodeId || ""),
        typeKey: body.typeKey,
      });
      return NextResponse.json(result);
    }

    if (intent === "edit_relation") {
      const relation = await updateKnowledgeRelation({
        id: String(body.id || ""),
        strength: body.strength,
        note: body.note,
        typeKey: body.typeKey,
      });
      return NextResponse.json({ relation });
    }

    if (intent === "merge") {
      const node = await mergeKnowledgeNodes({
        keepId: String(body.keepId || ""),
        mergeIds: Array.isArray(body.mergeIds) ? body.mergeIds.map(String) : [],
      });
      if (!node) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ node });
    }

    if (intent === "split") {
      const node = await splitKnowledgeNode({
        nodeId: String(body.nodeId || ""),
        name: String(body.name || ""),
        kind: body.kind,
      });
      if (!node) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ node });
    }

    if (intent === "link_event") {
      const link = await linkEventToKnowledge({
        eventId: String(body.eventId || ""),
        nodeId: String(body.nodeId || ""),
        typeKey: body.typeKey,
        strength: body.strength,
        note: body.note,
      });
      return NextResponse.json({ link });
    }

    if (intent === "unlink_event") {
      const result = await unlinkEventKnowledge({
        eventId: String(body.eventId || ""),
        nodeId: String(body.nodeId || ""),
      });
      return NextResponse.json(result);
    }

    if (intent === "preparation") {
      const event = await updateEventPreparation({
        eventId: String(body.eventId || ""),
        preparationDays: body.preparationDays,
        planningWindowDays: body.planningWindowDays,
        publishingWindowDays: body.publishingWindowDays,
        reminderOffsets: body.reminderOffsets,
        expirationDays: body.expirationDays,
      });
      return NextResponse.json({ event });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: 500 },
    );
  }
}
