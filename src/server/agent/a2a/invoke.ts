import { AgentError } from "@/server/agent/errors";
import {
  MARKETING_DIRECTOR_AGENT_ID,
  MAX_ORCHESTRATION_DEPTH,
  isDirectorAllowedSpecialist,
  type DirectorSpecialistId,
} from "@/server/agent/a2a/specialists";
import {
  compactFromSpecialistResult,
  sanitizeHandoff,
  validateSpecialistInvokeArgs,
  type CompactHandoff,
} from "@/server/agent/a2a/handoffs";
import {
  getSpecialistInvoker,
  type SpecialistInvokeContext,
  type SpecialistInvokeResult,
} from "@/server/agent/a2a/invokers";
import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";
import type { Prisma } from "@prisma/client";

export type InvokeSpecialistParams = {
  agentId: string;
  rawArgs: unknown;
  userId: string;
  workspaceId: string;
  brandId: string;
  parentExecutionId: string;
  depth: number;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  /** Merged user constraints tracked by Director. */
  directorConstraints?: Record<string, unknown>;
};

export type InvokeSpecialistOutcome = {
  agentId: DirectorSpecialistId;
  result: SpecialistInvokeResult;
  handoff: CompactHandoff;
  validated: true;
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * Safe Agent-to-Agent invocation.
 * - allowlist only
 * - no Director recursion
 * - depth bounded
 * - args validated
 * - specialist permissions cannot be elevated (each runner enforces READ)
 */
export async function invokeSpecialistAgent(
  params: InvokeSpecialistParams,
): Promise<InvokeSpecialistOutcome> {
  if (params.agentId === MARKETING_DIRECTOR_AGENT_ID) {
    throw new AgentError(
      "PERMISSION_DENIED",
      "Recursive marketing.director invocation is not allowed.",
      { meta: { agentId: params.agentId } },
    );
  }

  if (!isDirectorAllowedSpecialist(params.agentId)) {
    throw new AgentError(
      "PERMISSION_DENIED",
      `Agent ${params.agentId} is not on the Director allowlist.`,
      { meta: { agentId: params.agentId } },
    );
  }

  if (params.depth >= MAX_ORCHESTRATION_DEPTH) {
    throw new AgentError(
      "EXECUTION_FAILED",
      `Orchestration depth limit reached (${MAX_ORCHESTRATION_DEPTH}).`,
      { meta: { depth: params.depth } },
    );
  }

  const validated = validateSpecialistInvokeArgs(
    params.agentId,
    params.rawArgs,
  );
  if (!validated.ok) {
    throw new AgentError("INVALID_INPUT", validated.error, {
      meta: { agentId: params.agentId },
    });
  }

  const mergedConstraints = {
    ...(params.directorConstraints || {}),
    ...(validated.args.constraints || {}),
  };

  const ctx: SpecialistInvokeContext = {
    userId: params.userId,
    workspaceId: params.workspaceId,
    brandId: params.brandId,
    message: validated.args.message,
    purpose: validated.args.purpose,
    constraints: mergedConstraints,
    handoff: (validated.args.handoff || {}) as Record<string, unknown>,
    blueprint: validated.blueprint,
    blueprintItem: validated.blueprintItem,
    blueprintItemId: validated.args.blueprintItemId,
    period: validated.args.period,
    parentExecutionId: params.parentExecutionId,
    depth: params.depth + 1,
    llm: params.llm,
    toolRegistry: params.toolRegistry,
    store: params.store,
  };

  // Trace A2A on parent as a synthetic tool row (no second runtime).
  const store = params.store;
  let toolRowId: string | undefined;
  const startedAt = new Date();
  if (store) {
    const toolRow = await store.createToolExecution({
      agentExecutionId: params.parentExecutionId,
      toolId: `agent.${params.agentId}`,
      sequence: Date.now() % 1_000_000,
      input: asJson(
        sanitizeHandoff({
          message: ctx.message,
          purpose: ctx.purpose,
          constraints: mergedConstraints,
          parentExecutionId: params.parentExecutionId,
          depth: ctx.depth,
        }),
      ),
      status: "RUNNING",
      startedAt,
    });
    toolRowId = toolRow.id;
  }

  const invoker = getSpecialistInvoker(params.agentId);
  let result: SpecialistInvokeResult;
  try {
    result = await invoker(ctx);
  } catch (err) {
    const message =
      err instanceof AgentError ? err.message : "Specialist invocation failed.";
    const code = err instanceof AgentError ? err.code : "EXECUTION_FAILED";
    if (store && toolRowId) {
      await store.completeToolExecution(toolRowId, {
        status: "FAILED",
        errorCode: code,
        errorMessage: message,
        durationMs: Date.now() - startedAt.getTime(),
        completedAt: new Date(),
        output: asJson({ failed: true }),
      });
    }
    throw err instanceof AgentError
      ? err
      : new AgentError("EXECUTION_FAILED", message, { cause: err });
  }

  const handoff = compactFromSpecialistResult(
    params.agentId,
    result.payload,
    mergedConstraints,
  );

  if (store && toolRowId) {
    await store.completeToolExecution(toolRowId, {
      status: result.success ? "COMPLETED" : "FAILED",
      errorCode: result.error?.code ?? null,
      errorMessage: result.error?.message ?? null,
      durationMs: Date.now() - startedAt.getTime(),
      completedAt: new Date(),
      output: asJson(
        sanitizeHandoff({
          childExecutionId: result.executionId,
          status: result.status,
          handoff,
        }),
      ),
    });
  }

  return {
    agentId: params.agentId,
    result,
    handoff,
    validated: true,
  };
}
