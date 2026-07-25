import type { Prisma, PrismaClient } from "@prisma/client";
import { AUTOMATION_TEMPLATES, type FlowSnapshot } from "@/lib/automation-catalog";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function ensureAutomationTemplates(prisma: PrismaClient) {
  for (const tpl of AUTOMATION_TEMPLATES) {
    await prisma.automationTemplate.upsert({
      where: { slug: tpl.slug },
      create: {
        slug: tpl.slug,
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        tags: tpl.tags,
        snapshot: asJson(tpl.snapshot),
      },
      update: {
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        tags: tpl.tags,
        snapshot: asJson(tpl.snapshot),
      },
    });
  }
}

export async function ensureDemoAutomations(
  prisma: PrismaClient,
  input: { brandId: string; userId: string },
) {
  await ensureAutomationTemplates(prisma);

  const count = await prisma.automation.count({
    where: { brandId: input.brandId, archivedAt: null },
  });
  if (count > 0) return { seeded: false };

  const welcome = AUTOMATION_TEMPLATES[0]!;
  const lead = AUTOMATION_TEMPLATES[1]!;
  const comment = AUTOMATION_TEMPLATES[4]!;

  for (const [tpl, status, executions] of [
    [welcome, "ACTIVE", 128],
    [lead, "DRAFT", 0],
    [comment, "PAUSED", 42],
  ] as const) {
    await createAutomationFromSnapshot(prisma, {
      brandId: input.brandId,
      userId: input.userId,
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      tags: [...tpl.tags],
      status,
      executionCount: executions,
      snapshot: tpl.snapshot,
    });
  }

  return { seeded: true };
}

export async function createAutomationFromSnapshot(
  prisma: PrismaClient,
  input: {
    brandId: string;
    userId: string;
    name: string;
    description?: string | null;
    category?: string | null;
    tags?: string[];
    status?: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
    executionCount?: number;
    snapshot: FlowSnapshot;
  },
) {
  const idMap = new Map<string, string>();
  const automation = await prisma.automation.create({
    data: {
      brandId: input.brandId,
      name: input.name,
      description: input.description || null,
      category: input.category || null,
      tags: input.tags || [],
      status: input.status || "DRAFT",
      createdById: input.userId,
      executionCount: input.executionCount || 0,
      nodeCount: input.snapshot.nodes.length,
      version: 1,
    },
  });

  for (const node of input.snapshot.nodes) {
    const created = await prisma.automationNode.create({
      data: {
        automationId: automation.id,
        type: node.type as "TRIGGER" | "CONDITION" | "ACTION" | "DELAY" | "BRANCH" | "END",
        kind: node.kind,
        label: node.label,
        description: node.description || null,
        config: (node.config || {}) as Prisma.InputJsonValue,
        positionX: node.position.x,
        positionY: node.position.y,
      },
    });
    idMap.set(node.id, created.id);
  }

  for (const edge of input.snapshot.edges) {
    const sourceId = idMap.get(edge.source);
    const targetId = idMap.get(edge.target);
    if (!sourceId || !targetId) continue;
    await prisma.automationEdge.create({
      data: {
        automationId: automation.id,
        sourceId,
        targetId,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
        label: edge.label || null,
      },
    });
  }

  await prisma.automationVersion.create({
    data: {
      automationId: automation.id,
      version: 1,
      snapshot: asJson(remapSnapshot(input.snapshot, idMap)),
      note: "Initial version",
      createdById: input.userId,
    },
  });

  return prisma.automation.findUniqueOrThrow({
    where: { id: automation.id },
    include: automationInclude(),
  });
}

export function automationInclude() {
  return {
    createdBy: { select: { id: true, name: true, email: true } },
    nodes: true,
    edges: true,
    versions: { orderBy: { version: "desc" as const }, take: 10 },
    executions: { orderBy: { startedAt: "desc" as const }, take: 10 },
  };
}

export function toSnapshot(automation: {
  nodes: {
    id: string;
    type: string;
    kind: string;
    label: string;
    description: string | null;
    config: unknown;
    positionX: number;
    positionY: number;
  }[];
  edges: {
    id: string;
    sourceId: string;
    targetId: string;
    sourceHandle: string | null;
    targetHandle: string | null;
    label: string | null;
  }[];
}): FlowSnapshot {
  return {
    nodes: automation.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      kind: n.kind,
      label: n.label,
      description: n.description,
      config: (n.config as Record<string, unknown>) || {},
      position: { x: n.positionX, y: n.positionY },
    })),
    edges: automation.edges.map((e) => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
    })),
  };
}

function remapSnapshot(snapshot: FlowSnapshot, idMap: Map<string, string>): FlowSnapshot {
  return {
    nodes: snapshot.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id) || n.id,
    })),
    edges: snapshot.edges.map((e) => ({
      ...e,
      source: idMap.get(e.source) || e.source,
      target: idMap.get(e.target) || e.target,
    })),
  };
}

export async function replaceGraph(
  prisma: PrismaClient,
  automationId: string,
  snapshot: FlowSnapshot,
) {
  await prisma.automationEdge.deleteMany({ where: { automationId } });
  await prisma.automationNode.deleteMany({ where: { automationId } });

  const idMap = new Map<string, string>();
  for (const node of snapshot.nodes) {
    const created = await prisma.automationNode.create({
      data: {
        id: node.id,
        automationId,
        type: node.type as "TRIGGER" | "CONDITION" | "ACTION" | "DELAY" | "BRANCH" | "END",
        kind: node.kind,
        label: node.label,
        description: node.description || null,
        config: (node.config || {}) as Prisma.InputJsonValue,
        positionX: node.position.x,
        positionY: node.position.y,
      },
    });
    idMap.set(node.id, created.id);
  }

  for (const edge of snapshot.edges) {
    const sourceId = idMap.get(edge.source) || edge.source;
    const targetId = idMap.get(edge.target) || edge.target;
    await prisma.automationEdge.create({
      data: {
        id: edge.id,
        automationId,
        sourceId,
        targetId,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
        label: edge.label || null,
      },
    });
  }

  await prisma.automation.update({
    where: { id: automationId },
    data: { nodeCount: snapshot.nodes.length },
  });

  return idMap;
}
