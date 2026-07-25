import type {
  Prisma,
  RecommendationDifficulty,
  RecommendationPriority,
  StrategyConversationType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_CONTEXT_SOURCES,
  DEFAULT_TEMPLATES,
  type StrategyConversationTypeKey,
} from "@/lib/strategist";
import { composeContext, runAITask, writeMemory } from "@/server/ai";
import type { ContextProviderKey } from "@/server/ai/context/engine";
import { recordActivity } from "@/server/services/workspace-experience";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function titleFromQuestion(question: string) {
  const trimmed = question.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 72) return trimmed || "New strategy conversation";
  return `${trimmed.slice(0, 69)}…`;
}

function structuredToMarkdown(structured: Record<string, unknown>) {
  const lines: string[] = [];
  const summary = String(structured.executiveSummary || "");
  if (summary) {
    lines.push("## Executive Summary", "", summary, "");
  }
  const findings = Array.isArray(structured.findings) ? structured.findings : [];
  if (findings.length) {
    lines.push("## Findings", "");
    for (const f of findings) lines.push(`- ${String(f)}`);
    lines.push("");
  }
  if (structured.reasoning) {
    lines.push("## Reasoning", "", String(structured.reasoning), "");
  }
  const recs = Array.isArray(structured.recommendations)
    ? structured.recommendations
    : [];
  if (recs.length) {
    lines.push("## Recommendations", "");
    for (const raw of recs) {
      const r = raw as Record<string, unknown>;
      lines.push(`### ${String(r.title || "Recommendation")}`);
      lines.push("");
      lines.push(String(r.body || ""));
      lines.push("");
      lines.push(
        `- Priority: ${String(r.priority || "MEDIUM")}`,
        `- Difficulty: ${String(r.difficulty || "MEDIUM")}`,
        `- Impact: ${String(r.expectedImpact || "—")}`,
        `- Time: ${String(r.estimatedTime || "—")}`,
      );
      lines.push("");
    }
  }
  const risks = Array.isArray(structured.risks) ? structured.risks : [];
  if (risks.length) {
    lines.push("## Risks", "");
    for (const r of risks) lines.push(`- ${String(r)}`);
    lines.push("");
  }
  if (structured.expectedImpact) {
    lines.push("## Expected Impact", "", String(structured.expectedImpact), "");
  }
  const actions = Array.isArray(structured.actionItems)
    ? structured.actionItems
    : [];
  if (actions.length) {
    lines.push("## Action Items", "");
    for (const a of actions) lines.push(`- [ ] ${String(a)}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function mapPriority(value: unknown): RecommendationPriority {
  const v = String(value || "MEDIUM").toUpperCase();
  if (v === "LOW" || v === "HIGH" || v === "CRITICAL") return v;
  return "MEDIUM";
}

function mapDifficulty(value: unknown): RecommendationDifficulty {
  const v = String(value || "MEDIUM").toUpperCase();
  if (v === "EASY" || v === "HARD") return v;
  return "MEDIUM";
}

export async function ensureStrategistTemplates(brandId: string) {
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.strategyTemplate.upsert({
      where: { brandId_key: { brandId, key: t.key } },
      create: {
        brandId,
        key: t.key,
        name: t.name,
        description: t.description,
        conversationType: t.conversationType,
        starterPrompt: t.starterPrompt,
        sortOrder: t.sortOrder,
      },
      update: {
        name: t.name,
        description: t.description,
        starterPrompt: t.starterPrompt,
        sortOrder: t.sortOrder,
      },
    });
  }
}

export async function getStrategistBootstrap(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
}) {
  await ensureStrategistTemplates(input.brandId);

  const [conversations, documents, decisions, memories, templates, brand] =
    await Promise.all([
      prisma.strategyConversation.findMany({
        where: { brandId: input.brandId, archivedAt: null },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        take: 40,
        select: {
          id: true,
          title: true,
          type: true,
          pinned: true,
          confidence: true,
          contextSources: true,
          lastMessageAt: true,
          updatedAt: true,
          createdAt: true,
          _count: { select: { messages: true } },
        },
      }),
      prisma.strategyDocument.findMany({
        where: { brandId: input.brandId, status: "ACTIVE" },
        orderBy: [{ favorited: "desc" }, { updatedAt: "desc" }],
        take: 30,
        select: {
          id: true,
          title: true,
          type: true,
          favorited: true,
          sharedInternally: true,
          conversationId: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      prisma.businessDecision.findMany({
        where: { brandId: input.brandId },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.businessMemory.findMany({
        where: { brandId: input.brandId },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.strategyTemplate.findMany({
        where: { OR: [{ brandId: input.brandId }, { brandId: null }] },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.brand.findUnique({
        where: { id: input.brandId },
        select: {
          id: true,
          name: true,
          industry: true,
          brandVoice: true,
          targetAudience: true,
        },
      }),
    ]);

  return {
    brand,
    conversations,
    documents,
    decisions,
    memories,
    templates,
    defaultContextSources: DEFAULT_CONTEXT_SOURCES,
  };
}

export async function getConversationDetail(conversationId: string, brandId: string) {
  const conversation = await prisma.strategyConversation.findFirst({
    where: { id: conversationId, brandId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      recommendations: {
        include: { actions: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
      documents: {
        where: { status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
    },
  });
  return conversation;
}

export async function createConversation(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  title?: string;
  type?: StrategyConversationTypeKey;
  contextSources?: string[];
}) {
  const type = (input.type || "MARKETING_STRATEGY") as StrategyConversationType;
  const sources =
    (input.contextSources && input.contextSources.length > 0
      ? input.contextSources
      : DEFAULT_CONTEXT_SOURCES) as string[];

  const conversation = await prisma.strategyConversation.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      title: input.title?.trim() || "New strategy conversation",
      type,
      contextSources: sources,
    },
  });

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "STRATEGY_UPDATED",
    title: "Strategist conversation started",
    description: conversation.title,
    meta: { conversationId: conversation.id },
  });

  return conversation;
}

export async function updateConversation(input: {
  conversationId: string;
  brandId: string;
  title?: string;
  pinned?: boolean;
  archived?: boolean;
  type?: StrategyConversationTypeKey;
  contextSources?: string[];
}) {
  const existing = await prisma.strategyConversation.findFirst({
    where: { id: input.conversationId, brandId: input.brandId },
  });
  if (!existing) return null;

  return prisma.strategyConversation.update({
    where: { id: existing.id },
    data: {
      title: input.title?.trim() || undefined,
      pinned: typeof input.pinned === "boolean" ? input.pinned : undefined,
      archivedAt:
        typeof input.archived === "boolean"
          ? input.archived
            ? new Date()
            : null
          : undefined,
      type: input.type as StrategyConversationType | undefined,
      contextSources: input.contextSources,
    },
  });
}

async function persistAdviceResult(input: {
  brandId: string;
  conversationId: string;
  structured: Record<string, unknown>;
  messageId: string;
  contextUsed: string[];
}) {
  const recs = Array.isArray(input.structured.recommendations)
    ? input.structured.recommendations
    : [];
  const created = [];
  for (const raw of recs) {
    const r = raw as Record<string, unknown>;
    const deps = Array.isArray(r.dependencies)
      ? r.dependencies.map((d) => String(d))
      : [];
    const rec = await prisma.recommendation.create({
      data: {
        brandId: input.brandId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        title: String(r.title || "Recommendation").slice(0, 200),
        body: String(r.body || ""),
        priority: mapPriority(r.priority),
        difficulty: mapDifficulty(r.difficulty),
        expectedImpact: r.expectedImpact ? String(r.expectedImpact) : null,
        estimatedTime: r.estimatedTime ? String(r.estimatedTime) : null,
        dependencies: deps,
      },
    });
    const actions = Array.isArray(input.structured.actionItems)
      ? input.structured.actionItems
      : [];
    if (actions.length && created.length === 0) {
      await prisma.recommendationAction.createMany({
        data: actions.slice(0, 8).map((title, idx) => ({
          recommendationId: rec.id,
          title: String(title).slice(0, 240),
          sortOrder: idx,
        })),
      });
    }
    created.push(rec);
  }
  return created;
}

export async function sendStrategistMessage(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  conversationId: string;
  question: string;
  followUpKind?: string | null;
  regenerateOfMessageId?: string | null;
}) {
  const conversation = await prisma.strategyConversation.findFirst({
    where: { id: input.conversationId, brandId: input.brandId },
    include: {
      messages: {
        where: { role: "ASSISTANT" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const question = input.question.trim();
  if (!question) throw new Error("Question required");

  const contextSources = (
    conversation.contextSources.length
      ? conversation.contextSources
      : DEFAULT_CONTEXT_SOURCES
  ) as ContextProviderKey[];

  const priorSummary = conversation.messages[0]
    ? String(
        (conversation.messages[0].structured as Record<string, unknown> | null)
          ?.executiveSummary || conversation.messages[0].content.slice(0, 500),
      )
    : "";

  const userMessage = await prisma.strategyMessage.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: question,
      contextUsed: contextSources,
      followUpKind: input.followUpKind || null,
    },
  });

  if (conversation.title === "New strategy conversation") {
    await prisma.strategyConversation.update({
      where: { id: conversation.id },
      data: { title: titleFromQuestion(question), type: conversation.type },
    });
  }

  const result = await runAITask({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    taskKey: "strategist.advise",
    contextProviders: contextSources,
    input: {
      text: question,
      question,
      conversationType: conversation.type,
      followUpKind: input.followUpKind || undefined,
      priorSummary: priorSummary || undefined,
      regenerate: Boolean(input.regenerateOfMessageId),
    },
  });

  const structured = (result.output || {}) as Record<string, unknown>;
  const markdown = structuredToMarkdown(structured);
  const confidence =
    typeof structured.confidence === "number"
      ? Math.max(0, Math.min(1, structured.confidence))
      : 0.7;

  const assistantMessage = await prisma.strategyMessage.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: markdown,
      structured: asJson(structured),
      contextUsed: contextSources,
      confidence,
      executionId: result.execution.id,
      contextSnapshotId: result.contextSnapshotId || null,
      followUpKind: input.followUpKind || null,
    },
  });

  await persistAdviceResult({
    brandId: input.brandId,
    conversationId: conversation.id,
    structured,
    messageId: assistantMessage.id,
    contextUsed: contextSources,
  });

  await prisma.strategyConversation.update({
    where: { id: conversation.id },
    data: {
      confidence,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await writeMemory({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    scope: "BUSINESS",
    subjectId: conversation.id,
    key: `strategist:${conversation.id}:latest`,
    content: String(structured.executiveSummary || markdown.slice(0, 1000)),
    meta: {
      conversationType: conversation.type,
      confidence,
      contextUsed: contextSources,
    },
  });

  const detail = await getConversationDetail(conversation.id, input.brandId);
  return {
    conversation: detail,
    userMessage,
    assistantMessage: {
      id: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      structured: assistantMessage.structured,
      contextUsed: assistantMessage.contextUsed,
      confidence: assistantMessage.confidence,
      createdAt: assistantMessage.createdAt,
    },
  };
}

export async function inspectConversationContext(input: {
  brandId: string;
  conversationId: string;
}) {
  const conversation = await prisma.strategyConversation.findFirst({
    where: { id: input.conversationId, brandId: input.brandId },
  });
  if (!conversation) return null;
  const providers = (
    conversation.contextSources.length
      ? conversation.contextSources
      : DEFAULT_CONTEXT_SOURCES
  ) as ContextProviderKey[];
  const composed = await composeContext({
    brandId: input.brandId,
    providers,
    taskKey: "strategist.advise",
  });
  return {
    providers,
    payload: composed.payload,
    tokenEstimate: composed.tokenEstimate,
    confidence: conversation.confidence,
  };
}

export async function saveStrategyDocument(input: {
  brandId: string;
  userId: string;
  conversationId: string;
  messageId?: string;
  title?: string;
}) {
  const conversation = await prisma.strategyConversation.findFirst({
    where: { id: input.conversationId, brandId: input.brandId },
    include: {
      messages: {
        where: input.messageId
          ? { id: input.messageId }
          : { role: "ASSISTANT" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!conversation || !conversation.messages[0]) {
    throw new Error("Nothing to save");
  }
  const message = conversation.messages[0];
  const doc = await prisma.strategyDocument.create({
    data: {
      brandId: input.brandId,
      conversationId: conversation.id,
      createdById: input.userId,
      title: input.title?.trim() || conversation.title,
      type: conversation.type,
      contentMd: message.content,
      structured: message.structured ?? undefined,
    },
  });

  await prisma.businessMemory.create({
    data: {
      brandId: input.brandId,
      category: "accepted_strategy",
      key: `document:${doc.id}`,
      content: doc.title,
      meta: asJson({ documentId: doc.id, conversationId: conversation.id }),
    },
  });

  return doc;
}

export async function updateStrategyDocument(input: {
  brandId: string;
  documentId: string;
  favorited?: boolean;
  archived?: boolean;
  sharedInternally?: boolean;
  duplicate?: boolean;
}) {
  const existing = await prisma.strategyDocument.findFirst({
    where: { id: input.documentId, brandId: input.brandId },
  });
  if (!existing) return null;

  if (input.duplicate) {
    return prisma.strategyDocument.create({
      data: {
        brandId: existing.brandId,
        conversationId: existing.conversationId,
        createdById: existing.createdById,
        title: `${existing.title} (copy)`,
        type: existing.type,
        contentMd: existing.contentMd,
        structured: existing.structured ?? undefined,
        favorited: false,
        sharedInternally: false,
      },
    });
  }

  return prisma.strategyDocument.update({
    where: { id: existing.id },
    data: {
      favorited:
        typeof input.favorited === "boolean" ? input.favorited : undefined,
      sharedInternally:
        typeof input.sharedInternally === "boolean"
          ? input.sharedInternally
          : undefined,
      status: input.archived ? "ARCHIVED" : undefined,
    },
  });
}

export async function setRecommendationDecision(input: {
  brandId: string;
  userId: string;
  recommendationId: string;
  status: "ACCEPTED" | "REJECTED";
}) {
  const rec = await prisma.recommendation.findFirst({
    where: { id: input.recommendationId, brandId: input.brandId },
  });
  if (!rec) return null;

  const updated = await prisma.recommendation.update({
    where: { id: rec.id },
    data: { status: input.status },
  });

  const decision = await prisma.businessDecision.create({
    data: {
      brandId: input.brandId,
      conversationId: rec.conversationId,
      recommendationId: rec.id,
      decidedById: input.userId,
      title: rec.title,
      summary: rec.body,
      status: input.status === "ACCEPTED" ? "APPLIED" : "REJECTED",
    },
  });

  await prisma.businessMemory.create({
    data: {
      brandId: input.brandId,
      category:
        input.status === "ACCEPTED" ? "accepted_strategy" : "rejected_idea",
      key: `recommendation:${rec.id}`,
      content: `${rec.title}: ${rec.body.slice(0, 500)}`,
      meta: asJson({
        recommendationId: rec.id,
        decisionId: decision.id,
        status: input.status,
      }),
    },
  });

  if (input.status === "ACCEPTED") {
    await writeMemory({
      workspaceId: (
        await prisma.brand.findUniqueOrThrow({
          where: { id: input.brandId },
          select: { workspaceId: true },
        })
      ).workspaceId,
      brandId: input.brandId,
      scope: "BUSINESS",
      subjectId: decision.id,
      key: `decision:${decision.id}`,
      content: decision.summary,
      meta: { title: decision.title, status: decision.status },
    });
  }

  return { recommendation: updated, decision };
}
