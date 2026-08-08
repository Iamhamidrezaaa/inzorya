import {
  getDefaultToolRegistry,
  type ToolRegistry,
} from "@/server/agent/tool-registry";
import { brandGetContextTool } from "@/server/agent/tools/brand-get-context";
import { brandGetStrategyTool } from "@/server/agent/tools/brand-get-strategy";
import { calendarGetEventsTool } from "@/server/agent/tools/calendar-get-events";
import { contentGetHistoryTool } from "@/server/agent/tools/content-get-history";
import { knowledgeSearchTool } from "@/server/agent/tools/knowledge-search";
import { opportunityGetRelevantTool } from "@/server/agent/tools/opportunity-get-relevant";
import { systemEchoTool } from "@/server/agent/tools/system-echo";

export const MARKETING_READ_TOOLS = [
  brandGetContextTool,
  brandGetStrategyTool,
  contentGetHistoryTool,
  calendarGetEventsTool,
  opportunityGetRelevantTool,
  knowledgeSearchTool,
] as const;

const ALL_FOUNDATION_TOOLS = [systemEchoTool, ...MARKETING_READ_TOOLS];

let bootstrapped = false;

/** Registers foundation + read-only marketing tools once. */
export function bootstrapAgentTools(registry?: ToolRegistry): ToolRegistry {
  const target = registry ?? getDefaultToolRegistry();
  if (!registry) {
    if (bootstrapped) return target;
    bootstrapped = true;
  }
  for (const tool of ALL_FOUNDATION_TOOLS) {
    if (!target.hasTool(tool.id)) {
      target.registerTool(tool);
    }
  }
  return target;
}

/** Tests only. */
export function resetAgentBootstrap(): void {
  bootstrapped = false;
}
