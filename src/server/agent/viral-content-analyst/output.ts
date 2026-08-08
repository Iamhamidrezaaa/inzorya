import { z } from "zod";

const confidenceSchema = z.enum(["high", "medium", "low"]);

export const contentPerformanceSchema = z.object({
  available: z.boolean(),
  metrics: z.record(z.string(), z.unknown()).optional().default({}),
});

export const contentObservationsSchema = z.object({
  hook: z.string().optional(),
  structure: z.array(z.string()).optional().default([]),
  format: z.string().optional(),
  topic: z.string().optional(),
  audience: z.string().optional(),
  emotionalMechanism: z.array(z.string()).optional().default([]),
  valueMechanism: z.array(z.string()).optional().default([]),
  cta: z.string().optional(),
  visualPattern: z.array(z.string()).optional().default([]),
});

export const analyzedContentSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  source: z.string().optional(),
  performance: contentPerformanceSchema.default({
    available: false,
    metrics: {},
  }),
  observations: contentObservationsSchema.default({
    structure: [],
    emotionalMechanism: [],
    valueMechanism: [],
    visualPattern: [],
  }),
  inferences: z.array(z.string()).optional().default([]),
});

export const contentPatternSchema = z.object({
  pattern: z.string(),
  evidence: z.array(z.string()).default([]),
  confidence: confidenceSchema,
  transferability: confidenceSchema,
  why: z.string(),
  whatNotToCopy: z.string().optional(),
});

export const brandFitSchema = z.object({
  pattern: z.string(),
  relevance: confidenceSchema,
  why: z.string(),
});

export const viralContentAnalysisSchema = z.object({
  query: z.string(),
  analysisScope: z
    .object({
      brand: z.string().optional(),
      industry: z.string().optional(),
      channel: z.string().optional(),
      period: z.string().optional(),
    })
    .optional()
    .default({}),
  contentAnalyzed: z.array(analyzedContentSchema).default([]),
  patterns: z.array(contentPatternSchema).default([]),
  brandFit: z.array(brandFitSchema).default([]),
  limitations: z.array(z.string()).optional().default([]),
});

export type ContentPerformance = z.infer<typeof contentPerformanceSchema>;
export type ContentObservations = z.infer<typeof contentObservationsSchema>;
export type AnalyzedContent = z.infer<typeof analyzedContentSchema>;
export type ContentPattern = z.infer<typeof contentPatternSchema>;
export type BrandFitItem = z.infer<typeof brandFitSchema>;
export type ViralContentAnalysisResult = z.infer<
  typeof viralContentAnalysisSchema
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
 * Parse LLM final text into the Viral Content Analysis contract.
 * Never fabricates patterns or metrics on parse failure.
 */
export function parseViralContentAnalysis(
  response: string,
  query: string,
): ViralContentAnalysisResult {
  const parsed = extractJsonObject(response);
  if (parsed) {
    const result = viralContentAnalysisSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  return {
    query,
    analysisScope: {},
    contentAnalyzed: [],
    patterns: [],
    brandFit: [],
    limitations: [
      "The model response could not be parsed into the Viral Content Analysis contract.",
      "No fabricated patterns or metrics were added.",
    ],
  };
}
