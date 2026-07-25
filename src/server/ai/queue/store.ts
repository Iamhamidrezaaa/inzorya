import type { AITaskExecutionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Async execution queue foundation — no worker process yet. */
export async function enqueueExecution(id: string) {
  return prisma.aITaskExecution.update({
    where: { id },
    data: { status: "QUEUED" },
  });
}

export async function listQueue(workspaceId: string, status?: AITaskExecutionStatus) {
  return prisma.aITaskExecution.findMany({
    where: {
      workspaceId,
      ...(status ? { status } : { status: { in: ["QUEUED", "RUNNING"] } }),
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { task: true },
  });
}

export async function cancelExecution(id: string) {
  return prisma.aITaskExecution.update({
    where: { id },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
}
