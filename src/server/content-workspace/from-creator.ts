import type { ContentAsset } from "@/server/agent/content-creator/output";
import { payloadFromCreatorAsset } from "@/server/content-workspace/payload";
import type {
  BlueprintReference,
  ContentDraftPayload,
  EvidenceItem,
} from "@/server/content-workspace/types";
import { ContentWorkspaceError } from "@/server/content-workspace/types";

export type CreateFromCreatorInput = {
  workspaceId: string;
  brandId: string;
  createdById: string;
  asset: ContentAsset;
  sourceAgentExecutionId?: string | null;
  blueprintReference?: BlueprintReference | null;
  evidence?: EvidenceItem[] | null;
  whyNow?: string | null;
};

export type CreateFromCreatorMapped = {
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
};

export function mapCreatorAssetToDraft(
  input: CreateFromCreatorInput,
): CreateFromCreatorMapped {
  const { asset } = input;
  if (!asset?.content?.channel || !asset.content.format || !asset.content.topic) {
    throw new ContentWorkspaceError(
      "INVALID_INPUT",
      "Creator output must include channel, format, and topic.",
    );
  }

  const evidence =
    input.evidence ??
    (Array.isArray((asset as { evidence?: EvidenceItem[] }).evidence)
      ? (asset as { evidence?: EvidenceItem[] }).evidence!
      : null);

  return {
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    createdById: input.createdById,
    sourceAgentExecutionId: input.sourceAgentExecutionId ?? null,
    blueprintReference: input.blueprintReference ?? {
      summary: asset.blueprintReference || undefined,
    },
    channel: asset.content.channel,
    format: asset.content.format,
    topic: asset.content.topic,
    objective: asset.content.objective || null,
    audience: asset.content.audience || null,
    pillar: asset.content.pillar || null,
    angle: asset.content.angle || null,
    whyNow: input.whyNow ?? null,
    evidence,
    contentPayload: payloadFromCreatorAsset(asset),
  };
}
