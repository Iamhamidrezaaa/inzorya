import type {
  AgentExecutionStatus,
  AgentToolExecutionStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AgentError } from "@/server/agent/errors";
import {
  getDefaultAgentRegistry,
  type AgentRegistry,
} from "@/server/agent/agent-registry";
import { bootstrapAgentTools } from "@/server/agent/bootstrap";
import { defaultAllowedPermissions } from "@/server/agent/permissions";
import { executeTool } from "@/server/agent/tool-executor";
import {
  getDefaultToolRegistry,
  type ToolRegistry,
} from "@/server/agent/tool-registry";
import type {
  AgentExecutionInput,
  AgentExecutionResult,
  StructuredToolResult,
  ToolCallRequest,
  ToolContext,
  ToolPermission,
} from "@/server/agent/types";

export type AgentRuntimeStore = {
  createExecution(data: {
    agentId: string;
    workspaceId: string;
    brandId: string;
    userId: string;
    input: Prisma.InputJsonValue | undefined;
    status: AgentExecutionStatus;
  }): Promise<{ id: string }>;
  updateExecution(
    id: string,
    data: {
      status?: AgentExecutionStatus;
      startedAt?: Date;
      completedAt?: Date;
      result?: Prisma.InputJsonValue;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ): Promise<void>;
  createToolExecution(data: {
    agentExecutionId: string;
    toolId: string;
    sequence: number;
    input: Prisma.InputJsonValue | undefined;
    status: AgentToolExecutionStatus;
    startedAt: Date;
  }): Promise<{ id: string }>;
  completeToolExecution(
    id: string,
    data: {
      status: AgentToolExecutionStatus;
      output?: Prisma.InputJsonValue;
      errorCode?: string | null;
      errorMessage?: string | null;
      durationMs: number;
      completedAt: Date;
    },
  ): Promise<void>;
};

export const prismaAgentRuntimeStore: AgentRuntimeStore = {
  async createExecution(data) {
    return prisma.agentExecution.create({
      data: {
        agentId: data.agentId,
        workspaceId: data.workspaceId,
        brandId: data.brandId,
        userId: data.userId,
        input: data.input,
        status: data.status,
      },
      select: { id: true },
    });
  },
  async updateExecution(id, data) {
    await prisma.agentExecution.update({ where: { id }, data });
  },
  async createToolExecution(data) {
    return prisma.agentToolExecution.create({
      data: {
        agentExecutionId: data.agentExecutionId,
        toolId: data.toolId,
        sequence: data.sequence,
        input: data.input,
        status: data.status,
        startedAt: data.startedAt,
      },
      select: { id: true },
    });
  },
  async completeToolExecution(id, data) {
    await prisma.agentToolExecution.update({
      where: { id },
      data: {
        status: data.status,
        output: data.output,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        durationMs: data.durationMs,
        completedAt: data.completedAt,
      },
    });
  },
};

/** In-memory store for unit tests (no database). */
export function createMemoryAgentRuntimeStore(): AgentRuntimeStore & {
  executions: Map<string, Record<string, unknown>>;
  toolExecutions: Map<string, Record<string, unknown>[]>;
} {
  const executions = new Map<string, Record<string, unknown>>();
  const toolExecutions = new Map<string, Record<string, unknown>[]>();
  let seq = 0;

  return {
    executions,
    toolExecutions,
    async createExecution(data) {
      const id = `exec_${++seq}`;
      executions.set(id, { id, ...data, createdAt: new Date() });
      toolExecutions.set(id, []);
      return { id };
    },
    async updateExecution(id, data) {
      const current = executions.get(id);
      if (!current) throw new Error(`Missing execution ${id}`);
      executions.set(id, { ...current, ...data });
    },
    async createToolExecution(data) {
      const id = `tool_${++seq}`;
      const list = toolExecutions.get(data.agentExecutionId) ?? [];
      list.push({ id, ...data });
      toolExecutions.set(data.agentExecutionId, list);
      return { id };
    },
    async completeToolExecution(id, data) {
      for (const [, list] of toolExecutions) {
        const row = list.find((r) => r.id === id);
        if (row) {
          Object.assign(row, data);
          return;
        }
      }
    },
  };
}

export type RunAgentExecutionParams = {
  agentId: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  input?: AgentExecutionInput;
  allowedPermissions?: ToolPermission[];
  toolRegistry?: ToolRegistry;
  agentRegistry?: AgentRegistry;
  store?: AgentRuntimeStore;
};

function resolveToolCalls(
  agentId: string,
  input: AgentExecutionInput | undefined,
): ToolCallRequest[] {
  if (input?.toolCalls?.length) {
    return input.toolCalls;
  }
  if (agentId === "system.test") {
    const message =
      typeof input?.message === "string" ? input.message : "ping";
    return [{ toolId: "system.echo", input: { message } }];
  }
  return [];
}

/**
 * Runs a predefined tool sequence for an agent execution.
 * No LLM planning / autonomous loops — foundation only.
 */
export async function runAgentExecution(
  params: RunAgentExecutionParams,
): Promise<AgentExecutionResult> {
  if (!params.userId || !params.workspaceId || !params.brandId) {
    throw new AgentError(
      "SCOPE_VIOLATION",
      "Agent execution requires userId, workspaceId, and brandId.",
    );
  }

  const agentRegistry = params.agentRegistry ?? getDefaultAgentRegistry();
  const toolRegistry =
    params.toolRegistry ?? bootstrapAgentTools(getDefaultToolRegistry());
  const store = params.store ?? prismaAgentRuntimeStore;
  const allowed =
    params.allowedPermissions ?? defaultAllowedPermissions();

  const agent = agentRegistry.getAgent(params.agentId);
  if (!agent) {
    throw new AgentError(
      "AGENT_NOT_FOUND",
      `Unknown agent: ${params.agentId}`,
      { meta: { agentId: params.agentId } },
    );
  }

  const execution = await store.createExecution({
    agentId: agent.id,
    workspaceId: params.workspaceId,
    brandId: params.brandId,
    userId: params.userId,
    input: (params.input ?? {}) as Prisma.InputJsonValue,
    status: "PENDING",
  });

  await store.updateExecution(execution.id, {
    status: "RUNNING",
    startedAt: new Date(),
  });

  const toolCalls = resolveToolCalls(agent.id, params.input);
  const toolResults: StructuredToolResult[] = [];

  const ctxBase: Omit<ToolContext, "agentExecutionId"> = {
    userId: params.userId,
    workspaceId: params.workspaceId,
    brandId: params.brandId,
    allowedPermissions: allowed,
  };

  try {
    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i]!;
      const startedAt = new Date();
      const toolRow = await store.createToolExecution({
        agentExecutionId: execution.id,
        toolId: call.toolId,
        sequence: i + 1,
        input: call.input as Prisma.InputJsonValue,
        status: "RUNNING",
        startedAt,
      });

      const result = await executeTool(toolRegistry, {
        toolId: call.toolId,
        input: call.input,
        context: { ...ctxBase, agentExecutionId: execution.id },
      });
      toolResults.push(result);

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await store.completeToolExecution(toolRow.id, {
        status: result.success ? "COMPLETED" : "FAILED",
        output: result as unknown as Prisma.InputJsonValue,
        errorCode: result.error?.code ?? null,
        errorMessage: result.error?.message ?? null,
        durationMs,
        completedAt,
      });

      if (!result.success) {
        const error = result.error ?? {
          code: "EXECUTION_FAILED",
          message: "Tool execution failed.",
        };
        await store.updateExecution(execution.id, {
          status: "FAILED",
          completedAt: new Date(),
          result: { toolResults } as unknown as Prisma.InputJsonValue,
          errorCode: error.code,
          errorMessage: error.message,
        });
        return {
          executionId: execution.id,
          agentId: agent.id,
          status: "FAILED",
          toolResults,
          error,
        };
      }
    }

    const resultPayload = { toolResults };
    await store.updateExecution(execution.id, {
      status: "COMPLETED",
      completedAt: new Date(),
      result: resultPayload as unknown as Prisma.InputJsonValue,
      errorCode: null,
      errorMessage: null,
    });

    return {
      executionId: execution.id,
      agentId: agent.id,
      status: "COMPLETED",
      toolResults,
      result: resultPayload,
    };
  } catch (err) {
    const message =
      err instanceof AgentError ? err.message : "Agent execution failed.";
    const code = err instanceof AgentError ? err.code : "INTERNAL";
    await store.updateExecution(execution.id, {
      status: "FAILED",
      completedAt: new Date(),
      errorCode: code,
      errorMessage: message,
      result: { toolResults } as unknown as Prisma.InputJsonValue,
    });
    throw err instanceof AgentError
      ? err
      : new AgentError("EXECUTION_FAILED", message, { cause: err });
  }
}

/** Convenience: registry.executeTool via default stack. */
export async function executeRegisteredTool(
  toolId: string,
  input: unknown,
  context: ToolContext,
  registry?: ToolRegistry,
): Promise<StructuredToolResult> {
  const toolRegistry = registry ?? bootstrapAgentTools(getDefaultToolRegistry());
  return executeTool(toolRegistry, { toolId, input, context });
}
