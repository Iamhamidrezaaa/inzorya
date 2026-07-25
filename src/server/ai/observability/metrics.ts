import { prisma } from "@/lib/db";

export async function recordUsage(input: {
  workspaceId?: string | null;
  providerKey: string;
  modelKey: string;
  taskKey: string;
  success: boolean;
  latencyMs: number;
  tokens: number;
  retries?: number;
}) {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const existing = await prisma.usageMetric.findFirst({
    where: {
      workspaceId: input.workspaceId || null,
      day,
      providerKey: input.providerKey,
      modelKey: input.modelKey,
      taskKey: input.taskKey,
    },
  });
  if (existing) {
    return prisma.usageMetric.update({
      where: { id: existing.id },
      data: {
        requests: { increment: 1 },
        successes: { increment: input.success ? 1 : 0 },
        failures: { increment: input.success ? 0 : 1 },
        retries: { increment: input.retries || 0 },
        latencySumMs: { increment: input.latencyMs },
        tokens: { increment: input.tokens },
      },
    });
  }
  return prisma.usageMetric.create({
    data: {
      workspaceId: input.workspaceId || null,
      day,
      providerKey: input.providerKey,
      modelKey: input.modelKey,
      taskKey: input.taskKey,
      requests: 1,
      successes: input.success ? 1 : 0,
      failures: input.success ? 0 : 1,
      retries: input.retries || 0,
      latencySumMs: input.latencyMs,
      tokens: input.tokens,
    },
  });
}

export async function recordCost(input: {
  workspaceId?: string | null;
  executionId?: string | null;
  providerKey: string;
  modelKey: string;
  estimatedUsd: number;
  promptTokens: number;
  completionTokens: number;
}) {
  return prisma.costRecord.create({
    data: {
      workspaceId: input.workspaceId || null,
      executionId: input.executionId || null,
      providerKey: input.providerKey,
      modelKey: input.modelKey,
      estimatedUsd: input.estimatedUsd,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
    },
  });
}

export async function recordAIError(input: {
  workspaceId?: string | null;
  executionId?: string | null;
  code: string;
  message: string;
  providerKey?: string;
  modelKey?: string;
  taskKey?: string;
  meta?: Record<string, unknown>;
}) {
  return prisma.aIError.create({
    data: {
      workspaceId: input.workspaceId || null,
      executionId: input.executionId || null,
      code: input.code,
      message: input.message,
      providerKey: input.providerKey,
      modelKey: input.modelKey,
      taskKey: input.taskKey,
      meta: input.meta as never,
    },
  });
}

export function estimateCostUsd(input: {
  inputPricePer1M?: number | null;
  outputPricePer1M?: number | null;
  promptTokens: number;
  completionTokens: number;
}) {
  const inPrice = input.inputPricePer1M || 0;
  const outPrice = input.outputPricePer1M || 0;
  return (
    (input.promptTokens / 1_000_000) * inPrice +
    (input.completionTokens / 1_000_000) * outPrice
  );
}

export async function getUsageDashboard(workspaceId: string) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 14);
  since.setUTCHours(0, 0, 0, 0);

  const [metrics, costs, errors, executions] = await Promise.all([
    prisma.usageMetric.findMany({
      where: { workspaceId, day: { gte: since } },
      orderBy: { day: "asc" },
    }),
    prisma.costRecord.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.aIError.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.aITaskExecution.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { task: true },
    }),
  ]);

  const totals = metrics.reduce(
    (acc, m) => {
      acc.requests += m.requests;
      acc.successes += m.successes;
      acc.failures += m.failures;
      acc.retries += m.retries;
      acc.latencySumMs += m.latencySumMs;
      acc.tokens += m.tokens;
      acc.byProvider[m.providerKey] =
        (acc.byProvider[m.providerKey] || 0) + m.requests;
      acc.byTask[m.taskKey] = (acc.byTask[m.taskKey] || 0) + m.requests;
      return acc;
    },
    {
      requests: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      latencySumMs: 0,
      tokens: 0,
      byProvider: {} as Record<string, number>,
      byTask: {} as Record<string, number>,
    },
  );

  const daily = Object.values(
    metrics.reduce(
      (acc, m) => {
        const key = m.day.toISOString().slice(0, 10);
        acc[key] = acc[key] || { day: key, requests: 0, failures: 0, cost: 0 };
        acc[key]!.requests += m.requests;
        acc[key]!.failures += m.failures;
        return acc;
      },
      {} as Record<string, { day: string; requests: number; failures: number; cost: number }>,
    ),
  );

  for (const c of costs) {
    const day = c.createdAt.toISOString().slice(0, 10);
    const row = daily.find((d) => d.day === day);
    if (row) row.cost += c.estimatedUsd;
  }

  return {
    totals: {
      ...totals,
      avgLatencyMs: totals.requests
        ? Math.round(totals.latencySumMs / totals.requests)
        : 0,
      avgCost:
        costs.length === 0
          ? 0
          : costs.reduce((s, c) => s + c.estimatedUsd, 0) / costs.length,
      totalCost: costs.reduce((s, c) => s + c.estimatedUsd, 0),
    },
    daily,
    providers: totals.byProvider,
    tasks: totals.byTask,
    errors,
    recentExecutions: executions,
    costs: costs.slice(0, 20),
  };
}
