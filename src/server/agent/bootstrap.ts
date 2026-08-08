import {
  getDefaultToolRegistry,
  type ToolRegistry,
} from "@/server/agent/tool-registry";
import { analyticsCompareContentTypesTool } from "@/server/agent/tools/analytics-compare-content-types";
import { analyticsGetPerformanceTool } from "@/server/agent/tools/analytics-get-performance";
import { analyticsGetPublishingPatternsTool } from "@/server/agent/tools/analytics-get-publishing-patterns";
import { analyticsGetTopContentTool } from "@/server/agent/tools/analytics-get-top-content";
import { brandGetContextTool } from "@/server/agent/tools/brand-get-context";
import { brandGetStrategyTool } from "@/server/agent/tools/brand-get-strategy";
import { calendarGetEventsTool } from "@/server/agent/tools/calendar-get-events";
import { contentGetHistoryTool } from "@/server/agent/tools/content-get-history";
import { knowledgeSearchTool } from "@/server/agent/tools/knowledge-search";
import { opportunityGetRelevantTool } from "@/server/agent/tools/opportunity-get-relevant";
import { learningGetRelevantTool } from "@/server/agent/tools/learning-get-relevant";
import { researchCrawlUrlTool } from "@/server/agent/tools/research-crawl-url";
import { researchFindTrendingTopicsTool } from "@/server/agent/tools/research-find-trending-topics";
import { researchSearchCompetitorsTool } from "@/server/agent/tools/research-search-competitors";
import { researchSearchWebTool } from "@/server/agent/tools/research-search-web";
import { systemEchoTool } from "@/server/agent/tools/system-echo";
import {
  socialGetCapabilitiesTool,
  socialGetConnectedAccountsTool,
} from "@/server/agent/tools/social-accounts";

export const MARKETING_READ_TOOLS = [
  brandGetContextTool,
  brandGetStrategyTool,
  contentGetHistoryTool,
  calendarGetEventsTool,
  opportunityGetRelevantTool,
  learningGetRelevantTool,
  knowledgeSearchTool,
] as const;

export const PERFORMANCE_RESEARCH_TOOLS = [
  analyticsGetPerformanceTool,
  analyticsGetTopContentTool,
  analyticsCompareContentTypesTool,
  analyticsGetPublishingPatternsTool,
  researchSearchWebTool,
  researchCrawlUrlTool,
  researchSearchCompetitorsTool,
  researchFindTrendingTopicsTool,
] as const;

export const SOCIAL_READ_TOOLS = [
  socialGetConnectedAccountsTool,
  socialGetCapabilitiesTool,
] as const;

const ALL_FOUNDATION_TOOLS = [
  systemEchoTool,
  ...MARKETING_READ_TOOLS,
  ...PERFORMANCE_RESEARCH_TOOLS,
  ...SOCIAL_READ_TOOLS,
];

let bootstrapped = false;

/** Registers foundation + marketing + performance/research tools once. */
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
