import {
  CONTENT_CREATOR_AGENT_ID,
  CONTENT_CREATOR_SYSTEM_PROMPT,
  CONTENT_CREATOR_TOOL_IDS,
  MAX_TOOL_CALL_ROUNDS,
} from "@/server/agent/content-creator/constants";
import {
  parseContentAsset,
  type ContentAsset,
} from "@/server/agent/content-creator/output";
import type {
  ContentBlueprint,
  ContentPlanItem,
} from "@/server/agent/content-strategist/output";
import { AgentError } from "@/server/agent/errors";
import {
  runReadonlyToolCallingAgent,
  type RunReadonlyToolCallingResult,
} from "@/server/agent/loop";
import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";

export type RunContentCreatorInput = {
  message: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  /** Preferred: full Strategist blueprint and/or a single plan item. */
  blueprint?: ContentBlueprint;
  blueprintItem?: ContentPlanItem;
  /** When blueprint has multiple items, select by id. */
  blueprintItemId?: string;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  maxRounds?: number;
};

export type RunContentCreatorResult = RunReadonlyToolCallingResult & {
  asset: ContentAsset;
  blueprintItem: ContentPlanItem | null;
};

function resolveBlueprintItem(
  input: RunContentCreatorInput,
): ContentPlanItem | null {
  if (input.blueprintItem) return input.blueprintItem;
  const plan = input.blueprint?.contentPlan || [];
  if (input.blueprintItemId) {
    return plan.find((p) => p.id === input.blueprintItemId) || null;
  }
  if (plan.length === 1) return plan[0]!;
  return null;
}

/**
 * Content Creator — production-ready assets from an approved Blueprint.
 * Uses shared READ-only tool-calling loop (generation is LLM output, not DB write).
 */
export async function runContentCreatorAgent(
  input: RunContentCreatorInput,
): Promise<RunContentCreatorResult> {
  const blueprintItem = resolveBlueprintItem(input);

  const hasBlueprintContext =
    Boolean(blueprintItem) ||
    Boolean(input.blueprint?.contentPlan?.length) ||
    /blueprint|plan item|contentPlan/i.test(input.message);

  if (!hasBlueprintContext && !input.message.trim()) {
    throw new AgentError(
      "INVALID_INPUT",
      "Content Creator requires a Content Blueprint item or a message that includes one.",
    );
  }

  const extraSystemMessages: string[] = [
    "Output requirement: return ONLY the Content Asset JSON. Preserve Blueprint topic/channel/format/objective/audience/angle. No publishing. No ContentItem persistence.",
  ];

  if (blueprintItem) {
    extraSystemMessages.push(
      `Approved Content Blueprint item (authoritative — preserve strategic fields):\n${JSON.stringify(blueprintItem)}`,
    );
  } else if (input.blueprint?.contentPlan?.length) {
    extraSystemMessages.push(
      `Approved Content Blueprint (select/create for each relevant item; if message targets one item, execute that item only):\n${JSON.stringify(input.blueprint)}`,
    );
  } else {
    extraSystemMessages.push(
      "No structured Blueprint object was supplied. If the user message does not contain a valid Blueprint item (topic/channel/format/objective/angle), do not invent critical strategy — return limitations requesting a Blueprint.",
    );
  }

  const result = await runReadonlyToolCallingAgent({
    agentId: CONTENT_CREATOR_AGENT_ID,
    systemPrompt: CONTENT_CREATOR_SYSTEM_PROMPT,
    allowedToolIds: CONTENT_CREATOR_TOOL_IDS,
    message: input.message,
    userId: input.userId,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    llm: input.llm,
    toolRegistry: input.toolRegistry,
    store: input.store,
    maxRounds: input.maxRounds ?? MAX_TOOL_CALL_ROUNDS,
    temperature: 0.4,
    extraSystemMessages,
  });

  const asset = parseContentAsset(
    result.response,
    input.message,
    blueprintItem,
  );

  return {
    ...result,
    asset,
    blueprintItem,
  };
}
