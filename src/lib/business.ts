import type { ChannelPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SOCIAL_CHANNEL_CATALOG: {
  platform: ChannelPlatform;
  name: string;
  description: string;
  permissions: { scope: string; label: string }[];
  mockAccountName: string;
  mockHandle: string;
}[] = [
  {
    platform: "INSTAGRAM",
    name: "Instagram",
    description: "DMs, comments, and profile messaging.",
    permissions: [
      { scope: "instagram_basic", label: "Basic profile" },
      { scope: "instagram_manage_messages", label: "Manage messages" },
      { scope: "instagram_manage_comments", label: "Manage comments" },
    ],
    mockAccountName: "Demo Brand",
    mockHandle: "@demo.brand",
  },
  {
    platform: "FACEBOOK",
    name: "Facebook",
    description: "Page inbox and Messenger.",
    permissions: [
      { scope: "pages_show_list", label: "Pages list" },
      { scope: "pages_messaging", label: "Page messaging" },
    ],
    mockAccountName: "Demo Page",
    mockHandle: "demo.page",
  },
  {
    platform: "WHATSAPP",
    name: "WhatsApp Business",
    description: "WhatsApp Business conversations.",
    permissions: [
      { scope: "whatsapp_business_management", label: "Business management" },
      { scope: "whatsapp_business_messaging", label: "Messaging" },
    ],
    mockAccountName: "Demo WhatsApp",
    mockHandle: "+10000000000",
  },
  {
    platform: "TELEGRAM",
    name: "Telegram",
    description: "Telegram bot and chats.",
    permissions: [{ scope: "telegram_bot", label: "Bot access" }],
    mockAccountName: "Demo Bot",
    mockHandle: "@demo_bot",
  },
  {
    platform: "LINKEDIN",
    name: "LinkedIn",
    description: "LinkedIn messaging and page inbox.",
    permissions: [
      { scope: "r_organization_social", label: "Organization social" },
      { scope: "w_member_social", label: "Member social" },
    ],
    mockAccountName: "Demo Company",
    mockHandle: "demo-company",
  },
  {
    platform: "X",
    name: "X (Twitter)",
    description: "Direct messages on X.",
    permissions: [
      { scope: "dm.read", label: "Read DMs" },
      { scope: "dm.write", label: "Write DMs" },
    ],
    mockAccountName: "Demo X",
    mockHandle: "@demo_x",
  },
  {
    platform: "YOUTUBE",
    name: "YouTube",
    description: "Comments and community replies.",
    permissions: [
      { scope: "youtube.force-ssl", label: "YouTube manage" },
      { scope: "youtube.readonly", label: "YouTube read" },
    ],
    mockAccountName: "Demo Channel",
    mockHandle: "@demochannel",
  },
  {
    platform: "TIKTOK",
    name: "TikTok",
    description: "Comments and inbox for TikTok.",
    permissions: [
      { scope: "video.list", label: "Video list" },
      { scope: "comment.list", label: "Comment list" },
    ],
    mockAccountName: "Demo TikTok",
    mockHandle: "@demotiktok",
  },
];

export async function ensureSocialChannelCatalog() {
  for (const item of SOCIAL_CHANNEL_CATALOG) {
    await prisma.socialChannel.upsert({
      where: { platform: item.platform },
      create: {
        platform: item.platform,
        name: item.name,
        description: item.description,
      },
      update: {
        name: item.name,
        description: item.description,
      },
    });
  }
}

export const BUSINESS_ONBOARDING_STEPS = [
  {
    id: "identity",
    title: "Business identity",
    description: "Who you are and where you operate.",
    fields: ["name", "businessSummary", "industry", "website", "country", "languages"] as const,
  },
  {
    id: "market",
    title: "Market & offer",
    description: "What you sell and who you serve.",
    fields: ["businessGoals", "mainProducts", "targetAudience", "competitors"] as const,
  },
  {
    id: "voice",
    title: "Brand voice",
    description: "How Inzorya should sound when it helps you later.",
    fields: ["brandPersonality", "preferredTone", "contentStyle", "mainCta"] as const,
  },
  {
    id: "ops",
    title: "Marketing ops",
    description: "Cadence, platforms, and constraints.",
    fields: [
      "postingFrequency",
      "preferredPlatforms",
      "marketingChallenges",
      "monthlyBudget",
      "teamSize",
    ] as const,
  },
] as const;

export function computeBusinessCompletion(profile: {
  businessSummary: string | null;
  industry: string | null;
  website: string | null;
  country: string | null;
  languages: string[];
  businessGoals: string | null;
  mainProducts: string | null;
  targetAudience: string | null;
  competitors: string | null;
  brandPersonality: string | null;
  preferredTone: string | null;
  contentStyle: string | null;
  mainCta: string | null;
  postingFrequency: string | null;
  preferredPlatforms: string[];
  marketingChallenges: string | null;
  monthlyBudget: string | null;
  teamSize: string | null;
  onboardingCompletedAt: Date | null;
} | null): number {
  if (!profile) return 0;
  if (profile.onboardingCompletedAt) return 100;

  const checks = [
    profile.businessSummary,
    profile.industry,
    profile.website,
    profile.country,
    profile.languages.length > 0,
    profile.businessGoals,
    profile.mainProducts,
    profile.targetAudience,
    profile.competitors,
    profile.brandPersonality,
    profile.preferredTone,
    profile.contentStyle,
    profile.mainCta,
    profile.postingFrequency,
    profile.preferredPlatforms.length > 0,
    profile.marketingChallenges,
    profile.monthlyBudget,
    profile.teamSize,
  ];

  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}
