export const PLAN_TYPES = [
  { key: "WEEKLY", label: "Weekly Plan", days: 7 },
  { key: "MONTHLY", label: "Monthly Plan", days: 30 },
  { key: "QUARTERLY", label: "Quarterly Plan", days: 90 },
  { key: "CAMPAIGN", label: "Campaign Plan", days: 21 },
  { key: "LAUNCH", label: "Launch Plan", days: 14 },
  { key: "HOLIDAY", label: "Holiday Plan", days: 10 },
  { key: "SEASONAL", label: "Seasonal Plan", days: 45 },
  { key: "PRODUCT_PROMOTION", label: "Product Promotion Plan", days: 14 },
] as const;

export type PlanTypeKey = (typeof PLAN_TYPES)[number]["key"];

export const MIX_CATEGORIES = [
  { key: "EDUCATIONAL", label: "Educational" },
  { key: "PROMOTIONAL", label: "Promotional" },
  { key: "COMMUNITY", label: "Community" },
  { key: "ENTERTAINMENT", label: "Entertainment" },
  { key: "SOCIAL_PROOF", label: "Social Proof" },
  { key: "BEHIND_THE_SCENES", label: "Behind The Scenes" },
  { key: "NEWS", label: "News" },
  { key: "OFFERS", label: "Offers" },
  { key: "UGC", label: "User Generated Content" },
] as const;

export type MixCategoryKey = (typeof MIX_CATEGORIES)[number]["key"];

export const PLANNER_PLATFORMS = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "X",
  "TIKTOK",
  "YOUTUBE",
  "BLOG",
  "NEWSLETTER",
] as const;

export const PLANNER_FORMATS = [
  "INSTAGRAM_REEL",
  "INSTAGRAM_CAROUSEL",
  "INSTAGRAM_STORY",
  "INSTAGRAM_POST",
  "LINKEDIN",
  "TIKTOK",
  "SHORT",
  "BLOG",
  "NEWSLETTER",
] as const;

export type PlanSettings = {
  platforms: string[];
  publishingFrequency: "light" | "steady" | "aggressive";
  contentMix: MixCategoryKey[];
  campaignPriority: "low" | "medium" | "high";
  businessGoal: string;
  targetAudience: string;
  preferredFormats: string[];
  tone: string;
  language: string;
};

export const DEFAULT_PLAN_SETTINGS: PlanSettings = {
  platforms: ["INSTAGRAM", "LINKEDIN"],
  publishingFrequency: "steady",
  contentMix: [
    "EDUCATIONAL",
    "PROMOTIONAL",
    "COMMUNITY",
    "SOCIAL_PROOF",
    "BEHIND_THE_SCENES",
  ],
  campaignPriority: "medium",
  businessGoal: "",
  targetAudience: "",
  preferredFormats: ["INSTAGRAM_POST", "INSTAGRAM_REEL", "INSTAGRAM_CAROUSEL"],
  tone: "professional",
  language: "en",
};

export const DEFAULT_PLANNING_TEMPLATES = [
  {
    key: "weekly_balanced",
    name: "Balanced Weekly",
    description: "Steady mix across pillars and platforms.",
    planType: "WEEKLY" as const,
    defaultSettings: DEFAULT_PLAN_SETTINGS,
    sortOrder: 1,
  },
  {
    key: "campaign_push",
    name: "Campaign Push",
    description: "Campaign-weighted plan with stronger promo mix.",
    planType: "CAMPAIGN" as const,
    defaultSettings: {
      ...DEFAULT_PLAN_SETTINGS,
      publishingFrequency: "aggressive" as const,
      campaignPriority: "high" as const,
      contentMix: [
        "PROMOTIONAL",
        "EDUCATIONAL",
        "SOCIAL_PROOF",
        "OFFERS",
        "COMMUNITY",
      ] as MixCategoryKey[],
    },
    sortOrder: 2,
  },
  {
    key: "launch_sprint",
    name: "Launch Sprint",
    description: "Two-week launch cadence with awareness then conversion.",
    planType: "LAUNCH" as const,
    defaultSettings: {
      ...DEFAULT_PLAN_SETTINGS,
      publishingFrequency: "aggressive" as const,
      contentMix: [
        "NEWS",
        "EDUCATIONAL",
        "PROMOTIONAL",
        "SOCIAL_PROOF",
        "BEHIND_THE_SCENES",
      ] as MixCategoryKey[],
    },
    sortOrder: 3,
  },
];

export function postsPerWeek(frequency: PlanSettings["publishingFrequency"]) {
  if (frequency === "light") return 3;
  if (frequency === "aggressive") return 7;
  return 5;
}

export function planSpanDays(type: PlanTypeKey) {
  return PLAN_TYPES.find((t) => t.key === type)?.days ?? 7;
}
