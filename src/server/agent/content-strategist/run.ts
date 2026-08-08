import {
  CONTENT_STRATEGIST_AGENT_ID,
  CONTENT_STRATEGIST_SYSTEM_PROMPT,
  CONTENT_STRATEGIST_TOOL_IDS,
  MAX_TOOL_CALL_ROUNDS,
} from "@/server/agent/content-strategist/constants";
import {
  parseContentBlueprint,
  type ContentBlueprint,
} from "@/server/agent/content-strategist/output";
import {
  runReadonlyToolCallingAgent,
  type RunReadonlyToolCallingResult,
} from "@/server/agent/loop";
import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";

export type RunContentStrategistInput = {
  message: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  maxRounds?: number;
};

export type RunContentStrategistResult = RunReadonlyToolCallingResult & {
  blueprint: ContentBlueprint;
};

/**
 * Content Strategist — READ-only Content Blueprint (no copy, no persistence).
 * Uses the shared Agent Runtime tool-calling loop. No Agent-to-Agent.
 */
export async function runContentStrategistAgent(
  input: RunContentStrategistInput,
): Promise<RunContentStrategistResult> {
  const result = await runReadonlyToolCallingAgent({
    agentId: CONTENT_STRATEGIST_AGENT_ID,
    systemPrompt: CONTENT_STRATEGIST_SYSTEM_PROMPT,
    allowedToolIds: CONTENT_STRATEGIST_TOOL_IDS,
    message: input.message,
    userId: input.userId,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    llm: input.llm,
    toolRegistry: input.toolRegistry,
    store: input.store,
    maxRounds: input.maxRounds ?? MAX_TOOL_CALL_ROUNDS,
    temperature: 0.2,
    extraSystemMessages: [
      "Output requirement: return ONLY the Content Blueprint JSON object. No final captions, scripts, hooks, or hashtags. Do not claim the plan was saved, scheduled, or published.",
    ],
  });

  const blueprint = parseContentBlueprint(result.response, input.message);

  return {
    ...result,
    blueprint,
  };
}
