import { prisma } from "@/lib/db";
import { AgentError } from "@/server/agent/errors";
import type { ToolContext } from "@/server/agent/types";

/**
 * Resolve brandId for a tool call within ToolContext workspace/brand scope.
 * Optional input brandId must match the execution brand (no cross-brand access).
 */
export async function resolveScopedBrandId(
  ctx: ToolContext,
  requestedBrandId?: string,
): Promise<string> {
  if (requestedBrandId && requestedBrandId !== ctx.brandId) {
    throw new AgentError(
      "SCOPE_VIOLATION",
      "Requested brandId is outside the agent execution brand scope.",
      { meta: { requestedBrandId, brandId: ctx.brandId } },
    );
  }

  const brandId = requestedBrandId ?? ctx.brandId;
  const brand = await prisma.brand.findFirst({
    where: {
      id: brandId,
      workspaceId: ctx.workspaceId,
      archivedAt: null,
    },
    select: { id: true },
  });

  if (!brand) {
    throw new AgentError(
      "SCOPE_VIOLATION",
      "Brand not found in the current workspace scope.",
      { meta: { brandId, workspaceId: ctx.workspaceId } },
    );
  }

  return brand.id;
}

export function clampLimit(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(1, Math.floor(value)), max);
}
