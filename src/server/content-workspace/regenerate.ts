import { getAgentLLMProvider } from "@/server/agent/llm";
import type {
  ContentDraftPayload,
  ContentDraftRecord,
  RegenerableComponent,
} from "@/server/content-workspace/types";
import { ContentWorkspaceError } from "@/server/content-workspace/types";

export type ComponentRegenerator = (args: {
  component: RegenerableComponent;
  instruction?: string;
  draft: Pick<
    ContentDraftRecord,
    | "channel"
    | "format"
    | "topic"
    | "objective"
    | "audience"
    | "pillar"
    | "angle"
    | "whyNow"
    | "blueprintReference"
    | "contentPayload"
  >;
}) => Promise<Partial<ContentDraftPayload>>;

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

function fieldHints(component: RegenerableComponent): string {
  switch (component) {
    case "hook":
      return '{"primaryHook":"...","hooks":["..."]}';
    case "script":
      return '{"script":{"scenes":[{"order":1,"voiceover":"...","visual":"..."}],"ending":"..."}}';
    case "caption":
      return '{"caption":"..."}';
    case "cta":
      return '{"cta":"...","ctaVariants":["..."]}';
    case "cover":
      return '{"cover":{"concept":"...","text":"..."}}';
    case "visual_direction":
      return '{"visualDirection":"..."}';
  }
}

export const defaultComponentRegenerator: ComponentRegenerator = async ({
  component,
  instruction,
  draft,
}) => {
  const llm = getAgentLLMProvider();
  const constraints = {
    channel: draft.channel,
    format: draft.format,
    topic: draft.topic,
    objective: draft.objective,
    audience: draft.audience,
    pillar: draft.pillar,
    angle: draft.angle,
    whyNow: draft.whyNow,
    blueprintReference: draft.blueprintReference,
  };

  const result = await llm.chat({
    model: process.env.AGENT_LLM_MODEL || "gpt-4o-mini",
    temperature: 0.6,
    maxTokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "You regenerate ONE creative component for a social content draft. " +
          "Preserve strategic constraints exactly. Return ONLY compact JSON matching the requested shape. " +
          "Do not change other components. Do not invent publishing or scheduling.",
      },
      {
        role: "user",
        content: JSON.stringify({
          regenerate: component,
          instruction: instruction || null,
          constraints,
          currentComponentSnapshot: snapshotComponent(
            draft.contentPayload,
            component,
          ),
          responseShape: fieldHints(component),
        }),
      },
    ],
  });

  const parsed = extractJsonObject(result.content || "");
  if (!parsed || typeof parsed !== "object") {
    throw new ContentWorkspaceError(
      "INVALID_INPUT",
      "Regeneration returned invalid JSON.",
    );
  }
  return parsed as Partial<ContentDraftPayload>;
};

function snapshotComponent(
  payload: ContentDraftPayload,
  component: RegenerableComponent,
): unknown {
  switch (component) {
    case "hook":
      return { primaryHook: payload.primaryHook, hooks: payload.hooks };
    case "script":
      return { script: payload.script };
    case "caption":
      return { caption: payload.caption };
    case "cta":
      return { cta: payload.cta, ctaVariants: payload.ctaVariants };
    case "cover":
      return { cover: payload.cover };
    case "visual_direction":
      return { visualDirection: payload.visualDirection };
  }
}

/** Deterministic regenerator for tests — only mutates the requested component. */
export function createStubRegenerator(
  overrides: Partial<Record<RegenerableComponent, Partial<ContentDraftPayload>>> = {},
): ComponentRegenerator {
  return async ({ component, instruction }) => {
    const base = overrides[component] ?? {};
    const tag = instruction ? ` (${instruction})` : "";
    switch (component) {
      case "hook":
        return {
          primaryHook: base.primaryHook ?? `Regenerated hook${tag}`,
          hooks: base.hooks ?? [`Regenerated hook${tag}`],
        };
      case "caption":
        return { caption: base.caption ?? `Regenerated caption${tag}` };
      case "cta":
        return {
          cta: base.cta ?? `Regenerated CTA${tag}`,
          ctaVariants: base.ctaVariants ?? [`Regenerated CTA${tag}`],
        };
      case "cover":
        return {
          cover: base.cover ?? {
            concept: `Regenerated cover${tag}`,
            text: `Cover text${tag}`,
          },
        };
      case "visual_direction":
        return {
          visualDirection:
            base.visualDirection ?? `Regenerated visual direction${tag}`,
        };
      case "script":
        return {
          script: base.script ?? {
            scenes: [
              {
                order: 1,
                voiceover: `Regenerated script${tag}`,
                visual: "Studio",
              },
            ],
            ending: "End",
          },
        };
    }
  };
}
