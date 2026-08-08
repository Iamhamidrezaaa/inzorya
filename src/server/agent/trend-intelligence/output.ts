import { z } from "zod";

export const trendEvidenceSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  source: z.string().optional(),
  publishedAt: z.string().optional(),
  snippet: z.string().optional(),
});

export const trendItemSchema = z.object({
  topic: z.string(),
  classification: z.enum([
    "signal",
    "emerging_pattern",
    "trend",
    "insufficient_evidence",
  ]),
  relevance: z.enum(["high", "medium", "low"]),
  summary: z.string(),
  whyRelevant: z.string().optional().default(""),
  evidence: z.array(trendEvidenceSchema).optional().default([]),
  observedSignals: z.array(z.string()).optional().default([]),
  facts: z.array(z.string()).optional().default([]),
  inferences: z.array(z.string()).optional().default([]),
  unknowns: z.array(z.string()).optional().default([]),
});

export const trendIntelligenceSchema = z.object({
  query: z.string(),
  scope: z
    .object({
      industry: z.string().optional(),
      location: z.string().optional(),
      period: z.string().optional(),
    })
    .optional()
    .default({}),
  trends: z.array(trendItemSchema).default([]),
  limitations: z.array(z.string()).optional().default([]),
});

export type TrendEvidence = z.infer<typeof trendEvidenceSchema>;
export type TrendItem = z.infer<typeof trendItemSchema>;
export type TrendIntelligenceResult = z.infer<typeof trendIntelligenceSchema>;

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Prefer fenced JSON if present.
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
 * Parse LLM final text into the Trend Intelligence contract.
 * Never fabricates trends — falls back to an empty structured result with limitations.
 */
export function parseTrendIntelligence(
  response: string,
  query: string,
): TrendIntelligenceResult {
  const parsed = extractJsonObject(response);
  if (parsed) {
    const result = trendIntelligenceSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  return {
    query,
    scope: {},
    trends: [],
    limitations: [
      "The model response could not be parsed into the Trend Intelligence contract.",
      "No fabricated trends were added.",
    ],
  };
}
