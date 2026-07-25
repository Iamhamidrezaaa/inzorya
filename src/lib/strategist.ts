import type { ContextProviderKey } from "@/server/ai/context/engine";

export const STRATEGY_CONVERSATION_TYPES = [
  { key: "MARKETING_STRATEGY", label: "Marketing Strategy" },
  { key: "GROWTH_STRATEGY", label: "Growth Strategy" },
  { key: "CAMPAIGN_PLANNING", label: "Campaign Planning" },
  { key: "COMPETITOR_ANALYSIS", label: "Competitor Analysis" },
  { key: "AUDIENCE_ANALYSIS", label: "Audience Analysis" },
  { key: "BRAND_POSITIONING", label: "Brand Positioning" },
  { key: "CONTENT_DIRECTION", label: "Content Direction" },
  { key: "SWOT", label: "SWOT" },
  { key: "GO_TO_MARKET", label: "Go-To-Market" },
  { key: "LAUNCH_PLAN", label: "Launch Plan" },
  { key: "RETENTION", label: "Retention" },
  { key: "COMMUNITY_GROWTH", label: "Community Growth" },
] as const;

export type StrategyConversationTypeKey =
  (typeof STRATEGY_CONVERSATION_TYPES)[number]["key"];

export const CONTEXT_SOURCE_OPTIONS: {
  key: ContextProviderKey;
  label: string;
  description: string;
}[] = [
  {
    key: "business_brain",
    label: "Business Brain",
    description: "Interviewed business knowledge",
  },
  {
    key: "brand_voice",
    label: "Brand Voice",
    description: "Tone and brand identity",
  },
  {
    key: "marketing_strategy",
    label: "Marketing Strategy",
    description: "Goals, pillars, and roadmap",
  },
  {
    key: "campaign",
    label: "Campaigns",
    description: "Recent campaign shells",
  },
  {
    key: "analytics_summary",
    label: "Analytics",
    description: "KPI snapshot",
  },
  {
    key: "knowledge_base",
    label: "Knowledge Base",
    description: "Document corpus size and availability",
  },
  {
    key: "customer",
    label: "Customer Data",
    description: "Contact volume signals",
  },
  {
    key: "connected_channels",
    label: "Connected Channels",
    description: "Live channel connections",
  },
  {
    key: "content_history",
    label: "Content History",
    description: "Recent studio content",
  },
  {
    key: "conversation",
    label: "Conversations",
    description: "Inbox conversation volume",
  },
];

export const DEFAULT_CONTEXT_SOURCES: ContextProviderKey[] = [
  "business_brain",
  "brand_voice",
  "marketing_strategy",
  "campaign",
  "analytics_summary",
  "knowledge_base",
  "connected_channels",
];

export const STARTER_SUGGESTIONS = [
  {
    label: "How can I increase engagement?",
    type: "GROWTH_STRATEGY" as const,
  },
  {
    label: "Plan my next campaign.",
    type: "CAMPAIGN_PLANNING" as const,
  },
  {
    label: "Analyze my competitors.",
    type: "COMPETITOR_ANALYSIS" as const,
  },
  {
    label: "Find weaknesses in my content strategy.",
    type: "CONTENT_DIRECTION" as const,
  },
  {
    label: "Suggest new audience segments.",
    type: "AUDIENCE_ANALYSIS" as const,
  },
];

export const FOLLOW_UP_ACTIONS = [
  { key: "explain", label: "Explain further" },
  { key: "compare", label: "Compare" },
  { key: "improve", label: "Improve" },
  { key: "expand", label: "Expand" },
  { key: "simplify", label: "Simplify" },
  { key: "translate", label: "Translate" },
  { key: "checklist", label: "Turn into checklist" },
  { key: "roadmap", label: "Turn into roadmap" },
  { key: "campaign", label: "Turn into campaign" },
  { key: "content_brief", label: "Turn into content brief" },
] as const;

export const RESPONSE_SECTIONS = [
  { key: "executiveSummary", label: "Executive Summary" },
  { key: "findings", label: "Findings" },
  { key: "reasoning", label: "Reasoning" },
  { key: "recommendations", label: "Recommendations" },
  { key: "risks", label: "Risks" },
  { key: "expectedImpact", label: "Expected Impact" },
  { key: "actionItems", label: "Action Items" },
] as const;

export const DEFAULT_TEMPLATES = [
  {
    key: "engagement_lift",
    name: "Engagement Lift",
    description: "Diagnose engagement and propose levers.",
    conversationType: "GROWTH_STRATEGY" as const,
    starterPrompt: "How can I increase engagement with my current audience?",
    sortOrder: 1,
  },
  {
    key: "next_campaign",
    name: "Next Campaign",
    description: "Plan the next campaign around current goals.",
    conversationType: "CAMPAIGN_PLANNING" as const,
    starterPrompt: "Plan my next campaign using current goals and channels.",
    sortOrder: 2,
  },
  {
    key: "competitor_scan",
    name: "Competitor Scan",
    description: "Map competitor angles and gaps.",
    conversationType: "COMPETITOR_ANALYSIS" as const,
    starterPrompt: "Analyze my competitors and find white-space opportunities.",
    sortOrder: 3,
  },
  {
    key: "swot_pass",
    name: "SWOT Pass",
    description: "Structured SWOT for the brand.",
    conversationType: "SWOT" as const,
    starterPrompt: "Run a SWOT analysis for my brand based on current context.",
    sortOrder: 4,
  },
];
