import { z } from "zod";
import { AgentError } from "@/server/agent/errors";
import { searchKnowledgeNodes } from "@/server/services/knowledge-graph";
import type { ToolDefinition } from "@/server/agent/types";
import { clampLimit } from "@/server/agent/tools/scope";

const inputSchema = z.object({
  query: z.string().optional(),
  kind: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
});

const nodeSchema = z.object({
  id: z.string(),
  key: z.string(),
  kind: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parent: z
    .object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      kind: z.string(),
    })
    .nullable(),
  relationCounts: z.object({
    from: z.number(),
    to: z.number(),
    eventLinks: z.number(),
  }),
});

const outputSchema = z.object({
  nodes: z.array(nodeSchema),
  total: z.number(),
  limit: z.number(),
});

export type KnowledgeSearchOutput = z.infer<typeof outputSchema>;

export const knowledgeSearchTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  KnowledgeSearchOutput
> = {
  id: "knowledge.search",
  name: "Knowledge Search",
  description:
    "Structured Knowledge Graph lookup via existing searchKnowledgeNodes (no vectors/RAG).",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    // Catalog is global; still require a valid agent execution scope for audit isolation.
    if (!ctx.userId || !ctx.workspaceId || !ctx.brandId) {
      throw new AgentError(
        "SCOPE_VIOLATION",
        "Tool execution requires userId, workspaceId, and brandId.",
      );
    }

    const limit = clampLimit(input.limit, 20, 50);
    const nodes = await searchKnowledgeNodes({
      q: input.query,
      kind: input.kind,
      limit,
    });

    return {
      total: nodes.length,
      limit,
      nodes: nodes.map((n) => ({
        id: n.id,
        key: n.key,
        kind: n.kind,
        name: n.name,
        description: n.description ?? null,
        parent: n.parent
          ? {
              id: n.parent.id,
              key: n.parent.key,
              name: n.parent.name,
              kind: n.parent.kind,
            }
          : null,
        relationCounts: {
          from: n._count.fromRels,
          to: n._count.toRels,
          eventLinks: n._count.eventLinks,
        },
      })),
    };
  },
};
