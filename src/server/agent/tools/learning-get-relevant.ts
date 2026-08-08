import { z } from "zod";
import type { ToolDefinition } from "@/server/agent/types";
import { getContentLearningEngine } from "@/server/content-learning";
import {
  clampLimit,
  resolveScopedBrandId,
} from "@/server/agent/tools/scope";

const inputSchema = z.object({
  brandId: z.string().min(1).optional(),
  platform: z.string().min(1).optional(),
  dimension: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  objective: z.string().min(1).optional(),
  format: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
});

const learningSchema = z.object({
  id: z.string(),
  platform: z.string().nullable(),
  dimension: z.string(),
  type: z.enum(["FACT", "OBSERVATION", "INFERENCE"]),
  statement: z.string(),
  rationale: z.string(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  sampleSize: z.number(),
  metric: z.string(),
  periodFrom: z.string().nullable(),
  periodTo: z.string().nullable(),
  lastObservedAt: z.string(),
  status: z.enum(["ACTIVE", "STALE", "ARCHIVED"]),
  outlierPresent: z.boolean(),
  limitations: z.array(z.string()),
  evidenceCount: z.number().optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  learnings: z.array(learningSchema),
  limitations: z.array(z.string()),
});

/**
 * READ-only. Never mutates learnings, strategy, content, or schedules.
 */
export const learningGetRelevantTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "learning.getRelevant",
  name: "Relevant Content Learnings",
  description:
    "Read evidence-backed historical content performance learnings for the brand. Observations only — no predictions or mutations.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);
    const limit = clampLimit(input.limit, 10, 30);
    const result = await getContentLearningEngine().getRelevant({
      scope: {
        workspaceId: ctx.workspaceId,
        brandId,
      },
      platform: input.platform,
      dimension: input.dimension,
      topic: input.topic,
      objective: input.objective,
      format: input.format,
      limit,
    });

    return {
      available: result.available,
      reason: result.reason,
      limitations: result.limitations,
      learnings: result.learnings.map((l) => ({
        id: l.id,
        platform: l.platform,
        dimension: l.dimension,
        type: l.type,
        statement: l.statement,
        rationale: l.rationale,
        confidence: l.confidence,
        sampleSize: l.sampleSize,
        metric: l.metric,
        periodFrom: l.periodFrom,
        periodTo: l.periodTo,
        lastObservedAt: l.lastObservedAt,
        status: l.status,
        outlierPresent: l.outlierPresent,
        limitations: l.limitations,
        evidenceCount: l.evidenceCount,
      })),
    };
  },
};
