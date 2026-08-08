import { z } from "zod";
import type { ContentPlanItem } from "@/server/agent/content-strategist/output";

export const sceneSchema = z.object({
  order: z.number().int().positive(),
  duration: z.string().optional(),
  visual: z.string().optional(),
  voiceover: z.string().optional(),
  onScreenText: z.string().optional(),
  productionNote: z.string().optional(),
});

export const carouselSlideSchema = z.object({
  order: z.number().int().positive(),
  purpose: z.string().optional(),
  copy: z.string().optional(),
  visual: z.string().optional(),
});

export const storyFrameSchema = z.object({
  order: z.number().int().positive(),
  purpose: z.string().optional(),
  onScreenText: z.string().optional(),
  visual: z.string().optional(),
  interaction: z.string().optional(),
});

export const coverSchema = z.object({
  concept: z.string().optional(),
  text: z.string().optional(),
});

export const creativeBlockSchema = z.object({
  hooks: z.array(z.string()).optional().default([]),
  primaryHook: z.string().optional().default(""),
  script: z
    .object({
      scenes: z.array(sceneSchema).optional().default([]),
      ending: z.string().optional(),
    })
    .optional(),
  carousel: z
    .object({
      cover: coverSchema.optional(),
      slides: z.array(carouselSlideSchema).optional().default([]),
    })
    .optional(),
  story: z
    .object({
      frames: z.array(storyFrameSchema).optional().default([]),
    })
    .optional(),
  staticPost: z
    .object({
      headline: z.string().optional(),
      body: z.string().optional(),
      visualDirection: z.string().optional(),
    })
    .optional(),
  caption: z.string().optional(),
  cta: z.string().optional(),
  ctaVariants: z.array(z.string()).optional().default([]),
  cover: coverSchema.optional(),
  hashtags: z.array(z.string()).optional().default([]),
  productionNotes: z.array(z.string()).optional().default([]),
});

export const contentAssetSchema = z.object({
  blueprintReference: z.string().optional().default(""),
  content: z.object({
    channel: z.string(),
    format: z.string(),
    topic: z.string(),
    objective: z.string(),
    audience: z.string().optional(),
    angle: z.string(),
    pillar: z.string().optional(),
  }),
  creative: creativeBlockSchema.default({
    hooks: [],
    primaryHook: "",
    ctaVariants: [],
    hashtags: [],
    productionNotes: [],
  }),
  quality: z
    .object({
      strategicConsistency: z.string().optional().default(""),
      brandConsistency: z.string().optional().default(""),
      blueprintConcern: z.string().optional(),
      limitations: z.array(z.string()).optional().default([]),
    })
    .optional()
    .default({
      strategicConsistency: "",
      brandConsistency: "",
      limitations: [],
    }),
});

export type ContentAsset = z.infer<typeof contentAssetSchema>;
export type CreativeBlock = z.infer<typeof creativeBlockSchema>;

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

function norm(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

/**
 * Ensure Creator output did not silently mutate Blueprint strategic fields.
 * Appends limitations / blueprintConcern when drift is detected.
 */
export function enforceBlueprintFidelity(
  asset: ContentAsset,
  blueprintItem?: ContentPlanItem | null,
): ContentAsset {
  if (!blueprintItem) return asset;

  const drifts: string[] = [];
  if (
    blueprintItem.format &&
    norm(asset.content.format) !== norm(blueprintItem.format)
  ) {
    drifts.push(
      `format drift: blueprint=${blueprintItem.format}, output=${asset.content.format}`,
    );
  }
  if (
    blueprintItem.topic &&
    norm(asset.content.topic) !== norm(blueprintItem.topic)
  ) {
    drifts.push(
      `topic drift: blueprint=${blueprintItem.topic}, output=${asset.content.topic}`,
    );
  }
  if (
    blueprintItem.objective &&
    norm(asset.content.objective) !== norm(blueprintItem.objective)
  ) {
    drifts.push(
      `objective drift: blueprint=${blueprintItem.objective}, output=${asset.content.objective}`,
    );
  }
  if (
    blueprintItem.channel &&
    norm(asset.content.channel) !== norm(blueprintItem.channel)
  ) {
    drifts.push(
      `channel drift: blueprint=${blueprintItem.channel}, output=${asset.content.channel}`,
    );
  }

  if (drifts.length === 0) return asset;

  // Restore strategic fields from Blueprint; keep creative as-is but flag concern.
  return {
    ...asset,
    content: {
      ...asset.content,
      channel: blueprintItem.channel,
      format: blueprintItem.format,
      topic: blueprintItem.topic,
      objective: blueprintItem.objective,
      audience: blueprintItem.audience ?? asset.content.audience,
      angle: blueprintItem.angle,
      pillar: blueprintItem.pillar ?? asset.content.pillar,
    },
    quality: {
      ...asset.quality,
      blueprintConcern:
        asset.quality.blueprintConcern ||
        "Creator output drifted from Blueprint; strategic fields restored from Blueprint.",
      limitations: [
        ...(asset.quality.limitations || []),
        ...drifts.map((d) => `Blueprint fidelity: ${d}`),
      ],
    },
  };
}

export function parseContentAsset(
  response: string,
  query: string,
  blueprintItem?: ContentPlanItem | null,
): ContentAsset {
  const parsed = extractJsonObject(response);
  if (parsed) {
    const result = contentAssetSchema.safeParse(parsed);
    if (result.success) {
      return enforceBlueprintFidelity(result.data, blueprintItem);
    }
  }

  const fallback: ContentAsset = {
    blueprintReference: blueprintItem?.id || "",
    content: {
      channel: blueprintItem?.channel || "unknown",
      format: blueprintItem?.format || "unknown",
      topic: blueprintItem?.topic || query,
      objective: blueprintItem?.objective || "unknown",
      audience: blueprintItem?.audience,
      angle: blueprintItem?.angle || "",
      pillar: blueprintItem?.pillar,
    },
    creative: {
      hooks: [],
      primaryHook: "",
      ctaVariants: [],
      hashtags: [],
      productionNotes: [],
    },
    quality: {
      strategicConsistency: "unavailable",
      brandConsistency: "unavailable",
      limitations: [
        "The model response could not be parsed into the Content Asset contract.",
        "No fabricated creative assets were added. No ContentItem was persisted.",
      ],
    },
  };
  return fallback;
}
