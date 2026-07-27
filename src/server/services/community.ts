import type {
  CommunityResponseMode,
  CommunityTone,
  ConversationIntentType,
  Prisma,
  SuggestedReplyKind,
  SuggestedReplyStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_AUTO_RULES } from "@/lib/community";
import { runAITask } from "@/server/ai";
import { recordActivity } from "@/server/services/workspace-experience";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function clamp(n: unknown, fallback = 70) {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(100, v));
}

function mapIntent(value: unknown): ConversationIntentType {
  const v = String(value || "OTHER").toUpperCase();
  const allowed: ConversationIntentType[] = [
    "QUESTION",
    "COMPLAINT",
    "SALES_LEAD",
    "SUPPORT",
    "COMPLIMENT",
    "SPAM",
    "VIP",
    "RETURNING",
    "INFLUENCER",
    "OTHER",
  ];
  return allowed.includes(v as ConversationIntentType)
    ? (v as ConversationIntentType)
    : "OTHER";
}

function mapKind(value: unknown): SuggestedReplyKind {
  const v = String(value || "REPLY").toUpperCase();
  const allowed: SuggestedReplyKind[] = [
    "REPLY",
    "FOLLOW_UP",
    "OFFER",
    "DISCOUNT",
    "CTA",
    "KNOWLEDGE",
    "ESCALATE",
  ];
  return allowed.includes(v as SuggestedReplyKind)
    ? (v as SuggestedReplyKind)
    : "REPLY";
}

export async function ensureCommunitySetup(input: {
  workspaceId: string;
  brandId: string;
}) {
  await prisma.communityRule.upsert({
    where: { brandId: input.brandId },
    create: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      responseMode: "APPROVAL_REQUIRED",
      tone: "FRIENDLY",
      autoCategories: ["QUESTION", "COMPLIMENT"],
    },
    update: {},
  });

  for (const rule of DEFAULT_AUTO_RULES) {
    const existing = await prisma.autoReplyRule.findFirst({
      where: {
        brandId: input.brandId,
        intentType: rule.intentType,
        name: rule.name,
      },
    });
    if (!existing) {
      await prisma.autoReplyRule.create({
        data: {
          brandId: input.brandId,
          name: rule.name,
          intentType: rule.intentType,
          enabled: true,
          autoSend: false,
          template: rule.template,
        },
      });
    }
  }
}

/** Seed a few demo conversations when inbox is empty so CM can be demonstrated. */
async function ensureDemoInbox(brandId: string) {
  const count = await prisma.conversation.count({ where: { brandId } });
  if (count > 0) return;

  const samples = [
    {
      name: "سارا م.",
      body: "سلام! ارسال بین‌المللی دارید و معمولاً تحویل چقدر طول می‌کشد؟",
      subject: "سؤال درباره ارسال",
    },
    {
      name: "الکساندر چن",
      body: "به پلن پرمیوم برای تیمم علاقه‌مندم — می‌توانید گزینه‌های قیمت را بفرستید؟",
      subject: "علاقه به قیمت‌گذاری",
    },
    {
      name: "جردن لی",
      body: "سفارش قبلی‌ام آسیب‌دیده رسید. خیلی ناامیدم — لطفاً کمک کنید.",
      subject: "مشکل سفارش",
    },
    {
      name: "مشتری VIP",
      body: "کالکشن جدید عالی بود. می‌توانم دسترسی زودهنگام به دراپ بعدی داشته باشم؟",
      subject: "درخواست VIP",
      tags: ["vip"],
    },
  ];

  for (const s of samples) {
    const contact = await prisma.contact.create({
      data: {
        brandId,
        name: s.name,
        tags: s.tags || [],
        leadStatus: s.body.includes("pricing") ? "lead" : null,
      },
    });
    const conversation = await prisma.conversation.create({
      data: {
        brandId,
        contactId: contact.id,
        subject: s.subject,
        status: "OPEN",
        isUnread: true,
        unreadCount: 1,
        lastMessageAt: new Date(),
      },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        body: s.body,
        direction: "INBOUND",
        kind: "TEXT",
        deliveryStatus: "DELIVERED",
      },
    });
  }
}

const queueInclude = {
  contact: true,
  channel: true,
  assignee: { select: { id: true, name: true, email: true } },
  intent: true,
  priority: true,
  sentiment: true,
  suggestedReplies: {
    where: {
      status: {
        in: ["DRAFT", "PENDING_APPROVAL", "AUTO_QUEUED"] as SuggestedReplyStatus[],
      },
    },
    orderBy: { createdAt: "desc" as const },
    take: 6,
  },
  messages: { orderBy: { createdAt: "desc" as const }, take: 8 },
};

export async function getCommunityBootstrap(input: {
  workspaceId: string;
  brandId: string;
}) {
  await ensureCommunitySetup(input);
  await ensureDemoInbox(input.brandId);

  const [rule, autoRules, queue, pendingReplies, members] = await Promise.all([
    prisma.communityRule.findUnique({ where: { brandId: input.brandId } }),
    prisma.autoReplyRule.findMany({
      where: { brandId: input.brandId },
      orderBy: { name: "asc" },
    }),
    prisma.conversation.findMany({
      where: {
        brandId: input.brandId,
        status: { in: ["OPEN", "WAITING"] },
      },
      include: queueInclude,
      orderBy: { lastMessageAt: "desc" },
      take: 60,
    }),
    prisma.suggestedReply.findMany({
      where: {
        brandId: input.brandId,
        status: { in: ["PENDING_APPROVAL", "AUTO_QUEUED", "DRAFT"] },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        conversation: {
          select: { id: true, subject: true, contact: { select: { name: true } } },
        },
      },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: input.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const sorted = [...queue].sort(
    (a, b) => (b.priority?.score || 0) - (a.priority?.score || 0),
  );

  const now = Date.now();
  const resolvedToday = await prisma.conversation.count({
    where: {
      brandId: input.brandId,
      status: { in: ["RESOLVED", "CLOSED"] },
      updatedAt: { gte: new Date(now - 86400000) },
    },
  });

  const negative = sorted.filter(
    (c) => c.sentiment?.label === "negative" || c.priority?.negativeSentiment,
  );
  const vipQueue = sorted.filter((c) => c.priority?.vip || c.intent?.type === "VIP");
  const leads = sorted.filter((c) => c.intent?.type === "SALES_LEAD");

  const unanswered = sorted.filter((c) => {
    const last = c.messages[0];
    return last?.direction === "INBOUND";
  });

  // Rough avg response: conversations with outbound after inbound
  let responseSum = 0;
  let responseN = 0;
  for (const c of sorted) {
    const msgs = [...c.messages].reverse();
    for (let i = 0; i < msgs.length - 1; i++) {
      if (msgs[i].direction === "INBOUND" && msgs[i + 1]?.direction === "OUTBOUND") {
        responseSum +=
          new Date(msgs[i + 1].createdAt).getTime() -
          new Date(msgs[i].createdAt).getTime();
        responseN += 1;
        break;
      }
    }
  }

  return {
    rule,
    autoRules,
    queue: sorted,
    pendingReplies,
    members: members.map((m) => m.user),
    dashboard: {
      inboxHealth: Math.max(
        0,
        100 - unanswered.length * 6 - negative.length * 8,
      ),
      averageResponseMinutes:
        responseN > 0 ? Math.round(responseSum / responseN / 60000) : null,
      pendingReplies: pendingReplies.length,
      vipQueue: vipQueue.length,
      negativeSentiment: negative.length,
      resolvedToday,
      leadOpportunities: leads.length,
      unanswered: unanswered.length,
    },
    segments: {
      vip: vipQueue,
      negative,
      leads,
      unanswered,
    },
  };
}

async function learningSignals(brandId: string) {
  const recent = await prisma.suggestedReply.findMany({
    where: {
      brandId,
      status: { in: ["APPROVED", "EDITED", "REJECTED", "SENT"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { status: true, kind: true, body: true, editedBody: true },
  });
  return {
    approved: recent.filter((r) => r.status === "APPROVED" || r.status === "SENT").length,
    edited: recent.filter((r) => r.status === "EDITED").length,
    rejected: recent.filter((r) => r.status === "REJECTED").length,
    samples: recent.slice(0, 8).map((r) => ({
      status: r.status,
      kind: r.kind,
      body: (r.editedBody || r.body).slice(0, 180),
    })),
  };
}

export async function scanCommunityInbox(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  conversationIds?: string[];
  language?: string;
}) {
  await ensureCommunitySetup(input);
  await ensureDemoInbox(input.brandId);

  const rule = await prisma.communityRule.findUniqueOrThrow({
    where: { brandId: input.brandId },
  });

  const conversations = await prisma.conversation.findMany({
    where: {
      brandId: input.brandId,
      status: { in: ["OPEN", "WAITING"] },
      ...(input.conversationIds?.length
        ? { id: { in: input.conversationIds } }
        : {}),
    },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 12 },
    },
    take: 20,
    orderBy: { lastMessageAt: "desc" },
  });

  if (!conversations.length) {
    return getCommunityBootstrap(input);
  }

  const payload = conversations.map((c) => ({
    id: c.id,
    subject: c.subject,
    contact: {
      name: c.contact.name,
      tags: c.contact.tags,
      leadStatus: c.contact.leadStatus,
    },
    agingHours:
      (Date.now() - new Date(c.lastMessageAt).getTime()) / 3600000,
    unanswered: c.messages[0]?.direction === "INBOUND",
    messages: [...c.messages]
      .reverse()
      .map((m) => ({
        direction: m.direction,
        body: m.body.slice(0, 500),
        at: m.createdAt,
      })),
  }));

  const learning = await learningSignals(input.brandId);

  const result = await runAITask({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    taskKey: "community.assist",
    input: {
      text: "Analyze inbox conversations for community management",
      conversations: payload,
      tone: rule.tone,
      responseMode: rule.responseMode,
      learningSignals: learning,
      language: input.language || "en",
    },
  });

  const output = (result.output || {}) as Record<string, unknown>;
  const results = Array.isArray(output.results) ? output.results : [];
  const byId = new Map(conversations.map((c) => [c.id, c]));

  // Mock may return demo-ids — map by index as fallback
  for (let i = 0; i < results.length; i++) {
    const raw = results[i] as Record<string, unknown>;
    let conversation = byId.get(String(raw.conversationId || ""));
    if (!conversation) conversation = conversations[i];
    if (!conversation) continue;

    const intent = (raw.intent || {}) as Record<string, unknown>;
    const priority = (raw.priority || {}) as Record<string, unknown>;
    const sentiment = (raw.sentiment || {}) as Record<string, unknown>;
    const profile = (raw.profile || {}) as Record<string, unknown>;
    const suggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];
    const hints = Array.isArray(raw.automationHints) ? raw.automationHints : [];

    const intentType = mapIntent(intent.type);

    await prisma.conversationIntent.upsert({
      where: { conversationId: conversation.id },
      create: {
        conversationId: conversation.id,
        type: intentType,
        confidence: Number(intent.confidence || 0.6),
        labels: Array.isArray(intent.labels)
          ? intent.labels.map((l) => String(l))
          : [],
        explanation: intent.explanation ? String(intent.explanation) : null,
      },
      update: {
        type: intentType,
        confidence: Number(intent.confidence || 0.6),
        labels: Array.isArray(intent.labels)
          ? intent.labels.map((l) => String(l))
          : [],
        explanation: intent.explanation ? String(intent.explanation) : null,
      },
    });

    await prisma.conversationPriority.upsert({
      where: { conversationId: conversation.id },
      create: {
        conversationId: conversation.id,
        score: clamp(priority.score, 50),
        rankReason: String(priority.rankReason || "Prioritized by inbox intelligence."),
        vip: Boolean(priority.vip),
        urgent: Boolean(priority.urgent),
        revenuePotential: clamp(priority.revenuePotential, 0),
        unanswered: Boolean(priority.unanswered),
        negativeSentiment: Boolean(priority.negativeSentiment),
        agingHours: Number(priority.agingHours || 0),
      },
      update: {
        score: clamp(priority.score, 50),
        rankReason: String(priority.rankReason || "Prioritized by inbox intelligence."),
        vip: Boolean(priority.vip),
        urgent: Boolean(priority.urgent),
        revenuePotential: clamp(priority.revenuePotential, 0),
        unanswered: Boolean(priority.unanswered),
        negativeSentiment: Boolean(priority.negativeSentiment),
        agingHours: Number(priority.agingHours || 0),
      },
    });

    await prisma.sentimentAnalysis.upsert({
      where: { conversationId: conversation.id },
      create: {
        conversationId: conversation.id,
        label: String(sentiment.label || "neutral"),
        score: clamp(sentiment.score, 50),
        buyingIntent: clamp(sentiment.buyingIntent, 0),
        urgency: clamp(sentiment.urgency, 0),
        satisfaction: clamp(sentiment.satisfaction, 50),
        spamProbability: clamp(sentiment.spamProbability, 0),
        salesOpportunity: clamp(sentiment.salesOpportunity, 0),
        retentionRisk: clamp(sentiment.retentionRisk, 0),
        explanation: sentiment.explanation ? String(sentiment.explanation) : null,
      },
      update: {
        label: String(sentiment.label || "neutral"),
        score: clamp(sentiment.score, 50),
        buyingIntent: clamp(sentiment.buyingIntent, 0),
        urgency: clamp(sentiment.urgency, 0),
        satisfaction: clamp(sentiment.satisfaction, 50),
        spamProbability: clamp(sentiment.spamProbability, 0),
        salesOpportunity: clamp(sentiment.salesOpportunity, 0),
        retentionRisk: clamp(sentiment.retentionRisk, 0),
        explanation: sentiment.explanation ? String(sentiment.explanation) : null,
      },
    });

    await prisma.customerProfile.upsert({
      where: { contactId: conversation.contactId },
      create: {
        brandId: input.brandId,
        contactId: conversation.contactId,
        isVip: Boolean(profile.isVip) || intentType === "VIP",
        isInfluencer: Boolean(profile.isInfluencer),
        isReturning: Boolean(profile.isReturning),
        summary: profile.summary ? String(profile.summary) : null,
        tags: Array.isArray(profile.tags)
          ? profile.tags.map((t) => String(t))
          : [],
      },
      update: {
        isVip: Boolean(profile.isVip) || intentType === "VIP",
        isInfluencer: Boolean(profile.isInfluencer),
        isReturning: Boolean(profile.isReturning),
        summary: profile.summary ? String(profile.summary) : null,
        tags: Array.isArray(profile.tags)
          ? profile.tags.map((t) => String(t))
          : [],
      },
    });

    await prisma.conversationMemory.create({
      data: {
        conversationId: conversation.id,
        contactId: conversation.contactId,
        key: `scan:${Date.now()}`,
        content: String(
          intent.explanation ||
            sentiment.explanation ||
            "Community scan snapshot",
        ),
        meta: asJson({ intentType, hints }),
      },
    });

    // Clear old drafts for fresh suggestions
    await prisma.suggestedReply.deleteMany({
      where: {
        conversationId: conversation.id,
        status: { in: ["DRAFT", "PENDING_APPROVAL", "AUTO_QUEUED"] },
      },
    });

    const canAutoQueue =
      (rule.responseMode === "SEMI_AUTOMATIC" &&
        rule.autoCategories.includes(intentType)) ||
      (rule.responseMode === "AUTOMATIC" &&
        (
          await prisma.autoReplyRule.findFirst({
            where: {
              brandId: input.brandId,
              intentType,
              enabled: true,
              autoSend: true,
            },
          })
        ) != null);

    for (const s of suggestions.slice(0, 4)) {
      const row = s as Record<string, unknown>;
      const quality = (row.quality || {}) as Record<string, unknown>;
      const status: SuggestedReplyStatus =
        rule.responseMode === "MANUAL"
          ? "DRAFT"
          : canAutoQueue && mapKind(row.kind) === "REPLY"
            ? "AUTO_QUEUED"
            : "PENDING_APPROVAL";

      // NEVER auto-send outside approved rules — AUTO_QUEUED still needs human send unless AUTOMATIC+autoSend
      await prisma.suggestedReply.create({
        data: {
          brandId: input.brandId,
          conversationId: conversation.id,
          kind: mapKind(row.kind),
          status,
          body: String(row.body || "").slice(0, 4000),
          tone: rule.tone,
          confidence: Number(row.confidence || 0.7),
          qualityScore: clamp(quality.overall, 70),
          qualityBreakdown: asJson(quality),
          explanation: row.explanation ? String(row.explanation) : null,
        },
      });
    }

    // Automation side-effects (safe, non-sending)
    for (const h of hints) {
      const hint = h as Record<string, unknown>;
      const action = String(hint.action || "");
      if (action.includes("CRM") || action.includes("Contact")) {
        await prisma.contact.update({
          where: { id: conversation.contactId },
          data: {
            leadStatus: "lead",
            tags: Array.from(
              new Set([...(conversation.contact.tags || []), "lead"]),
            ),
          },
        });
      }
      if (action.includes("Escalate") || action.includes("Notify")) {
        await prisma.internalNote.create({
          data: {
            brandId: input.brandId,
            conversationId: conversation.id,
            contactId: conversation.contactId,
            userId: input.userId,
            body: `Community Manager: ${action} — ${String(hint.rule || intentType)}`,
          },
        });
      }
    }
  }

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "SYSTEM",
    title: `Community inbox scanned · ${conversations.length} threads`,
  });

  return getCommunityBootstrap(input);
}

export async function updateCommunitySettings(input: {
  brandId: string;
  responseMode?: CommunityResponseMode;
  tone?: CommunityTone;
  autoCategories?: string[];
  enabled?: boolean;
}) {
  return prisma.communityRule.update({
    where: { brandId: input.brandId },
    data: {
      responseMode: input.responseMode,
      tone: input.tone,
      autoCategories: input.autoCategories,
      enabled: input.enabled,
    },
  });
}

export async function updateAutoReplyRule(input: {
  brandId: string;
  ruleId: string;
  enabled?: boolean;
  autoSend?: boolean;
  template?: string;
}) {
  const rule = await prisma.autoReplyRule.findFirst({
    where: { id: input.ruleId, brandId: input.brandId },
  });
  if (!rule) return null;
  // Guard: autoSend only meaningful when explicitly enabled by user
  return prisma.autoReplyRule.update({
    where: { id: rule.id },
    data: {
      enabled: input.enabled,
      autoSend: input.autoSend,
      template: input.template,
    },
  });
}

export async function reviewSuggestedReply(input: {
  brandId: string;
  userId: string;
  replyId: string;
  action: "approve" | "reject" | "edit_send";
  editedBody?: string;
}) {
  const reply = await prisma.suggestedReply.findFirst({
    where: { id: input.replyId, brandId: input.brandId },
    include: { conversation: true },
  });
  if (!reply) return null;

  if (input.action === "reject") {
    return prisma.suggestedReply.update({
      where: { id: reply.id },
      data: {
        status: "REJECTED",
        reviewedById: input.userId,
        reviewedAt: new Date(),
      },
    });
  }

  const body =
    input.action === "edit_send" && input.editedBody?.trim()
      ? input.editedBody.trim()
      : reply.body;

  // Send into conversation (inbox integration) — still not Meta API
  await prisma.message.create({
    data: {
      conversationId: reply.conversationId,
      body,
      direction: "OUTBOUND",
      kind: "TEXT",
      deliveryStatus: "SENT",
      authorId: input.userId,
      meta: asJson({
        source: "community_manager",
        suggestedReplyId: reply.id,
        confidence: reply.confidence,
      }),
    },
  });

  await prisma.conversation.update({
    where: { id: reply.conversationId },
    data: {
      isUnread: false,
      unreadCount: 0,
      lastMessageAt: new Date(),
      status:
        reply.conversation.status === "OPEN"
          ? "WAITING"
          : reply.conversation.status,
    },
  });

  return prisma.suggestedReply.update({
    where: { id: reply.id },
    data: {
      status: input.action === "edit_send" ? "EDITED" : "SENT",
      editedBody: input.action === "edit_send" ? body : null,
      reviewedById: input.userId,
      reviewedAt: new Date(),
    },
  });
}

export async function collaborateOnConversation(input: {
  brandId: string;
  userId: string;
  conversationId: string;
  assigneeId?: string | null;
  note?: string;
  status?: "OPEN" | "WAITING" | "RESOLVED" | "CLOSED";
  mention?: string;
}) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, brandId: input.brandId },
  });
  if (!conversation) return null;

  if (input.assigneeId !== undefined) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { assigneeId: input.assigneeId },
    });
    if (input.assigneeId) {
      await prisma.assignment.create({
        data: {
          conversationId: conversation.id,
          userId: input.assigneeId,
          assignedById: input.userId,
        },
      });
    }
  }

  if (input.status) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: input.status },
    });
  }

  if (input.note || input.mention) {
    const body = [
      input.note,
      input.mention ? `@${input.mention}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    await prisma.internalNote.create({
      data: {
        brandId: input.brandId,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        userId: input.userId,
        body,
      },
    });
  }

  return prisma.conversation.findFirst({
    where: { id: conversation.id },
    include: queueInclude,
  });
}
