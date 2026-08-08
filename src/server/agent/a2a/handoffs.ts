import { z } from "zod";
import {
  contentBlueprintSchema,
  contentPlanItemSchema,
  type ContentBlueprint,
  type ContentPlanItem,
} from "@/server/agent/content-strategist/output";
import type { DirectorSpecialistId } from "@/server/agent/a2a/specialists";

export const specialistInvokeArgsSchema = z.object({
  message: z.string().min(1).max(8_000),
  purpose: z.string().min(1).max(500).optional(),
  constraints: z.record(z.string(), z.unknown()).optional().default({}),
  /** Compact upstream handoff — never raw unbounded dumps. */
  handoff: z.record(z.string(), z.unknown()).optional().default({}),
  /** Optional blueprint for content.creator */
  blueprint: z.unknown().optional(),
  blueprintItem: z.unknown().optional(),
  blueprintItemId: z.string().optional(),
  period: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
});

export type SpecialistInvokeArgs = z.infer<typeof specialistInvokeArgsSchema>;

export type CompactHandoff = {
  sourceAgent: DirectorSpecialistId | string;
  summary: string;
  evidence?: unknown[];
  limitations?: string[];
  insights?: unknown[];
  metricsAvailable?: boolean;
  /** Validated blueprint when present */
  blueprint?: ContentBlueprint;
  blueprintItem?: ContentPlanItem;
  constraints?: Record<string, unknown>;
  extras?: Record<string, unknown>;
};

const MAX_HANDOFF_CHARS = 4_000;

export function sanitizeHandoff(value: unknown): unknown {
  try {
    const json = JSON.stringify(value);
    if (json.length <= MAX_HANDOFF_CHARS) {
      return JSON.parse(json) as unknown;
    }
    return {
      truncated: true,
      preview: json.slice(0, MAX_HANDOFF_CHARS),
    };
  } catch {
    return { truncated: true, preview: String(value).slice(0, 500) };
  }
}

export function compactFromSpecialistResult(
  agentId: DirectorSpecialistId,
  result: Record<string, unknown>,
  constraints?: Record<string, unknown>,
): CompactHandoff {
  const limitations: string[] = [];
  if (Array.isArray(result.limitations)) {
    limitations.push(...result.limitations.map(String));
  }

  if (agentId === "social.analytics") {
    const intelligence = result.intelligence as
      | Record<string, unknown>
      | undefined;
    const overview = intelligence?.overview as
      | { available?: boolean; summary?: string; reason?: string }
      | undefined;
    if (Array.isArray(intelligence?.limitations)) {
      limitations.push(...(intelligence!.limitations as string[]).map(String));
    }
    return {
      sourceAgent: agentId,
      summary:
        overview?.summary ||
        (overview?.available === false
          ? `Analytics unavailable: ${overview.reason || "unknown"}`
          : "Social analytics completed."),
      evidence: Array.isArray(intelligence?.insights)
        ? (intelligence!.insights as unknown[]).slice(0, 8)
        : [],
      insights: Array.isArray(intelligence?.insights)
        ? (intelligence!.insights as unknown[]).slice(0, 8)
        : [],
      limitations,
      metricsAvailable: overview?.available === true,
      constraints,
      extras: sanitizeHandoff({
        platforms: intelligence?.platforms,
        topContent: Array.isArray(intelligence?.topContent)
          ? (intelligence!.topContent as unknown[]).slice(0, 5)
          : [],
        formatAnalysis: Array.isArray(intelligence?.formatAnalysis)
          ? (intelligence!.formatAnalysis as unknown[]).slice(0, 5)
          : [],
        areasToInvestigate: intelligence?.areasToInvestigate,
      }) as Record<string, unknown>,
    };
  }

  if (agentId === "marketing.analyst") {
    const analysis = result.analysis as Record<string, unknown> | undefined;
    const executive = analysis?.executiveSummary as
      | { status?: string; summary?: string }
      | undefined;
    if (Array.isArray(analysis?.limitations)) {
      limitations.push(...(analysis!.limitations as string[]).map(String));
    }
    return {
      sourceAgent: agentId,
      summary:
        executive?.summary ||
        (executive?.status === "insufficient_data"
          ? "Marketing analysis: insufficient data."
          : "Marketing analysis completed."),
      evidence: Array.isArray(analysis?.insights)
        ? (analysis!.insights as unknown[]).slice(0, 8)
        : [],
      insights: Array.isArray(analysis?.insights)
        ? (analysis!.insights as unknown[]).slice(0, 8)
        : [],
      limitations,
      metricsAvailable:
        (analysis?.performance as { available?: boolean } | undefined)
          ?.available === true,
      constraints,
      extras: sanitizeHandoff({
        scope: analysis?.scope,
        executiveSummary: analysis?.executiveSummary,
        learnings: Array.isArray(analysis?.learnings)
          ? (analysis!.learnings as unknown[]).slice(0, 5)
          : [],
        suggestedNextSteps: Array.isArray(analysis?.suggestedNextSteps)
          ? (analysis!.suggestedNextSteps as unknown[]).slice(0, 5)
          : [],
        areasToInvestigate: analysis?.areasToInvestigate,
      }) as Record<string, unknown>,
    };
  }

  if (agentId === "trend.intelligence") {
    const intelligence = result.intelligence as
      | Record<string, unknown>
      | undefined;
    if (Array.isArray(intelligence?.limitations)) {
      limitations.push(...(intelligence!.limitations as string[]).map(String));
    }
    return {
      sourceAgent: agentId,
      summary: `Trend intelligence: ${
        Array.isArray(intelligence?.trends)
          ? (intelligence!.trends as unknown[]).length
          : 0
      } item(s).`,
      evidence: Array.isArray(intelligence?.trends)
        ? (intelligence!.trends as unknown[]).slice(0, 5)
        : [],
      limitations,
      constraints,
      extras: sanitizeHandoff({
        scope: intelligence?.scope,
        trends: Array.isArray(intelligence?.trends)
          ? (intelligence!.trends as unknown[]).slice(0, 5)
          : [],
      }) as Record<string, unknown>,
    };
  }

  if (agentId === "viral.content.analyst") {
    const analysis = result.analysis as Record<string, unknown> | undefined;
    if (Array.isArray(analysis?.limitations)) {
      limitations.push(...(analysis!.limitations as string[]).map(String));
    }
    return {
      sourceAgent: agentId,
      summary: `Content analysis: ${
        Array.isArray(analysis?.patterns)
          ? (analysis!.patterns as unknown[]).length
          : 0
      } pattern(s).`,
      evidence: Array.isArray(analysis?.patterns)
        ? (analysis!.patterns as unknown[]).slice(0, 5)
        : [],
      limitations,
      constraints,
      extras: sanitizeHandoff({
        contentAnalyzed: Array.isArray(analysis?.contentAnalyzed)
          ? (analysis!.contentAnalyzed as unknown[]).slice(0, 3)
          : [],
        brandFit: analysis?.brandFit,
      }) as Record<string, unknown>,
    };
  }

  if (agentId === "content.strategist") {
    const blueprint = result.blueprint as ContentBlueprint | undefined;
    if (blueprint?.limitations?.length) {
      limitations.push(...blueprint.limitations);
    }
    return {
      sourceAgent: agentId,
      summary: blueprint?.strategy?.summary || "Content blueprint produced.",
      blueprint,
      blueprintItem: blueprint?.contentPlan?.[0],
      limitations,
      constraints: {
        ...(constraints || {}),
        ...(blueprint?.request?.constraints || {}),
      },
      extras: sanitizeHandoff({
        coverage: blueprint?.coverage,
        mode: blueprint?.request?.mode,
        planCount: blueprint?.contentPlan?.length ?? 0,
      }) as Record<string, unknown>,
    };
  }

  if (agentId === "content.creator") {
    const asset = result.asset as Record<string, unknown> | undefined;
    const quality = asset?.quality as { limitations?: string[] } | undefined;
    if (quality?.limitations?.length) {
      limitations.push(...quality.limitations);
    }
    return {
      sourceAgent: agentId,
      summary: "Creative assets produced from Blueprint.",
      limitations,
      constraints,
      extras: sanitizeHandoff({
        content: asset?.content,
        hooks: (asset?.creative as { hooks?: string[] } | undefined)?.hooks,
        caption: (asset?.creative as { caption?: string } | undefined)?.caption,
      }) as Record<string, unknown>,
    };
  }

  // marketing.readonly
  return {
    sourceAgent: agentId,
    summary:
      typeof result.response === "string"
        ? result.response.slice(0, 800)
        : "Marketing intelligence completed.",
    limitations,
    constraints,
    extras: sanitizeHandoff({
      toolResults: Array.isArray(result.toolResults)
        ? (result.toolResults as unknown[]).slice(0, 5)
        : [],
    }) as Record<string, unknown>,
  };
}

export function validateSpecialistInvokeArgs(
  agentId: DirectorSpecialistId,
  raw: unknown,
):
  | { ok: true; args: SpecialistInvokeArgs; blueprint?: ContentBlueprint; blueprintItem?: ContentPlanItem }
  | { ok: false; error: string } {
  const parsed = specialistInvokeArgsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Invalid specialist invoke arguments." };
  }

  let blueprint: ContentBlueprint | undefined;
  let blueprintItem: ContentPlanItem | undefined;

  if (parsed.data.blueprint !== undefined) {
    const bp = contentBlueprintSchema.safeParse(parsed.data.blueprint);
    if (!bp.success) {
      return { ok: false, error: "Invalid Content Blueprint in invoke args." };
    }
    blueprint = bp.data;
  }

  if (parsed.data.blueprintItem !== undefined) {
    const item = contentPlanItemSchema.safeParse(parsed.data.blueprintItem);
    if (!item.success) {
      return {
        ok: false,
        error: "Invalid Content Blueprint item in invoke args.",
      };
    }
    blueprintItem = item.data;
  }

  if (agentId === "content.creator") {
    const fromHandoff = parsed.data.handoff as {
      blueprint?: unknown;
      blueprintItem?: unknown;
    };
    if (!blueprint && fromHandoff?.blueprint) {
      const bp = contentBlueprintSchema.safeParse(fromHandoff.blueprint);
      if (bp.success) blueprint = bp.data;
    }
    if (!blueprintItem && fromHandoff?.blueprintItem) {
      const item = contentPlanItemSchema.safeParse(fromHandoff.blueprintItem);
      if (item.success) blueprintItem = item.data;
    }
    if (!blueprintItem && blueprint?.contentPlan?.length === 1) {
      blueprintItem = blueprint.contentPlan[0];
    }
    if (!blueprintItem && !blueprint?.contentPlan?.length) {
      return {
        ok: false,
        error:
          "content.creator requires a validated Content Blueprint or blueprint item.",
      };
    }
  }

  return { ok: true, args: parsed.data, blueprint, blueprintItem };
}
