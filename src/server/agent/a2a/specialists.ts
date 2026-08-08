import type { ToolPermission } from "@/server/agent/types";

export const MARKETING_DIRECTOR_AGENT_ID = "marketing.director";

export const DIRECTOR_ALLOWED_SPECIALISTS = [
  "marketing.readonly",
  "trend.intelligence",
  "viral.content.analyst",
  "content.strategist",
  "content.creator",
  "content.planner",
  "social.analytics",
  "marketing.analyst",
] as const;

export type DirectorSpecialistId =
  (typeof DIRECTOR_ALLOWED_SPECIALISTS)[number];

export type DirectorIntent =
  | "INFORMATION"
  | "TREND_RESEARCH"
  | "CONTENT_ANALYSIS"
  | "CONTENT_PLANNING"
  | "CONTENT_CREATION"
  | "CONTENT_SCHEDULING"
  | "PERFORMANCE_ANALYSIS"
  | "MARKETING_ANALYSIS"
  | "EXECUTIVE_REPORT"
  | "DIAGNOSTIC_ANALYSIS"
  | "STRATEGIC_ANALYSIS"
  | "CALENDAR_OPPORTUNITY"
  | "MULTI_STEP_MARKETING_TASK"
  | "UNKNOWN";

export type SpecialistCapabilityMeta = {
  id: DirectorSpecialistId;
  name: string;
  capabilities: string[];
  intents: DirectorIntent[];
  /** Specialists keep their own READ boundary — Director cannot elevate. */
  permissionCeiling: ToolPermission;
  description: string;
};

export const SPECIALIST_CATALOG: SpecialistCapabilityMeta[] = [
  {
    id: "marketing.readonly",
    name: "Marketing Intelligence",
    capabilities: [
      "brand_context",
      "strategy_read",
      "general_marketing_qna",
      "calendar_read",
      "opportunity_read",
      "knowledge_search",
    ],
    intents: ["INFORMATION", "STRATEGIC_ANALYSIS", "CALENDAR_OPPORTUNITY"],
    permissionCeiling: "READ",
    description:
      "General brand/marketing intelligence via read tools. Use for brand facts, strategy overview, calendar/opportunity lookups when a full specialist workflow is not needed.",
  },
  {
    id: "trend.intelligence",
    name: "Trend Intelligence",
    capabilities: [
      "external_trends",
      "research_signals",
      "brand_relevance_of_trends",
    ],
    intents: ["TREND_RESEARCH", "MULTI_STEP_MARKETING_TASK"],
    permissionCeiling: "READ",
    description:
      "Current external market/content trend signals with evidence discipline.",
  },
  {
    id: "viral.content.analyst",
    name: "Viral Content Analyst",
    capabilities: [
      "url_content_analysis",
      "pattern_extraction",
      "structural_analysis",
    ],
    intents: ["CONTENT_ANALYSIS", "MULTI_STEP_MARKETING_TASK"],
    permissionCeiling: "READ",
    description:
      "Analyze existing content/URL structure and transferable patterns. Does not create content.",
  },
  {
    id: "content.strategist",
    name: "Content Strategist",
    capabilities: [
      "content_planning",
      "format_mix",
      "user_constrained_planning",
      "calendar_informed_planning",
    ],
    intents: [
      "CONTENT_PLANNING",
      "CALENDAR_OPPORTUNITY",
      "MULTI_STEP_MARKETING_TASK",
      "STRATEGIC_ANALYSIS",
    ],
    permissionCeiling: "READ",
    description:
      "Decides WHAT content to create and WHY. Returns Content Blueprint. Does not write final copy.",
  },
  {
    id: "content.creator",
    name: "Content Creator",
    capabilities: [
      "hooks",
      "scripts",
      "captions",
      "carousel_copy",
      "creative_assets",
    ],
    intents: ["CONTENT_CREATION", "MULTI_STEP_MARKETING_TASK"],
    permissionCeiling: "READ",
    description:
      "Turns an approved Content Blueprint into production-ready creative assets. Requires Blueprint. Cannot publish.",
  },
  {
    id: "content.planner",
    name: "Content Planner",
    capabilities: [
      "schedule_proposal",
      "calendar_aware_scheduling",
      "constraint_respect",
      "conflict_detection",
    ],
    intents: [
      "CONTENT_SCHEDULING",
      "CALENDAR_OPPORTUNITY",
      "MULTI_STEP_MARKETING_TASK",
    ],
    permissionCeiling: "READ",
    description:
      "Proposes internal dates/times for READY content using calendar, constraints, and available analytics. Never publishes or auto-confirms SCHEDULED.",
  },
  {
    id: "social.analytics",
    name: "Social Analytics",
    capabilities: [
      "performance_analysis",
      "top_content",
      "format_comparison",
      "publishing_patterns",
      "period_comparison",
    ],
    intents: ["PERFORMANCE_ANALYSIS", "MULTI_STEP_MARKETING_TASK"],
    permissionCeiling: "READ",
    description:
      "Analyzes REAL connected social performance metrics in depth. Never invents metrics. Prefer marketing.analyst for cross-domain managerial reports.",
  },
  {
    id: "marketing.analyst",
    name: "Marketing Analyst",
    capabilities: [
      "marketing_analysis",
      "executive_report",
      "diagnostic_analysis",
      "performance_synthesis",
      "learning_integration",
      "strategy_alignment_read",
      "calendar_impact_read",
      "opportunity_context",
    ],
    intents: [
      "MARKETING_ANALYSIS",
      "PERFORMANCE_ANALYSIS",
      "EXECUTIVE_REPORT",
      "DIAGNOSTIC_ANALYSIS",
      "CALENDAR_OPPORTUNITY",
      "MULTI_STEP_MARKETING_TASK",
    ],
    permissionCeiling: "READ",
    description:
      "Business/marketing intelligence across performance, content, learnings, strategy, calendar, opportunities, and trends via Tools. READ-only. Does not mutate strategy or publish.",
  },
];

export function isDirectorAllowedSpecialist(
  agentId: string,
): agentId is DirectorSpecialistId {
  return (DIRECTOR_ALLOWED_SPECIALISTS as readonly string[]).includes(agentId);
}

export function getSpecialistMeta(
  agentId: string,
): SpecialistCapabilityMeta | undefined {
  return SPECIALIST_CATALOG.find((s) => s.id === agentId);
}

/** OpenAI-safe function name for invoking a specialist. */
export function specialistIdToInvokeName(agentId: DirectorSpecialistId): string {
  return `invoke__${agentId.replace(/\./g, "_")}`;
}

export function invokeNameToSpecialistId(
  name: string,
): DirectorSpecialistId | null {
  if (!name.startsWith("invoke__")) return null;
  const id = name.slice("invoke__".length).replace(/_/g, ".");
  // Fix double-underscore style: social_analytics -> social.analytics
  // Our mapping uses single underscores for dots: social.analytics -> social_analytics
  const normalized = name
    .slice("invoke__".length)
    .replace(/__/g, ".")
    .replace(/_/g, ".");
  // Prefer exact catalog match by reconstructing from known IDs
  for (const s of DIRECTOR_ALLOWED_SPECIALISTS) {
    if (specialistIdToInvokeName(s) === name) return s;
  }
  if (isDirectorAllowedSpecialist(normalized)) return normalized;
  if (isDirectorAllowedSpecialist(id)) return id;
  return null;
}

export const MAX_SPECIALIST_CALLS = 6;
export const MAX_ORCHESTRATION_DEPTH = 3;
