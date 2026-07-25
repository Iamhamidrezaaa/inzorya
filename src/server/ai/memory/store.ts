import type { MemoryScope } from "@prisma/client";
import { prisma } from "@/lib/db";

export type MemoryWriteInput = {
  workspaceId?: string | null;
  brandId?: string | null;
  scope: MemoryScope;
  subjectId?: string | null;
  key: string;
  content: string;
  meta?: Record<string, unknown>;
};

/** Long-term memory storage — embeddings reserved via embeddingRef. */
export async function writeMemory(input: MemoryWriteInput) {
  return prisma.memoryRecord.create({
    data: {
      workspaceId: input.workspaceId || null,
      brandId: input.brandId || null,
      scope: input.scope,
      subjectId: input.subjectId || null,
      key: input.key,
      content: input.content,
      meta: input.meta as never,
      embeddingRef: null,
    },
  });
}

export async function readMemory(input: {
  workspaceId?: string | null;
  brandId?: string | null;
  scope?: MemoryScope;
  subjectId?: string | null;
  limit?: number;
}) {
  return prisma.memoryRecord.findMany({
    where: {
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.scope ? { scope: input.scope } : {}),
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: input.limit || 20,
  });
}

export interface EmbeddingService {
  embed(_texts: string[]): Promise<number[][]>;
}

/** Interface only — no vector DB this sprint. */
export class NoopEmbeddingService implements EmbeddingService {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }
}
