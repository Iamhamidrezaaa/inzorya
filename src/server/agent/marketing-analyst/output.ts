import { z } from "zod";

export const dataAvailabilityStatusSchema = z.enum([
  "available",
  "not_connected",
  "capability_not_available",
  "error",
]);

export const executiveStatusSchema = z.enum([
  "positive",
  "mixed",
  "negative",
  "insufficient_data",
]);

export const insightTypeSchema = z.enum(["fact", "observation", "inference"]);
export const confidenceSchema = z.enum(["high", "medium", "low"]);

const nullableNumber = z.number().nullable().optional();

export const marketingAnalysisSchema = z.object({
  query: z.string(),
  scope: z
    .object({
      brand: z.string().optional().default(""),
      platforms: z.array(z.string()).optional().default([]),
      from: z.string().optional().default(""),
      to: z.string().optional().default(""),
    })
    .optional()
    .default({ brand: "", platforms: [], from: "", to: "" }),
  dataAvailability: z
    .array(
      z.object({
        source: z.string(),
        status: dataAvailabilityStatusSchema,
        limitations: z.array(z.string()).optional().default([]),
      }),
    )
    .optional()
    .default([]),
  executiveSummary: z
    .object({
      status: executiveStatusSchema,
      summary: z.string().optional().default(""),
    })
    .optional()
    .default({ status: "insufficient_data", summary: "" }),
  performance: z
    .object({
      available: z.boolean().optional().default(false),
      current: z.record(z.string(), z.unknown()).optional().default({}),
      previous: z.record(z.string(), z.unknown()).optional().default({}),
      changes: z
        .array(
          z.object({
            metric: z.string(),
            current: nullableNumber,
            previous: nullableNumber,
            delta: nullableNumber,
            deltaPercent: nullableNumber,
          }),
        )
        .optional()
        .default([]),
      lastUpdatedAt: z.string().nullable().optional().default(null),
      dataAgeMs: z.number().nullable().optional().default(null),
    })
    .optional()
    .default({
      available: false,
      current: {},
      previous: {},
      changes: [],
      lastUpdatedAt: null,
      dataAgeMs: null,
    }),
  contentPerformance: z
    .object({
      topContent: z
        .array(
          z.object({
            contentId: z.string(),
            platform: z.string().nullable().optional().default(null),
            format: z.string().nullable().optional().default(null),
            metric: z.string().optional().default(""),
            value: nullableNumber,
            rankingMetric: z.string().optional().default(""),
            period: z.string().nullable().optional().default(null),
          }),
        )
        .optional()
        .default([]),
      formatAnalysis: z
        .array(
          z.object({
            format: z.string(),
            sampleSize: z.number().optional().default(0),
            observation: z.string().optional().default(""),
            limitations: z.array(z.string()).optional().default([]),
          }),
        )
        .optional()
        .default([]),
      topicAnalysis: z
        .array(
          z.object({
            topic: z.string(),
            sampleSize: z.number().optional().default(0),
            observation: z.string().optional().default(""),
          }),
        )
        .optional()
        .default([]),
    })
    .optional()
    .default({ topContent: [], formatAnalysis: [], topicAnalysis: [] }),
  strategyAlignment: z
    .object({
      available: z.boolean().optional().default(false),
      observations: z.array(z.string()).optional().default([]),
      limitations: z.array(z.string()).optional().default([]),
    })
    .optional()
    .default({ available: false, observations: [], limitations: [] }),
  calendarImpact: z
    .object({
      events: z
        .array(
          z.object({
            title: z.string(),
            date: z.string().nullable().optional().default(null),
          }),
        )
        .optional()
        .default([]),
      observations: z.array(z.string()).optional().default([]),
      limitations: z.array(z.string()).optional().default([]),
    })
    .optional()
    .default({ events: [], observations: [], limitations: [] }),
  opportunities: z
    .array(
      z.object({
        title: z.string(),
        score: z.number().nullable().optional().default(null),
        evidence: z.array(z.string()).optional().default([]),
        status: z.literal("observed_opportunity").optional().default("observed_opportunity"),
      }),
    )
    .optional()
    .default([]),
  learnings: z
    .array(
      z.object({
        statement: z.string(),
        confidence: z.string().optional().default(""),
        sampleSize: z.number().nullable().optional().default(null),
        dimension: z.string().nullable().optional().default(null),
      }),
    )
    .optional()
    .default([]),
  insights: z
    .array(
      z.object({
        insight: z.string(),
        type: insightTypeSchema,
        evidence: z.array(z.string()).optional().default([]),
        confidence: confidenceSchema,
      }),
    )
    .optional()
    .default([]),
  suggestedNextSteps: z
    .array(
      z.object({
        action: z.string(),
        reason: z.string().optional().default(""),
        evidence: z.array(z.string()).optional().default([]),
        confidence: confidenceSchema.optional().default("low"),
      }),
    )
    .optional()
    .default([]),
  areasToInvestigate: z.array(z.string()).optional().default([]),
  limitations: z.array(z.string()).optional().default([]),
});

export type MarketingAnalysis = z.infer<typeof marketingAnalysisSchema>;

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
 * Parse LLM final text into Marketing Analysis contract.
 * Never fabricates metrics on parse failure.
 */
export function parseMarketingAnalysis(
  response: string,
  query: string,
): MarketingAnalysis {
  const parsed = extractJsonObject(response);
  if (parsed) {
    const result = marketingAnalysisSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  return {
    query,
    scope: { brand: "", platforms: [], from: "", to: "" },
    dataAvailability: [],
    executiveSummary: {
      status: "insufficient_data",
      summary:
        "The model response could not be parsed into the Marketing Analysis contract.",
    },
    performance: {
      available: false,
      current: {},
      previous: {},
      changes: [],
      lastUpdatedAt: null,
      dataAgeMs: null,
    },
    contentPerformance: {
      topContent: [],
      formatAnalysis: [],
      topicAnalysis: [],
    },
    strategyAlignment: {
      available: false,
      observations: [],
      limitations: ["PARSE_FAILED"],
    },
    calendarImpact: { events: [], observations: [], limitations: [] },
    opportunities: [],
    learnings: [],
    insights: [],
    suggestedNextSteps: [],
    areasToInvestigate: [],
    limitations: [
      "PARSE_FAILED",
      "No fabricated metrics or recommendations were added.",
    ],
  };
}
