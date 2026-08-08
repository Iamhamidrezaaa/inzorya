import {
  VIRAL_CONTENT_ANALYST_AGENT_ID,
  VIRAL_CONTENT_ANALYST_SYSTEM_PROMPT,
  VIRAL_CONTENT_ANALYST_TOOL_IDS,
  MAX_TOOL_CALL_ROUNDS,
} from "@/server/agent/viral-content-analyst/constants";
import {
  parseViralContentAnalysis,
  type ViralContentAnalysisResult,
} from "@/server/agent/viral-content-analyst/output";
import {
  runReadonlyToolCallingAgent,
  type RunReadonlyToolCallingResult,
} from "@/server/agent/loop";
import type { LLMProvider } from "@/server/agent/llm";
import type { AgentRuntimeStore } from "@/server/agent/runtime";
import type { ToolRegistry } from "@/server/agent/tool-registry";

export type RunViralContentAnalystInput = {
  message: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  llm?: LLMProvider;
  toolRegistry?: ToolRegistry;
  store?: AgentRuntimeStore;
  maxRounds?: number;
};

export type RunViralContentAnalystResult = RunReadonlyToolCallingResult & {
  analysis: ViralContentAnalysisResult;
};

/**
 * Viral Content Analyst — READ-only pattern analysis (not content generation).
 * Uses the shared Agent Runtime tool-calling loop.
 */
export async function runViralContentAnalystAgent(
  input: RunViralContentAnalystInput,
): Promise<RunViralContentAnalystResult> {
  const result = await runReadonlyToolCallingAgent({
    agentId: VIRAL_CONTENT_ANALYST_AGENT_ID,
    systemPrompt: VIRAL_CONTENT_ANALYST_SYSTEM_PROMPT,
    allowedToolIds: VIRAL_CONTENT_ANALYST_TOOL_IDS,
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
      "Output requirement: return ONLY the Viral Content Analysis JSON object described in the system prompt. No prose outside JSON. No scripts, captions, or viral scores.",
    ],
  });

  const analysis = parseViralContentAnalysis(result.response, input.message);

  return {
    ...result,
    analysis,
  };
}
