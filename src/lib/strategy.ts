export const MARKETING_GOAL_OPTIONS = [
  { key: "increase_sales", label: "Increase Sales" },
  { key: "generate_leads", label: "Generate Leads" },
  { key: "grow_followers", label: "Grow Followers" },
  { key: "increase_engagement", label: "Increase Engagement" },
  { key: "brand_awareness", label: "Brand Awareness" },
  { key: "customer_support", label: "Customer Support" },
  { key: "launch_product", label: "Launch Product" },
  { key: "website_traffic", label: "Website Traffic" },
  { key: "local_customers", label: "Local Customers" },
  { key: "recruitment", label: "Recruitment" },
] as const;

export type MarketingGoalKey = (typeof MARKETING_GOAL_OPTIONS)[number]["key"];

export const CONTENT_TYPE_OPTIONS = [
  { key: "REELS", label: "Reels" },
  { key: "CAROUSEL", label: "Carousel" },
  { key: "STORY", label: "Story" },
  { key: "SHORTS", label: "Shorts" },
  { key: "POST", label: "Post" },
] as const;

export const PLATFORM_OPTIONS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "X",
  "WhatsApp",
  "Telegram",
] as const;

export const DEFAULT_CONTENT_PILLARS = [
  { name: "Education", description: "Teach your audience something useful." },
  { name: "Behind the Scenes", description: "Show how the work happens." },
  { name: "Testimonials", description: "Social proof and customer stories." },
  { name: "Entertainment", description: "Light, shareable moments." },
  { name: "FAQ", description: "Answer common questions." },
  { name: "Offers", description: "Promotions and calls to action." },
  { name: "Culture", description: "Team, values, and brand personality." },
] as const;

export const ROADMAP_STAGES = [
  {
    id: "understand",
    label: "Understand business",
    hint: "Complete business overview and voice.",
  },
  {
    id: "goals",
    label: "Set marketing goals",
    hint: "Pick what success looks like.",
  },
  {
    id: "audience",
    label: "Define audience",
    hint: "Build personas and pain points.",
  },
  {
    id: "competitors",
    label: "Map competitors",
    hint: "Know who else owns attention.",
  },
  {
    id: "pillars",
    label: "Shape content pillars",
    hint: "Decide what you talk about.",
  },
  {
    id: "preferences",
    label: "Set preferences",
    hint: "Cadence, formats, and tone.",
  },
  {
    id: "ready",
    label: "Ready for planning",
    hint: "Strategy is structured for future AI.",
  },
] as const;

export function toggleInList(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
