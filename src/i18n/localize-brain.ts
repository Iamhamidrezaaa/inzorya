import type { BrainCompletion } from "@/lib/business-brain";
import type { Dictionary } from "./dictionaries";

export function localizeBrainCompletion(
  completion: BrainCompletion,
  brain: Dictionary["brain"],
): BrainCompletion {
  const groupLabel = (key: string, fallback: string) =>
    brain.groups[key as keyof typeof brain.groups] ?? fallback;

  const missing = completion.missing.map((m) => ({
    ...m,
    groupLabel: groupLabel(m.groupKey, m.groupLabel),
  }));

  let nextAction = completion.nextAction;
  if (nextAction && missing[0]) {
    nextAction = {
      ...nextAction,
      label: brain.continueGroup.replace(
        "{group}",
        groupLabel(missing[0].groupKey, missing[0].groupLabel),
      ),
    };
  } else if (nextAction) {
    nextAction = {
      ...nextAction,
      label: brain.resumeInterview,
    };
  }

  const recommendations = completion.recommendations.map((r) => {
    const hit = Object.entries(brain.recommendationMap).find(
      ([en]) => en === r,
    );
    return hit ? hit[1] : r;
  });

  return {
    ...completion,
    missing,
    nextAction,
    recommendations,
  };
}
