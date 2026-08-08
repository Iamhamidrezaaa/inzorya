import { z } from "zod";
import type { DirectorIntent } from "@/server/agent/a2a/specialists";

export const directorIntentSchema = z.enum([
  "INFORMATION",
  "TREND_RESEARCH",
  "CONTENT_ANALYSIS",
  "CONTENT_PLANNING",
  "CONTENT_CREATION",
  "PERFORMANCE_ANALYSIS",
  "STRATEGIC_ANALYSIS",
  "CALENDAR_OPPORTUNITY",
  "MULTI_STEP_MARKETING_TASK",
  "UNKNOWN",
]);

export const directorFinalSchema = z.object({
  intent: directorIntentSchema.default("UNKNOWN"),
  constraints: z.record(z.string(), z.unknown()).optional().default({}),
  response: z.string().min(1),
  stepsSummary: z
    .array(
      z.object({
        agent: z.string(),
        purpose: z.string().optional().default(""),
        status: z.enum(["completed", "failed", "skipped"]).default("completed"),
      }),
    )
    .optional()
    .default([]),
  limitations: z.array(z.string()).optional().default([]),
  conflicts: z
    .array(
      z.object({
        topic: z.string(),
        sides: z.array(z.string()).default([]),
        decision: z.string().optional().default(""),
      }),
    )
    .optional()
    .default([]),
});

export type DirectorFinalResult = z.infer<typeof directorFinalSchema>;

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

export function parseDirectorFinal(
  response: string,
  fallbackMessage: string,
): DirectorFinalResult {
  const parsed = extractJsonObject(response);
  if (parsed) {
    const result = directorFinalSchema.safeParse(parsed);
    if (result.success) return result.data;
  }

  // If model returned plain prose, wrap it.
  const prose = response.trim();
  if (prose && !prose.startsWith("{")) {
    return {
      intent: "UNKNOWN" as DirectorIntent,
      constraints: {},
      response: prose,
      stepsSummary: [],
      limitations: [],
      conflicts: [],
    };
  }

  return {
    intent: "UNKNOWN",
    constraints: {},
    response:
      fallbackMessage ||
      "I could not complete the orchestration with a valid final answer.",
    stepsSummary: [],
    limitations: [
      "Director final response could not be parsed into the expected contract.",
    ],
    conflicts: [],
  };
}

export type DirectorStepState = {
  agent: string;
  purpose: string;
  status: "pending" | "running" | "completed" | "failed";
  input?: unknown;
  output?: unknown;
  limitations?: string[];
  executionId?: string;
};
