import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";
import type { DirectorSpecialistId } from "@/server/agent/a2a/specialists";
import type {
  ContentBlueprint,
  ContentPlanItem,
} from "@/server/agent/content-strategist/output";

export type SpecialistInvokeContext = {
  userId: string;
  workspaceId: string;
  brandId: string;
  message: string;
  purpose?: string;
  constraints?: Record<string, unknown>;
  handoff?: Record<string, unknown>;
  blueprint?: ContentBlueprint;
  blueprintItem?: ContentPlanItem;
  blueprintItemId?: string;
  period?: { from?: string; to?: string };
  /** Parent Director execution id for tracing. */
  parentExecutionId: string;
  /** Current orchestration depth (Director = 0, specialist = 1...). */
  depth: number;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
};

export type SpecialistInvokeResult = {
  success: boolean;
  agentId: DirectorSpecialistId;
  executionId: string;
  status: "COMPLETED" | "FAILED";
  /** Full structured payload from the specialist runner (for compaction). */
  payload: Record<string, unknown>;
  response?: string;
  error?: { code: string; message: string };
};

export type SpecialistInvoker = (
  ctx: SpecialistInvokeContext,
) => Promise<SpecialistInvokeResult>;

export type SpecialistInvokerMap = Partial<
  Record<DirectorSpecialistId, SpecialistInvoker>
>;

let overrideInvokers: SpecialistInvokerMap | null = null;

export function setSpecialistInvokers(
  map: SpecialistInvokerMap | null,
): void {
  overrideInvokers = map;
}

export function resetSpecialistInvokers(): void {
  overrideInvokers = null;
}

function buildSpecialistMessage(ctx: SpecialistInvokeContext): string {
  const parts = [ctx.message.trim()];
  if (ctx.purpose) {
    parts.push(`\n[Director purpose]: ${ctx.purpose}`);
  }
  if (ctx.constraints && Object.keys(ctx.constraints).length) {
    parts.push(
      `\n[User constraints — preserve exactly]: ${JSON.stringify(ctx.constraints)}`,
    );
  }
  if (ctx.period) {
    parts.push(`\n[Period]: ${JSON.stringify(ctx.period)}`);
  }
  if (ctx.handoff && Object.keys(ctx.handoff).length) {
    parts.push(
      `\n[Upstream handoff — compact evidence]: ${JSON.stringify(ctx.handoff)}`,
    );
  }
  return parts.join("\n");
}

async function defaultInvokeMarketingReadonly(
  ctx: SpecialistInvokeContext,
): Promise<SpecialistInvokeResult> {
  const { runMarketingReadonlyAgent } = await import(
    "@/server/agent/marketing-readonly"
  );
  const result = await runMarketingReadonlyAgent({
    message: buildSpecialistMessage(ctx),
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    brandId: ctx.brandId,
    llm: ctx.llm,
    toolRegistry: ctx.toolRegistry,
    store: ctx.store,
  });
  return {
    success: result.success,
    agentId: "marketing.readonly",
    executionId: result.executionId,
    status: result.status,
    response: result.response,
    payload: { ...result },
    error: result.error,
  };
}

async function defaultInvokeTrend(
  ctx: SpecialistInvokeContext,
): Promise<SpecialistInvokeResult> {
  const { runTrendIntelligenceAgent } = await import(
    "@/server/agent/trend-intelligence"
  );
  const result = await runTrendIntelligenceAgent({
    message: buildSpecialistMessage(ctx),
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    brandId: ctx.brandId,
    llm: ctx.llm,
    toolRegistry: ctx.toolRegistry,
    store: ctx.store,
  });
  return {
    success: result.success,
    agentId: "trend.intelligence",
    executionId: result.executionId,
    status: result.status,
    response: result.response,
    payload: { ...result },
    error: result.error,
  };
}

async function defaultInvokeViral(
  ctx: SpecialistInvokeContext,
): Promise<SpecialistInvokeResult> {
  const { runViralContentAnalystAgent } = await import(
    "@/server/agent/viral-content-analyst"
  );
  const result = await runViralContentAnalystAgent({
    message: buildSpecialistMessage(ctx),
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    brandId: ctx.brandId,
    llm: ctx.llm,
    toolRegistry: ctx.toolRegistry,
    store: ctx.store,
  });
  return {
    success: result.success,
    agentId: "viral.content.analyst",
    executionId: result.executionId,
    status: result.status,
    response: result.response,
    payload: { ...result },
    error: result.error,
  };
}

async function defaultInvokeStrategist(
  ctx: SpecialistInvokeContext,
): Promise<SpecialistInvokeResult> {
  const { runContentStrategistAgent } = await import(
    "@/server/agent/content-strategist"
  );
  const result = await runContentStrategistAgent({
    message: buildSpecialistMessage(ctx),
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    brandId: ctx.brandId,
    llm: ctx.llm,
    toolRegistry: ctx.toolRegistry,
    store: ctx.store,
  });
  return {
    success: result.success,
    agentId: "content.strategist",
    executionId: result.executionId,
    status: result.status,
    response: result.response,
    payload: { ...result },
    error: result.error,
  };
}

async function defaultInvokeCreator(
  ctx: SpecialistInvokeContext,
): Promise<SpecialistInvokeResult> {
  const { runContentCreatorAgent } = await import(
    "@/server/agent/content-creator"
  );
  const result = await runContentCreatorAgent({
    message: buildSpecialistMessage(ctx),
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    brandId: ctx.brandId,
    blueprint: ctx.blueprint,
    blueprintItem: ctx.blueprintItem,
    blueprintItemId: ctx.blueprintItemId,
    llm: ctx.llm,
    toolRegistry: ctx.toolRegistry,
    store: ctx.store,
  });
  return {
    success: result.success,
    agentId: "content.creator",
    executionId: result.executionId,
    status: result.status,
    response: result.response,
    payload: { ...result },
    error: result.error,
  };
}

async function defaultInvokeSocialAnalytics(
  ctx: SpecialistInvokeContext,
): Promise<SpecialistInvokeResult> {
  const { runSocialAnalyticsAgent } = await import(
    "@/server/agent/social-analytics"
  );
  let message = buildSpecialistMessage(ctx);
  if (ctx.period?.from || ctx.period?.to) {
    message += `\n[Normalized period]: from=${ctx.period.from || "?"} to=${ctx.period.to || "?"}`;
  }
  const result = await runSocialAnalyticsAgent({
    message,
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    brandId: ctx.brandId,
    llm: ctx.llm,
    toolRegistry: ctx.toolRegistry,
    store: ctx.store,
  });
  return {
    success: result.success,
    agentId: "social.analytics",
    executionId: result.executionId,
    status: result.status,
    response: result.response,
    payload: { ...result },
    error: result.error,
  };
}

const DEFAULT_INVOKERS: Record<DirectorSpecialistId, SpecialistInvoker> = {
  "marketing.readonly": defaultInvokeMarketingReadonly,
  "trend.intelligence": defaultInvokeTrend,
  "viral.content.analyst": defaultInvokeViral,
  "content.strategist": defaultInvokeStrategist,
  "content.creator": defaultInvokeCreator,
  "social.analytics": defaultInvokeSocialAnalytics,
};

export function getSpecialistInvoker(
  agentId: DirectorSpecialistId,
): SpecialistInvoker {
  return overrideInvokers?.[agentId] ?? DEFAULT_INVOKERS[agentId];
}
