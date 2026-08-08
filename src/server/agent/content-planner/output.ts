import { z } from "zod";

export const planningModeSchema = z.enum([
  "ai_led",
  "user_constrained",
  "fixed",
  "hybrid",
]);

export const confidenceSchema = z.enum(["high", "medium", "low"]);

export const scheduleEvidenceSchema = z.object({
  type: z.string(),
  summary: z.string(),
  kind: z.enum(["fact", "observation", "inference"]).optional(),
});

export const scheduleItemSchema = z.object({
  draftId: z.string(),
  channel: z.string(),
  socialAccountId: z.string().nullable().optional().default(null),
  date: z.string(),
  time: z.string(),
  timezone: z.string(),
  status: z.literal("planned").default("planned"),
  planningSource: z.enum(["ai", "human"]).default("ai"),
  reason: z.string().default(""),
  evidence: z.array(scheduleEvidenceSchema).default([]),
  confidence: confidenceSchema.default("medium"),
  format: z.string().optional(),
});

export const scheduleConflictSchema = z.object({
  type: z.string(),
  severity: z.enum(["warning", "error"]).default("warning"),
  items: z.array(z.string()).default([]),
  message: z.string(),
});

export const publishabilitySchema = z.object({
  draftId: z.string(),
  publishable: z.boolean(),
  reason: z.string().optional(),
});

export const contentScheduleProposalSchema = z.object({
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
    timezone: z.string().default("Asia/Tehran"),
    constraints: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  schedule: z.array(scheduleItemSchema).default([]),
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
  conflicts: z.array(scheduleConflictSchema).default([]),
  limitations: z.array(z.string()).default([]),
  publishability: z.array(publishabilitySchema).default([]),
});

export type ContentScheduleProposal = z.infer<
  typeof contentScheduleProposalSchema
>;
export type ScheduleItemProposal = z.infer<typeof scheduleItemSchema>;
export type PlanningMode = z.infer<typeof planningModeSchema>;

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

export function parseContentScheduleProposal(
  text: string,
  originalMessage: string,
): ContentScheduleProposal {
  const parsed = extractJsonObject(text);
  if (parsed && typeof parsed === "object") {
    const result = contentScheduleProposalSchema.safeParse(parsed);
    if (result.success) {
      return {
        ...result.data,
        request: {
          ...result.data.request,
          original: result.data.request.original || originalMessage,
        },
      };
    }
  }

  return contentScheduleProposalSchema.parse({
    request: {
      original: originalMessage,
      mode: "ai_led",
      timezone: "Asia/Tehran",
      constraints: {},
      dateRange: {},
    },
    schedule: [],
    coverage: {
      requestedCount: {},
      plannedCount: {},
      channels: [],
      formats: [],
    },
    conflicts: [],
    limitations: [
      "Could not parse a valid schedule proposal from the model response.",
    ],
    publishability: [],
  });
}
