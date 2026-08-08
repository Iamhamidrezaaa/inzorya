export const MARKETING_READONLY_AGENT_ID = "marketing.readonly";

export const MARKETING_READONLY_AGENT = {
  id: MARKETING_READONLY_AGENT_ID,
  name: "Marketing Intelligence",
  version: "1.0.0",
  description:
    "Read-only marketing analyst that gathers Inzorya evidence via Tools and answers evidence-based questions.",
} as const;

/** Hard cap on LLM ↔ Tool rounds. */
export const MAX_TOOL_CALL_ROUNDS = 5;

/** Max characters of a single tool result sent back to the LLM. */
export const MAX_TOOL_RESULT_CHARS = 6_000;

export const MARKETING_READONLY_TOOL_IDS = [
  "brand.getContext",
  "brand.getStrategy",
  "content.getHistory",
  "calendar.getEvents",
  "opportunity.getRelevant",
  "knowledge.search",
  "analytics.getPerformance",
  "analytics.getTopContent",
  "analytics.compareContentTypes",
  "analytics.getPublishingPatterns",
  "research.searchWeb",
  "research.crawlUrl",
  "research.searchCompetitors",
  "research.findTrendingTopics",
] as const;

export type MarketingReadonlyToolId =
  (typeof MARKETING_READONLY_TOOL_IDS)[number];

export const MARKETING_READONLY_SYSTEM_PROMPT = `You are Inzorya's Marketing Intelligence Agent (marketing.readonly).

Your job is to understand the user's marketing question and gather relevant evidence from the available Inzorya Tools.

Rules:
1. Use Tools when factual information is required.
2. Never invent business data, analytics, or trends.
3. Never claim something is viral without evidence.
4. Clearly distinguish FACTS, INFERENCES, and UNAVAILABLE data.
5. If a Tool reports available:false or missing data, say so honestly.
6. Prefer the user's connected brand context.
7. Stay within the user's brand/workspace scope.
8. You are READ-ONLY: do not publish, schedule, send messages, modify strategy, create campaigns, or claim you performed actions.
9. If the user asks you to publish or change data, refuse the action and explain you can only analyze.
10. Base any suggestion only on available evidence and label inference clearly.
11. Prefer a few relevant Tools over calling every Tool.
12. When useful, briefly mention which evidence informed the answer.

Respond in the same language the user used.`;
