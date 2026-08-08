import { z } from "zod";

export const planningModeSchema = z.enum([
  "ai_led",
  "user_constrained",
  "topic_specific",
  "hybrid",
]);

export const evidenceTypeSchema = z.enum([
  "brand",
  "strategy",
  "calendar",
  "opportunity",
  "trend",
  "performance",
  "pattern",
  "user",
]);

export const planEvidenceSchema = z.object({
  type: evidenceTypeSchema,
  reference: z.string().optional(),
  summary: z.string(),
});

export const planReasoningSchema = z.object({
  facts: z.array(z.string()).optional().default([]),
  inferences: z.array(z.string()).optional().default([]),
  unknowns: z.array(z.string()).optional().default([]),
});

export const contentPlanItemSchema = z.object({
  id: z.string(),
  date: z.string().optional(),
  channel: z.string(),
  format: z.string(),
  topic: z.string(),
  objective: z.string(),
  audience: z.string().optional(),
  pillar: z.string().optional(),
  angle: z.string(),
  whyNow: z.string(),
  evidence: z.array(planEvidenceSchema).optional().default([]),
  reasoning: planReasoningSchema.optional().default({
    facts: [],
    inferences: [],
    unknowns: [],
  }),
});

export const contentBlueprintSchema = z.object({
  request: z.object({
    original: z.string(),
    mode: planningModeSchema,
    dateRange: z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .optional()
      .default({}),
    channels: z.array(z.string()).optional().default([]),
    constraints: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  strategy: z.object({
    primaryObjective: z.string(),
    secondaryObjectives: z.array(z.string()).optional().default([]),
    summary: z.string(),
  }),
  contentPlan: z.array(contentPlanItemSchema).default([]),
  coverage: z
    .object({
      requestedCount: z.record(z.string(), z.unknown()).optional().default({}),
      plannedCount: z.record(z.string(), z.unknown()).optional().default({}),
      channels: z.array(z.string()).optional().default([]),
      formats: z.array(z.string()).optional().default([]),
    })
    .optional()
    .default({
      requestedCount: {},
      plannedCount: {},
      channels: [],
      formats: [],
    }),
  limitations: z.array(z.string()).optional().default([]),
});

export type PlanningMode = z.infer<typeof planningModeSchema>;
export type PlanEvidence = z.infer<typeof planEvidenceSchema>;
export type ContentPlanItem = z.infer<typeof contentPlanItemSchema>;
export type ContentBlueprint = z.infer<typeof contentBlueprintSchema>;

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
 * Parse LLM final text into the Content Blueprint contract.
 * Never fabricates a plan on parse failure.
 */
export function parseContentBlueprint(
  response: string,
  query: string,
): ContentBlueprint {
  const parsed = extractJsonObject(response);
  if (parsed) {
    const result = contentBlueprintSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  }

  return {
    request: {
      original: query,
      mode: "ai_led",
      dateRange: {},
      channels: [],
      constraints: {},
    },
    strategy: {
      primaryObjective: "Awareness",
      secondaryObjectives: [],
      summary:
        "Could not parse a valid Content Blueprint from the model response.",
    },
    contentPlan: [],
    coverage: {
      requestedCount: {},
      plannedCount: {},
      channels: [],
      formats: [],
    },
    limitations: [
      "The model response could not be parsed into the Content Blueprint contract.",
      "No fabricated content plan was added. No plan was persisted.",
    ],
  };
}

/** Count formats in a plan (case-insensitive key normalization). */
export function countFormats(
  plan: ContentPlanItem[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of plan) {
    const key = item.format.trim() || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
