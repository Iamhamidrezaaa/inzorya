import { z } from "zod";

export const platformStatusSchema = z.enum([
  "connected",
  "partially_connected",
  "not_connected",
  "error",
]);

export const insightTypeSchema = z.enum(["fact", "observation", "inference"]);
export const confidenceSchema = z.enum(["high", "medium", "low"]);

export const socialAnalyticsIntelligenceSchema = z.object({
  query: z.string(),
  platforms: z
    .array(
      z.object({
        platform: z.string(),
        status: platformStatusSchema,
        limitations: z.array(z.string()).optional().default([]),
      }),
    )
    .optional()
    .default([]),
  period: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional()
    .default({}),
  overview: z
    .object({
      available: z.boolean(),
      summary: z.string().optional(),
      metrics: z.record(z.string(), z.unknown()).optional().default({}),
      reason: z.string().optional(),
    })
    .optional()
    .default({ available: false, metrics: {} }),
  performance: z
    .object({
      trend: z.string().optional(),
      changes: z
        .array(
          z.object({
            label: z.string(),
            detail: z.string(),
          }),
        )
        .optional()
        .default([]),
    })
    .optional()
    .default({ changes: [] }),
  topContent: z
    .array(
      z.object({
        contentId: z.string(),
        title: z.string().optional(),
        platform: z.string().optional(),
        format: z.string().optional(),
        topic: z.string().optional(),
        metrics: z.record(z.string(), z.unknown()).optional().default({}),
        whyItRanks: z.string(),
        rankingMetric: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  formatAnalysis: z
    .array(
      z.object({
        format: z.string(),
        sampleSize: z.number(),
        metrics: z.record(z.string(), z.unknown()).optional().default({}),
        observation: z.string(),
        limitations: z.array(z.string()).optional().default([]),
      }),
    )
    .optional()
    .default([]),
  topicAnalysis: z
    .array(
      z.object({
        topic: z.string(),
        sampleSize: z.number(),
        metrics: z.record(z.string(), z.unknown()).optional().default({}),
        observation: z.string(),
      }),
    )
    .optional()
    .default([]),
  publishingPatterns: z
    .array(
      z.object({
        pattern: z.string(),
        evidence: z.string().optional().default(""),
        note: z.string().optional().default(""),
      }),
    )
    .optional()
    .default([]),
  insights: z
    .array(
      z.object({
        insight: z.string(),
        evidence: z.array(z.string()).optional().default([]),
        confidence: confidenceSchema,
        type: insightTypeSchema,
      }),
    )
    .optional()
    .default([]),
  areasToInvestigate: z.array(z.string()).optional().default([]),
  limitations: z.array(z.string()).optional().default([]),
});

export type SocialAnalyticsIntelligence = z.infer<
  typeof socialAnalyticsIntelligenceSchema
>;

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Parse LLM final text into Social Analytics intelligence.
 * Never fabricates metrics on parse failure.
 */
export function parseSocialAnalyticsIntelligence(
  response: string,
  query: string,
): SocialAnalyticsIntelligence {
  const parsed = extractJsonObject(response);
  if (parsed) {
    const result = socialAnalyticsIntelligenceSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  return {
    query,
    platforms: [],
    period: {},
    overview: {
      available: false,
      reason: "PARSE_FAILED",
      metrics: {},
    },
    performance: { changes: [] },
    topContent: [],
    formatAnalysis: [],
    topicAnalysis: [],
    publishingPatterns: [],
    insights: [],
    areasToInvestigate: [],
    limitations: [
      "The model response could not be parsed into the Social Analytics contract.",
      "No fabricated metrics were added.",
    ],
  };
}
