import {
  CONTENT_PLANNER_AGENT_ID,
  CONTENT_PLANNER_SYSTEM_PROMPT,
  CONTENT_PLANNER_TOOL_IDS,
  MAX_TOOL_CALL_ROUNDS,
} from "@/server/agent/content-planner/constants";
import {
  parseContentScheduleProposal,
  type ContentScheduleProposal,
} from "@/server/agent/content-planner/output";
import {
  runReadonlyToolCallingAgent,
  type RunReadonlyToolCallingResult,
} from "@/server/agent/loop";
import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";

export type RunContentPlannerInput = {
  message: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  /** Optional structured context injected into the prompt (READY drafts, accounts). */
  contextBlock?: string;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  maxRounds?: number;
};

export type RunContentPlannerResult = RunReadonlyToolCallingResult & {
  proposal: ContentScheduleProposal;
};

/**
 * Content Planner — proposes internal schedule for READY content.
 * READ-only tools. Never publishes. Never auto-confirms SCHEDULED.
 */
export async function runContentPlannerAgent(
  input: RunContentPlannerInput,
): Promise<RunContentPlannerResult> {
  const extras = [
    "Output requirement: return ONLY the Content Schedule Proposal JSON. Never publish externally. Never set status to scheduled or published. Do not invent optimal posting times without analytics evidence.",
  ];
  if (input.contextBlock) {
    extras.push(`Planning context (facts):\n${input.contextBlock}`);
  }

  const result = await runReadonlyToolCallingAgent({
    agentId: CONTENT_PLANNER_AGENT_ID,
    systemPrompt: CONTENT_PLANNER_SYSTEM_PROMPT,
    allowedToolIds: CONTENT_PLANNER_TOOL_IDS,
    message: input.message,
    userId: input.userId,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    llm: input.llm,
    toolRegistry: input.toolRegistry,
    store: input.store,
    maxRounds: input.maxRounds ?? MAX_TOOL_CALL_ROUNDS,
    temperature: 0.2,
    extraSystemMessages: extras,
  });

  const proposal = parseContentScheduleProposal(result.response, input.message);

  return {
    ...result,
    proposal,
  };
}
