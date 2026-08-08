/** Intent → route helpers for the AI-first home experience. */

export type HomeIntent =
  | "content_week"
  | "campaign"
  | "analyze"
  | "opportunities"
  | "generate"
  | "ask"
  | "custom";

export function resolveIntentPath(
  brandBase: string,
  intent: HomeIntent,
  prompt?: string,
): string {
  const q = prompt?.trim() ? `?q=${encodeURIComponent(prompt.trim())}` : "";
  switch (intent) {
    case "content_week":
      return `${brandBase}/planner${q || "?intent=week"}`;
    case "campaign":
      return `${brandBase}/strategist?intent=campaign${prompt?.trim() ? `&q=${encodeURIComponent(prompt.trim())}` : ""}`;
    case "analyze":
      return `${brandBase}/analytics`;
    case "opportunities":
      return `${brandBase}/opportunities`;
    case "generate":
      return `${brandBase}/creator${q || "?intent=generate"}`;
    case "ask":
    case "custom":
    default:
      return `${brandBase}/strategist${q}`;
  }
}
