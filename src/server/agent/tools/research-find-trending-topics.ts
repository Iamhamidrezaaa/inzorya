import { z } from "zod";
import type { ToolDefinition } from "@/server/agent/types";
import { clampLimit } from "@/server/agent/tools/scope";
import { trendResearchAvailability } from "@/server/agent/tools/research-providers";

const inputSchema = z.object({
  topic: z.string().min(1),
  industry: z.string().optional(),
  location: z.string().optional(),
  from: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  topic: z.string(),
  signalKind: z.enum(["research_signal", "verified_social_trend", "none"]),
  note: z.string(),
  signals: z.array(
    z.object({
      title: z.string(),
      url: z.string().nullable(),
      source: z.string(),
      publishedAt: z.string().nullable(),
      relevance: z.string().nullable(),
    }),
  ),
});

export const researchFindTrendingTopicsTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "research.findTrendingTopics",
  name: "Find Trending Topics",
  description:
    "Research-signal foundation for future Trend Intelligence. Does not invent viral scores.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input) {
    const limit = clampLimit(input.limit, 10, 20);
    void limit;
    void input.industry;
    void input.location;
    void input.from;

    const status = trendResearchAvailability();
    return {
      available: false,
      reason: status.reason,
      topic: input.topic,
      signalKind: "none",
      note: "No wired trend/research provider. Results would be research_signal only — never verified_social_trend or viral scores — until a provider is connected.",
      signals: [],
    };
  },
};
