import { z } from "zod";
import { utcToday } from "@/lib/calendar";
import { getMatchingDashboard } from "@/server/services/opportunity-matching";
import type { ToolDefinition } from "@/server/agent/types";
import {
  clampLimit,
  resolveScopedBrandId,
} from "@/server/agent/tools/scope";

const inputSchema = z.object({
  brandId: z.string().min(1).optional(),
  horizonDays: z.number().int().positive().optional(),
  minScore: z.number().optional(),
  status: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
});

const opportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  score: z.number().nullable(),
  scoreLevel: z.string().nullable(),
  confidence: z.number().nullable(),
  explanation: z.string().nullable(),
  whyMatched: z.string().nullable(),
  event: z
    .object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      date: z.string().nullable(),
    })
    .nullable(),
  evidence: z.array(
    z.object({
      ruleKey: z.string(),
      passed: z.boolean(),
      detail: z.string().nullable(),
      weight: z.number().nullable().optional(),
      contribution: z.number().nullable().optional(),
    }),
  ),
  matchingFactors: z.object({
    rulesMatched: z.array(z.string()),
    rulesFailed: z.array(z.string()),
    missingInfo: z.array(z.string()),
  }),
  preparationWindow: z.object({
    planningStart: z.string().nullable(),
    contentDeadline: z.string().nullable(),
    designDeadline: z.string().nullable(),
    approvalDeadline: z.string().nullable(),
    publishingStart: z.string().nullable(),
    publishingEnd: z.string().nullable(),
  }),
});

const outputSchema = z.object({
  opportunities: z.array(opportunitySchema),
  total: z.number(),
  limit: z.number(),
  horizonDays: z.number(),
});

export type OpportunityGetRelevantOutput = z.infer<typeof outputSchema>;

/** Matches deterministic matching engine default horizon. */
const DEFAULT_HORIZON_DAYS = 120;

export const opportunityGetRelevantTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  OpportunityGetRelevantOutput
> = {
  id: "opportunity.getRelevant",
  name: "Relevant Opportunities",
  description:
    "Read existing deterministic matching opportunities for the brand (no re-scoring).",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);
    const limit = clampLimit(input.limit, 20, 50);
    const horizonDays = input.horizonDays ?? DEFAULT_HORIZON_DAYS;

    const dashboard = await getMatchingDashboard({
      workspaceId: ctx.workspaceId,
      brandId,
    });

    const today = utcToday();
    const horizonEnd = new Date(today);
    horizonEnd.setUTCDate(horizonEnd.getUTCDate() + horizonDays);

    let rows = dashboard.upcoming.filter((row) => {
      if (row.eventDate > horizonEnd) return false;
      if (input.status && row.status !== input.status) return false;
      const overall = row.score?.overall ?? null;
      if (input.minScore != null) {
        if (overall == null || overall < input.minScore) return false;
      }
      return true;
    });

    const total = rows.length;
    rows = rows.slice(0, limit);

    return {
      total,
      limit,
      horizonDays,
      opportunities: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        score: row.score?.overall ?? null,
        scoreLevel: row.scoreLevel,
        confidence: row.confidence ?? row.score?.confidence ?? null,
        explanation: row.score?.explanation ?? row.summary ?? null,
        whyMatched: row.whyMatched ?? row.matchReason ?? null,
        event: row.event
          ? {
              id: row.event.id,
              key: row.event.key,
              name: row.event.name,
              date: row.eventDate.toISOString().slice(0, 10),
            }
          : null,
        evidence: (row.evidence ?? []).map((e) => ({
          ruleKey: e.ruleKey,
          passed: e.passed,
          detail: e.detail ?? null,
          weight: e.weight ?? null,
          contribution: e.contribution ?? null,
        })),
        matchingFactors: {
          rulesMatched: row.rulesMatched ?? [],
          rulesFailed: row.rulesFailed ?? [],
          missingInfo: row.missingInfo ?? [],
        },
        preparationWindow: {
          planningStart: row.planningStart?.toISOString() ?? null,
          contentDeadline: row.contentDeadline?.toISOString() ?? null,
          designDeadline: row.designDeadline?.toISOString() ?? null,
          approvalDeadline: row.approvalDeadline?.toISOString() ?? null,
          publishingStart: row.publishingStart?.toISOString() ?? null,
          publishingEnd: row.publishingEnd?.toISOString() ?? null,
        },
      })),
    };
  },
};
