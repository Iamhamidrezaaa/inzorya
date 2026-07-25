/**
 * Inzorya AI Core Platform — public facade.
 * Application features should import from here, never from a specific provider.
 */
export { getAIConfig } from "@/server/ai/config";
export { AIPlatformError } from "@/server/ai/errors";
export { listProviderAdapters, getProviderAdapter } from "@/server/ai/providers/registry";
export { routeModel, ensureAICatalog } from "@/server/ai/routing/router";
export { composeContext } from "@/server/ai/context/engine";
export { writeMemory, readMemory, NoopEmbeddingService } from "@/server/ai/memory/store";
export {
  ensurePrompts,
  getActivePrompt,
  createPromptVersion,
  rollbackPrompt,
} from "@/server/ai/prompts/repository";
export { PLATFORM_TASKS, ensureAITasks, getTaskDefinition } from "@/server/ai/tasks/registry";
export { runAITask, bootstrapAIPlatform } from "@/server/ai/tasks/executor";
export { getUsageDashboard } from "@/server/ai/observability/metrics";
export { listQueue, cancelExecution, enqueueExecution } from "@/server/ai/queue/store";
export { sanitizeInput, validateOutput } from "@/server/ai/guardrails";
export { SnapshotEvaluationRunner } from "@/server/ai/evaluation/types";
export type { EmbeddingProvider } from "@/server/ai/embeddings/types";
