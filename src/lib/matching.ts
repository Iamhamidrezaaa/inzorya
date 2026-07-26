export const MATCH_RULES = [
  {
    key: "industry",
    name: "Industry Match",
    weight: 18,
    description: "Event industries overlap brand industry",
  },
  {
    key: "business_type",
    name: "Business Type Match",
    weight: 8,
    description: "Knowledge graph business type affinity",
  },
  {
    key: "product",
    name: "Product / Service Match",
    weight: 12,
    description: "Event products/services vs brand offerings",
  },
  {
    key: "audience",
    name: "Audience Match",
    weight: 14,
    description: "Event audience vs brand target audience",
  },
  {
    key: "location",
    name: "Location / Country / Region Match",
    weight: 10,
    description: "Geographic fit for the brand",
  },
  {
    key: "language",
    name: "Language Match",
    weight: 5,
    description: "Event language vs brand languages",
  },
  {
    key: "goal",
    name: "Marketing Goal Match",
    weight: 10,
    description: "Event objectives vs strategy goals",
  },
  {
    key: "channel",
    name: "Channel Match",
    weight: 8,
    description: "Distribution channels the brand already uses",
  },
  {
    key: "season",
    name: "Season Match",
    weight: 7,
    description: "Seasonal relevance to brand calendar",
  },
  {
    key: "tone",
    name: "Brand Tone Compatibility",
    weight: 5,
    description: "Emotional tone vs brand voice",
  },
  {
    key: "preparation",
    name: "Preparation Window",
    weight: 3,
    description: "Enough runway before the event date",
  },
] as const;

export const SCORE_LEVELS = [
  { key: "ignore", min: 0, max: 20, label: "Ignore" },
  { key: "low", min: 21, max: 40, label: "Low" },
  { key: "medium", min: 41, max: 60, label: "Medium" },
  { key: "high", min: 61, max: 80, label: "High" },
  { key: "critical", min: 81, max: 100, label: "Critical Opportunity" },
] as const;

export const MATCH_FILTERS = [
  { key: "upcoming", label: "Upcoming Opportunities" },
  { key: "critical", label: "Critical Opportunities" },
  { key: "ignored", label: "Ignored Opportunities" },
  { key: "expired", label: "Expired Opportunities" },
  { key: "low_confidence", label: "Low Confidence Matches" },
  { key: "manual", label: "Manual Overrides" },
] as const;

export function scoreLevelFor(overall: number) {
  if (overall <= 20) return "ignore" as const;
  if (overall <= 40) return "low" as const;
  if (overall <= 60) return "medium" as const;
  if (overall <= 80) return "high" as const;
  return "critical" as const;
}

export function impactTierFor(level: string) {
  if (level === "critical") return "high";
  if (level === "high") return "high";
  if (level === "medium") return "medium";
  return "low";
}

export function tokenize(input?: string | null) {
  if (!input) return [] as string[];
  return input
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

export function overlapScore(a: string[], b: string[]) {
  if (!a.length || !b.length) return { score: 0, hits: [] as string[] };
  const setB = new Set(b.map((x) => x.toLowerCase()));
  const hits = a.filter((x) => setB.has(x.toLowerCase()));
  const score = Math.min(100, Math.round((hits.length / Math.max(a.length, 1)) * 100));
  return { score, hits };
}

export function includesLoose(haystack: string | null | undefined, needles: string[]) {
  if (!haystack) return [] as string[];
  const h = haystack.toLowerCase();
  return needles.filter((n) => h.includes(n.toLowerCase()));
}
