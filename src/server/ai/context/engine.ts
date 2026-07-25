import { prisma } from "@/lib/db";

export type ContextProviderKey =
  | "business_brain"
  | "marketing_strategy"
  | "connected_channels"
  | "campaign"
  | "conversation"
  | "customer"
  | "brand_voice"
  | "knowledge_base"
  | "content_history"
  | "analytics_summary";

export type ContextRequest = {
  brandId: string;
  providers: ContextProviderKey[];
  taskKey?: string;
};

async function loadProvider(brandId: string, key: ContextProviderKey) {
  switch (key) {
    case "business_brain": {
      const brain = await prisma.businessBrain.findUnique({
        where: { brandId },
        include: {
          voice: true,
          answers: {
            take: 12,
            orderBy: { updatedAt: "desc" },
            where: { deletedAt: null },
            select: {
              value: true,
              question: { select: { key: true } },
            },
          },
        },
      });
      return {
        key,
        data: brain
          ? {
              completionPercent: brain.completionPercent,
              score: brain.score,
              version: brain.version,
              voiceTone: brain.voice?.toneOfVoice || null,
              recentAnswers: brain.answers.map((a) => ({
                questionKey: a.question.key,
                value: a.value.slice(0, 280),
              })),
            }
          : null,
      };
    }
    case "marketing_strategy": {
      const strategy = await prisma.marketingStrategy.findUnique({
        where: { brandId },
        include: {
          _count: { select: { personas: true, competitors: true, pillars: true } },
        },
      });
      return {
        key,
        data: strategy
          ? {
              id: strategy.id,
              goals: strategy.goals,
              tone: strategy.tone,
              preferredPlatforms: strategy.preferredPlatforms,
              contentTypes: strategy.contentTypes,
              currentStage: strategy.currentStage,
              nextStep: strategy.nextStep,
              personaCount: strategy._count.personas,
              competitorCount: strategy._count.competitors,
              pillarCount: strategy._count.pillars,
              updatedAt: strategy.updatedAt,
            }
          : null,
      };
    }
    case "connected_channels": {
      const accounts = await prisma.connectedAccount.findMany({
        where: { brandId, disconnectedAt: null },
        select: { product: true, platform: true, health: true, username: true },
      });
      return { key, data: accounts };
    }
    case "campaign": {
      const campaigns = await prisma.campaign.findMany({
        where: { brandId },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, status: true, objective: true },
      });
      return { key, data: campaigns };
    }
    case "conversation": {
      const count = await prisma.conversation.count({ where: { brandId } });
      return { key, data: { openConversations: count } };
    }
    case "customer": {
      const count = await prisma.contact.count({ where: { brandId } });
      return { key, data: { contacts: count } };
    }
    case "brand_voice": {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { brandVoice: true, name: true, industry: true },
      });
      return { key, data: brand };
    }
    case "knowledge_base": {
      const docs = await prisma.knowledgeDocument.count({ where: { brandId } });
      return { key, data: { documents: docs } };
    }
    case "content_history": {
      const items = await prisma.contentItem.findMany({
        where: { brandId, deletedAt: null },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, status: true, platform: true },
      });
      return { key, data: items };
    }
    case "analytics_summary": {
      const kpis = await prisma.kpi.findMany({
        where: { brandId },
        take: 8,
        orderBy: { sortOrder: "asc" },
      });
      return {
        key,
        data: kpis.map((k) => ({
          key: k.metricKey,
          value: k.currentValue,
          changePct: k.changePct,
        })),
      };
    }
    default:
      return { key, data: null };
  }
}

/** Compose only requested context slices for a task. */
export async function composeContext(req: ContextRequest) {
  const parts = [];
  for (const provider of req.providers) {
    parts.push(await loadProvider(req.brandId, provider));
  }
  const payload = Object.fromEntries(parts.map((p) => [p.key, p.data]));
  const serialized = JSON.stringify(payload);
  const snapshot = await prisma.contextSnapshot.create({
    data: {
      brandId: req.brandId,
      taskKey: req.taskKey,
      providers: req.providers,
      payload,
      tokenEstimate: Math.ceil(serialized.length / 4),
    },
  });
  return { snapshot, payload, tokenEstimate: snapshot.tokenEstimate };
}
