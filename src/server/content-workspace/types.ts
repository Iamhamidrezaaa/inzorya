import type {
  ContentDraftStatus,
  ContentDraftVersionSource,
  ContentReviewStatus,
} from "@prisma/client";
import { z } from "zod";

export const regenerableComponentSchema = z.enum([
  "hook",
  "script",
  "caption",
  "cta",
  "cover",
  "visual_direction",
]);

export type RegenerableComponent = z.infer<typeof regenerableComponentSchema>;

export const contentDraftPayloadSchema = z.object({
  primaryHook: z.string().default(""),
  hooks: z.array(z.string()).default([]),
  script: z
    .object({
      scenes: z
        .array(
          z.object({
            order: z.number().int().positive(),
            duration: z.string().optional(),
            visual: z.string().optional(),
            voiceover: z.string().optional(),
            onScreenText: z.string().optional(),
            productionNote: z.string().optional(),
          }),
        )
        .default([]),
      ending: z.string().optional(),
    })
    .optional(),
  carousel: z
    .object({
      cover: z
        .object({
          concept: z.string().optional(),
          text: z.string().optional(),
        })
        .optional(),
      slides: z
        .array(
          z.object({
            order: z.number().int().positive(),
            purpose: z.string().optional(),
            copy: z.string().optional(),
            visual: z.string().optional(),
          }),
        )
        .default([]),
    })
    .optional(),
  story: z
    .object({
      frames: z
        .array(
          z.object({
            order: z.number().int().positive(),
            purpose: z.string().optional(),
            onScreenText: z.string().optional(),
            visual: z.string().optional(),
            interaction: z.string().optional(),
          }),
        )
        .default([]),
    })
    .optional(),
  staticPost: z
    .object({
      headline: z.string().optional(),
      body: z.string().optional(),
      visualDirection: z.string().optional(),
    })
    .optional(),
  caption: z.string().default(""),
  cta: z.string().default(""),
  ctaVariants: z.array(z.string()).default([]),
  cover: z
    .object({
      concept: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
  visualDirection: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
  productionNotes: z.array(z.string()).default([]),
});

export type ContentDraftPayload = z.infer<typeof contentDraftPayloadSchema>;

export const humanEditSchema = z.object({
  primaryHook: z.string().optional(),
  hooks: z.array(z.string()).optional(),
  script: contentDraftPayloadSchema.shape.script,
  carousel: contentDraftPayloadSchema.shape.carousel,
  story: contentDraftPayloadSchema.shape.story,
  staticPost: contentDraftPayloadSchema.shape.staticPost,
  caption: z.string().optional(),
  cta: z.string().optional(),
  ctaVariants: z.array(z.string()).optional(),
  cover: contentDraftPayloadSchema.shape.cover,
  visualDirection: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  productionNotes: z.array(z.string()).optional(),
});

export type HumanEditInput = z.infer<typeof humanEditSchema>;

export type BlueprintReference = {
  blueprintId?: string;
  planItemId?: string;
  summary?: string;
  strategySummary?: string;
  primaryObjective?: string;
};

export type EvidenceItem = {
  type: string;
  reference?: string;
  summary: string;
};

export type ContentDraftRecord = {
  id: string;
  workspaceId: string;
  brandId: string;
  createdById: string;
  sourceAgentExecutionId: string | null;
  blueprintReference: BlueprintReference | null;
  channel: string;
  format: string;
  topic: string;
  objective: string | null;
  audience: string | null;
  pillar: string | null;
  angle: string | null;
  whyNow: string | null;
  evidence: EvidenceItem[] | null;
  contentPayload: ContentDraftPayload;
  status: ContentDraftStatus;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ContentDraftVersionRecord = {
  id: string;
  contentDraftId: string;
  version: number;
  source: ContentDraftVersionSource;
  contentPayload: ContentDraftPayload;
  changeSummary: string | null;
  component: string | null;
  instruction: string | null;
  createdById: string | null;
  createdAt: Date;
};

export type ContentReviewRecord = {
  id: string;
  contentDraftId: string;
  reviewerId: string;
  status: ContentReviewStatus;
  note: string | null;
  createdAt: Date;
};

export type ReviewAction =
  | "send_for_review"
  | "request_changes"
  | "approve"
  | "mark_ready"
  | "note";

export class ContentWorkspaceError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "INVALID_TRANSITION"
    | "INVALID_INPUT"
    | "PUBLISH_NOT_ALLOWED";

  constructor(
    code: ContentWorkspaceError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ContentWorkspaceError";
    this.code = code;
  }
}
