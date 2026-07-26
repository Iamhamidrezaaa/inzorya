import type {
  KnowledgeNodeKind,
  KnowledgeStrength,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  NODE_KINDS,
  RELATION_TYPES,
  SEED_AUDIENCES,
  SEED_BUSINESS_TYPES,
  SEED_CAMPAIGN_TYPES,
  SEED_CHANNELS,
  SEED_CONTENT_TYPES,
  SEED_CTAS,
  SEED_INDUSTRIES,
  SEED_OBJECTIVES,
  SEED_PRODUCT_CATEGORIES,
  SEED_TONES,
  slugifyKnowledgeKey,
} from "@/lib/knowledge-graph";

function parseStrength(raw: unknown): KnowledgeStrength {
  const key = String(raw || "MEDIUM").toUpperCase();
  if (
    ["VERY_WEAK", "WEAK", "MEDIUM", "STRONG", "VERY_STRONG"].includes(key)
  ) {
    return key as KnowledgeStrength;
  }
  return "MEDIUM";
}

function parseKind(raw: unknown): KnowledgeNodeKind {
  const key = String(raw || "CUSTOM").toUpperCase();
  if (NODE_KINDS.some((k) => k.key === key)) return key as KnowledgeNodeKind;
  return "CUSTOM";
}

async function upsertNode(input: {
  kind: KnowledgeNodeKind;
  key: string;
  name: string;
  description?: string | null;
  parentKey?: string | null;
  parentKind?: KnowledgeNodeKind;
  meta?: Record<string, unknown>;
}) {
  let parentId: string | null = null;
  if (input.parentKey) {
    const parent = await prisma.knowledgeNode.findUnique({
      where: {
        kind_key: {
          kind: input.parentKind || input.kind,
          key: input.parentKey,
        },
      },
    });
    parentId = parent?.id || null;
  }

  return prisma.knowledgeNode.upsert({
    where: { kind_key: { kind: input.kind, key: input.key } },
    create: {
      kind: input.kind,
      key: input.key,
      name: input.name,
      description: input.description || null,
      parentId,
      meta: (input.meta || undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      name: input.name,
      description: input.description || null,
      parentId,
      active: true,
    },
  });
}

export async function ensureKnowledgeGraph() {
  for (const t of RELATION_TYPES) {
    await prisma.knowledgeRelationType.upsert({
      where: { key: t.key },
      create: { key: t.key, name: t.name },
      update: { name: t.name },
    });
  }

  for (const name of SEED_INDUSTRIES) {
    const key = slugifyKnowledgeKey(name);
    await prisma.industry.upsert({
      where: { key },
      create: { key, name },
      update: { name },
    });
    await upsertNode({ kind: "INDUSTRY", key, name });
  }

  for (const bt of SEED_BUSINESS_TYPES) {
    const industry = await prisma.industry.findUnique({
      where: { key: bt.industry },
    });
    let parentId: string | null = null;
    if (bt.parent) {
      const parent = await prisma.businessType.findUnique({
        where: { key: bt.parent },
      });
      parentId = parent?.id || null;
    }
    await prisma.businessType.upsert({
      where: { key: bt.key },
      create: {
        key: bt.key,
        name: bt.name,
        industryId: industry?.id || null,
        parentId,
      },
      update: {
        name: bt.name,
        industryId: industry?.id || null,
        parentId,
      },
    });
    await upsertNode({
      kind: "BUSINESS_TYPE",
      key: bt.key,
      name: bt.name,
      parentKey: bt.parent || null,
      parentKind: "BUSINESS_TYPE",
      meta: { industry: bt.industry },
    });

    // Industry → Business Type relation
    const industryNode = await prisma.knowledgeNode.findUnique({
      where: { kind_key: { kind: "INDUSTRY", key: bt.industry } },
    });
    const typeNode = await prisma.knowledgeNode.findUnique({
      where: { kind_key: { kind: "BUSINESS_TYPE", key: bt.key } },
    });
    const relType = await prisma.knowledgeRelationType.findUnique({
      where: { key: "has_business_type" },
    });
    if (industryNode && typeNode && relType) {
      await prisma.knowledgeRelation.upsert({
        where: {
          fromNodeId_toNodeId_typeId: {
            fromNodeId: industryNode.id,
            toNodeId: typeNode.id,
            typeId: relType.id,
          },
        },
        create: {
          fromNodeId: industryNode.id,
          toNodeId: typeNode.id,
          typeId: relType.id,
          strength: "STRONG",
        },
        update: { strength: "STRONG" },
      });
    }
  }

  for (const p of SEED_PRODUCT_CATEGORIES) {
    await prisma.productCategory.upsert({
      where: { key: p.key },
      create: {
        key: p.key,
        name: p.name,
        kind: p.kind,
        parentId: null,
      },
      update: { name: p.name, kind: p.kind },
    });
  }
  // Second pass for parents
  for (const p of SEED_PRODUCT_CATEGORIES) {
    if (!("parent" in p) || !p.parent) continue;
    const parent = await prisma.productCategory.findUnique({
      where: { key: p.parent },
    });
    if (!parent) continue;
    await prisma.productCategory.update({
      where: { key: p.key },
      data: { parentId: parent.id },
    });
  }
  for (const p of SEED_PRODUCT_CATEGORIES) {
    await upsertNode({
      kind: "PRODUCT_CATEGORY",
      key: p.key,
      name: p.name,
      parentKey: "parent" in p ? p.parent || null : null,
      parentKind: "PRODUCT_CATEGORY",
      meta: { kind: p.kind },
    });
  }

  const simpleSeed = async (
    kind: KnowledgeNodeKind,
    names: readonly string[],
    table:
      | "audience"
      | "campaignType"
      | "marketingObjective"
      | "contentType"
      | "distributionChannel"
      | "cTA"
      | "emotionalTone",
  ) => {
    for (const name of names) {
      const key = slugifyKnowledgeKey(name);
      if (table === "audience") {
        await prisma.audience.upsert({
          where: { key },
          create: { key, name },
          update: { name },
        });
      } else if (table === "campaignType") {
        await prisma.campaignType.upsert({
          where: { key },
          create: { key, name },
          update: { name },
        });
      } else if (table === "marketingObjective") {
        await prisma.marketingObjective.upsert({
          where: { key },
          create: { key, name },
          update: { name },
        });
      } else if (table === "contentType") {
        await prisma.contentType.upsert({
          where: { key },
          create: { key, name },
          update: { name },
        });
      } else if (table === "distributionChannel") {
        await prisma.distributionChannel.upsert({
          where: { key },
          create: { key, name },
          update: { name },
        });
      } else if (table === "cTA") {
        await prisma.cTA.upsert({
          where: { key },
          create: { key, name },
          update: { name },
        });
      } else {
        await prisma.emotionalTone.upsert({
          where: { key },
          create: { key, name },
          update: { name },
        });
      }
      await upsertNode({ kind, key, name });
    }
  };

  await simpleSeed("AUDIENCE", SEED_AUDIENCES, "audience");
  await simpleSeed("CAMPAIGN_TYPE", SEED_CAMPAIGN_TYPES, "campaignType");
  await simpleSeed("OBJECTIVE", SEED_OBJECTIVES, "marketingObjective");
  await simpleSeed("CONTENT_TYPE", SEED_CONTENT_TYPES, "contentType");
  await simpleSeed("CHANNEL", SEED_CHANNELS, "distributionChannel");
  await simpleSeed("CTA", SEED_CTAS, "cTA");
  await simpleSeed("EMOTIONAL_TONE", SEED_TONES, "emotionalTone");

  // Mirror calendar seasons into graph nodes
  const seasons = await prisma.marketingSeason.findMany();
  for (const s of seasons) {
    await upsertNode({
      kind: "SEASON",
      key: s.key,
      name: s.name,
      meta: { seasonKind: s.kind },
    });
  }

  const counts = await prisma.knowledgeNode.groupBy({
    by: ["kind"],
    _count: { _all: true },
  });

  return {
    nodes: counts.reduce((n, c) => n + c._count._all, 0),
    byKind: Object.fromEntries(counts.map((c) => [c.kind, c._count._all])),
  };
}

export async function searchKnowledgeNodes(input: {
  q?: string;
  kind?: string;
  limit?: number;
}) {
  await ensureKnowledgeGraph();
  const where: Prisma.KnowledgeNodeWhereInput = { active: true };
  if (input.kind) where.kind = parseKind(input.kind);
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { key: { contains: slugifyKnowledgeKey(q), mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  return prisma.knowledgeNode.findMany({
    where,
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    take: Math.min(input.limit || 50, 200),
    include: {
      parent: { select: { id: true, key: true, name: true, kind: true } },
      _count: { select: { fromRels: true, toRels: true, eventLinks: true } },
    },
  });
}

export async function getKnowledgeNodeDetail(idOrKey: string, kind?: string) {
  await ensureKnowledgeGraph();
  const node = await prisma.knowledgeNode.findFirst({
    where: kind
      ? { OR: [{ id: idOrKey }, { kind: parseKind(kind), key: idOrKey }] }
      : { OR: [{ id: idOrKey }, { key: idOrKey }] },
    include: {
      parent: true,
      children: { orderBy: { name: "asc" }, take: 40 },
      fromRels: {
        include: {
          toNode: true,
          type: true,
        },
        take: 50,
      },
      toRels: {
        include: {
          fromNode: true,
          type: true,
        },
        take: 50,
      },
      eventLinks: {
        include: {
          event: {
            select: {
              id: true,
              key: true,
              name: true,
              month: true,
              day: true,
            },
          },
          type: true,
        },
        take: 30,
      },
    },
  });
  return node;
}

export async function upsertKnowledgeNode(input: {
  id?: string;
  kind: string;
  key?: string;
  name: string;
  description?: string;
  parentId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await ensureKnowledgeGraph();
  const kind = parseKind(input.kind);
  const key = input.key || slugifyKnowledgeKey(input.name);
  if (!key) throw new Error("Invalid key");

  if (input.id) {
    return prisma.knowledgeNode.update({
      where: { id: input.id },
      data: {
        name: input.name,
        description: input.description || null,
        parentId: input.parentId ?? undefined,
        meta: input.meta as Prisma.InputJsonValue | undefined,
      },
    });
  }

  return upsertNode({
    kind,
    key,
    name: input.name,
    description: input.description,
    meta: input.meta,
  });
}

export async function connectKnowledgeNodes(input: {
  fromNodeId: string;
  toNodeId: string;
  typeKey?: string;
  strength?: string;
  note?: string;
}) {
  await ensureKnowledgeGraph();
  if (input.fromNodeId === input.toNodeId) {
    throw new Error("Cannot connect a node to itself");
  }
  const type = await prisma.knowledgeRelationType.findUnique({
    where: { key: input.typeKey || "related_to" },
  });
  if (!type) throw new Error("Unknown relation type");

  return prisma.knowledgeRelation.upsert({
    where: {
      fromNodeId_toNodeId_typeId: {
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        typeId: type.id,
      },
    },
    create: {
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      typeId: type.id,
      strength: parseStrength(input.strength),
      note: input.note || null,
    },
    update: {
      strength: parseStrength(input.strength),
      note: input.note || null,
    },
    include: { fromNode: true, toNode: true, type: true },
  });
}

export async function disconnectKnowledgeNodes(input: {
  fromNodeId: string;
  toNodeId: string;
  typeKey?: string;
}) {
  const type = input.typeKey
    ? await prisma.knowledgeRelationType.findUnique({
        where: { key: input.typeKey },
      })
    : null;

  if (type) {
    await prisma.knowledgeRelation.deleteMany({
      where: {
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        typeId: type.id,
      },
    });
  } else {
    await prisma.knowledgeRelation.deleteMany({
      where: {
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
      },
    });
  }
  return { ok: true };
}

export async function updateKnowledgeRelation(input: {
  id: string;
  strength?: string;
  note?: string;
  typeKey?: string;
}) {
  const data: Prisma.KnowledgeRelationUpdateInput = {};
  if (input.strength) data.strength = parseStrength(input.strength);
  if (input.note !== undefined) data.note = input.note;
  if (input.typeKey) {
    const type = await prisma.knowledgeRelationType.findUnique({
      where: { key: input.typeKey },
    });
    if (type) data.type = { connect: { id: type.id } };
  }
  return prisma.knowledgeRelation.update({
    where: { id: input.id },
    data,
    include: { fromNode: true, toNode: true, type: true },
  });
}

export async function mergeKnowledgeNodes(input: {
  keepId: string;
  mergeIds: string[];
}) {
  const keep = await prisma.knowledgeNode.findUnique({
    where: { id: input.keepId },
  });
  if (!keep) return null;

  for (const id of input.mergeIds.filter((x) => x !== keep.id)) {
    await prisma.knowledgeRelation.updateMany({
      where: { fromNodeId: id },
      data: { fromNodeId: keep.id },
    });
    await prisma.knowledgeRelation.updateMany({
      where: { toNodeId: id },
      data: { toNodeId: keep.id },
    });
    await prisma.marketingEventKnowledge.updateMany({
      where: { nodeId: id },
      data: { nodeId: keep.id },
    });
    await prisma.knowledgeNode.update({
      where: { id },
      data: { active: false, name: `${keep.name} (merged)` },
    });
  }
  return keep;
}

export async function splitKnowledgeNode(input: {
  nodeId: string;
  name: string;
  kind?: string;
}) {
  const source = await prisma.knowledgeNode.findUnique({
    where: { id: input.nodeId },
  });
  if (!source) return null;
  const key = slugifyKnowledgeKey(input.name);
  return prisma.knowledgeNode.create({
    data: {
      kind: input.kind ? parseKind(input.kind) : source.kind,
      key: `${key}_${Date.now().toString(36)}`,
      name: input.name,
      description: source.description,
      parentId: source.id,
      meta: { splitFrom: source.id } as Prisma.InputJsonValue,
    },
  });
}

export async function linkEventToKnowledge(input: {
  eventId: string;
  nodeId: string;
  typeKey?: string;
  strength?: string;
  note?: string;
}) {
  await ensureKnowledgeGraph();
  const type = input.typeKey
    ? await prisma.knowledgeRelationType.findUnique({
        where: { key: input.typeKey },
      })
    : await prisma.knowledgeRelationType.findUnique({
        where: { key: "related_to" },
      });

  return prisma.marketingEventKnowledge.upsert({
    where: {
      eventId_nodeId: { eventId: input.eventId, nodeId: input.nodeId },
    },
    create: {
      eventId: input.eventId,
      nodeId: input.nodeId,
      typeId: type?.id || null,
      strength: parseStrength(input.strength),
      note: input.note || null,
    },
    update: {
      typeId: type?.id || null,
      strength: parseStrength(input.strength),
      note: input.note || null,
    },
    include: { node: true, type: true },
  });
}

export async function unlinkEventKnowledge(input: {
  eventId: string;
  nodeId: string;
}) {
  await prisma.marketingEventKnowledge.delete({
    where: {
      eventId_nodeId: { eventId: input.eventId, nodeId: input.nodeId },
    },
  });
  return { ok: true };
}

export async function getEventKnowledge(eventId: string) {
  await ensureKnowledgeGraph();
  return prisma.marketingEventKnowledge.findMany({
    where: { eventId },
    include: { node: true, type: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function previewEventGraph(eventId: string) {
  const links = await getEventKnowledge(eventId);
  const nodeIds = links.map((l) => l.nodeId);
  const relations = nodeIds.length
    ? await prisma.knowledgeRelation.findMany({
        where: {
          OR: [
            { fromNodeId: { in: nodeIds } },
            { toNodeId: { in: nodeIds } },
          ],
        },
        include: { fromNode: true, toNode: true, type: true },
        take: 100,
      })
    : [];

  const event = await prisma.marketingEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      key: true,
      name: true,
      preparationDays: true,
      planningWindowDays: true,
      publishingWindowDays: true,
      reminderOffsets: true,
      expirationDays: true,
    },
  });

  return { event, links, relations };
}

export async function updateEventPreparation(input: {
  eventId: string;
  preparationDays?: number | null;
  planningWindowDays?: number | null;
  publishingWindowDays?: number | null;
  reminderOffsets?: number[];
  expirationDays?: number | null;
}) {
  return prisma.marketingEvent.update({
    where: { id: input.eventId },
    data: {
      preparationDays: input.preparationDays ?? undefined,
      planningWindowDays: input.planningWindowDays ?? undefined,
      publishingWindowDays: input.publishingWindowDays ?? undefined,
      reminderOffsets: input.reminderOffsets,
      expirationDays: input.expirationDays ?? undefined,
    },
  });
}

export async function listKnowledgeMeta() {
  await ensureKnowledgeGraph();
  const [types, counts] = await Promise.all([
    prisma.knowledgeRelationType.findMany({ orderBy: { name: "asc" } }),
    prisma.knowledgeNode.groupBy({
      by: ["kind"],
      where: { active: true },
      _count: { _all: true },
    }),
  ]);
  return {
    relationTypes: types,
    nodeKinds: NODE_KINDS,
    counts: Object.fromEntries(counts.map((c) => [c.kind, c._count._all])),
  };
}

export async function findRelatedByKind(input: {
  nodeId: string;
  kind?: string;
  limit?: number;
}) {
  const rels = await prisma.knowledgeRelation.findMany({
    where: {
      OR: [{ fromNodeId: input.nodeId }, { toNodeId: input.nodeId }],
    },
    include: { fromNode: true, toNode: true, type: true },
    take: 100,
  });

  const related = rels
    .map((r) => (r.fromNodeId === input.nodeId ? r.toNode : r.fromNode))
    .filter((n) => (input.kind ? n.kind === parseKind(input.kind) : true));

  const uniq = new Map(related.map((n) => [n.id, n]));
  return Array.from(uniq.values()).slice(0, input.limit || 40);
}
