export {
  TREND_INTELLIGENCE_AGENT,
  TREND_INTELLIGENCE_AGENT_ID,
  TREND_INTELLIGENCE_TOOL_IDS,
  MAX_TOOL_CALL_ROUNDS,
} from "@/server/agent/trend-intelligence/constants";
export {
  runTrendIntelligenceAgent,
  type RunTrendIntelligenceInput,
  type RunTrendIntelligenceResult,
} from "@/server/agent/trend-intelligence/run";
export {
  parseTrendIntelligence,
  trendIntelligenceSchema,
  type TrendIntelligenceResult,
  type TrendItem,
  type TrendEvidence,
} from "@/server/agent/trend-intelligence/output";
export {
  toolIdToFunctionName,
  functionNameToToolId,
  isTrendIntelligenceToolId,
} from "@/server/agent/trend-intelligence/tools";
