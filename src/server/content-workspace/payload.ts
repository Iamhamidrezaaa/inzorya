import type { ContentAsset } from "@/server/agent/content-creator/output";
import {
  contentDraftPayloadSchema,
  type ContentDraftPayload,
  type HumanEditInput,
  type RegenerableComponent,
} from "@/server/content-workspace/types";

export function payloadFromCreatorAsset(
  asset: ContentAsset,
): ContentDraftPayload {
  const c = asset.creative;
  const visualFromStatic = c.staticPost?.visualDirection ?? "";
  return contentDraftPayloadSchema.parse({
    primaryHook: c.primaryHook || c.hooks?.[0] || "",
    hooks: c.hooks ?? [],
    script: c.script,
    carousel: c.carousel,
    story: c.story,
    staticPost: c.staticPost,
    caption: c.caption ?? "",
    cta: c.cta ?? "",
    ctaVariants: c.ctaVariants ?? [],
    cover: c.cover ?? c.carousel?.cover,
    visualDirection: visualFromStatic,
    hashtags: c.hashtags ?? [],
    productionNotes: c.productionNotes ?? [],
  });
}

export function applyHumanEdit(
  current: ContentDraftPayload,
  edit: HumanEditInput,
): ContentDraftPayload {
  return contentDraftPayloadSchema.parse({
    ...current,
    ...edit,
  });
}

/** Merge only the regenerated component into the existing payload. */
export function applyComponentPatch(
  current: ContentDraftPayload,
  component: RegenerableComponent,
  patch: Partial<ContentDraftPayload>,
): ContentDraftPayload {
  const next: ContentDraftPayload = { ...current };

  switch (component) {
    case "hook":
      if (patch.primaryHook !== undefined) next.primaryHook = patch.primaryHook;
      if (patch.hooks !== undefined) next.hooks = patch.hooks;
      else if (patch.primaryHook !== undefined) {
        next.hooks = [patch.primaryHook, ...current.hooks.filter((h) => h !== patch.primaryHook)];
      }
      break;
    case "script":
      if (patch.script !== undefined) next.script = patch.script;
      break;
    case "caption":
      if (patch.caption !== undefined) next.caption = patch.caption;
      break;
    case "cta":
      if (patch.cta !== undefined) next.cta = patch.cta;
      if (patch.ctaVariants !== undefined) next.ctaVariants = patch.ctaVariants;
      break;
    case "cover":
      if (patch.cover !== undefined) next.cover = patch.cover;
      break;
    case "visual_direction":
      if (patch.visualDirection !== undefined) {
        next.visualDirection = patch.visualDirection;
      }
      if (patch.staticPost?.visualDirection !== undefined) {
        next.staticPost = {
          ...current.staticPost,
          ...patch.staticPost,
        };
      }
      break;
  }

  return contentDraftPayloadSchema.parse(next);
}

export function searchTextFromPayload(payload: ContentDraftPayload): string {
  const parts = [
    payload.primaryHook,
    payload.caption,
    payload.cta,
    payload.visualDirection,
    payload.cover?.text,
    payload.cover?.concept,
    ...(payload.hooks ?? []),
    ...(payload.productionNotes ?? []),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}
