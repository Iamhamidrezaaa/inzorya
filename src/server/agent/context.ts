import { composeContext } from "@/server/ai/context/engine";
import type { AgentContext } from "@/server/agent/types";

export type LoadAgentContextParams = {
  userId: string;
  workspaceId: string;
  brandId: string;
  /** When true, loads a light brand_voice slice via existing Context Engine. */
  includeRelevantContext?: boolean;
};

/**
 * Thin interface for Agent executions to obtain context.
 * Reuses existing composeContext — does not rebuild the Context Engine.
 * Context (information) stays separate from Tools (actions).
 */
export async function loadAgentContext(
  params: LoadAgentContextParams,
): Promise<AgentContext> {
  const base: AgentContext = {
    user: { id: params.userId },
    workspace: { id: params.workspaceId },
    brand: { id: params.brandId },
    relevantContext: null,
  };

  if (!params.includeRelevantContext) {
    return base;
  }

  const { payload } = await composeContext({
    brandId: params.brandId,
    providers: ["brand_voice"],
    taskKey: "agent.context",
  });

  return {
    ...base,
    relevantContext: payload as Record<string, unknown>,
  };
}
