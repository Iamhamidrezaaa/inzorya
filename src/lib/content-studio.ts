import type {
  ContentFormat,
  ContentPlatform,
  ContentPriority,
  ContentStatus,
} from "@prisma/client";

export const PIPELINE_COLUMNS: {
  status: ContentStatus;
  label: string;
}[] = [
  { status: "IDEAS", label: "Ideas" },
  { status: "RESEARCH", label: "Research" },
  { status: "BRIEF", label: "Brief" },
  { status: "DRAFT", label: "Draft" },
  { status: "REVIEW", label: "Review" },
  { status: "APPROVED", label: "Approved" },
  { status: "SCHEDULED", label: "Scheduled" },
  { status: "PUBLISHED", label: "Published" },
];

export const CONTENT_FORMATS: {
  value: ContentFormat;
  label: string;
  platform: ContentPlatform;
}[] = [
  { value: "INSTAGRAM_REEL", label: "Instagram Reel", platform: "INSTAGRAM" },
  {
    value: "INSTAGRAM_CAROUSEL",
    label: "Instagram Carousel",
    platform: "INSTAGRAM",
  },
  { value: "INSTAGRAM_STORY", label: "Instagram Story", platform: "INSTAGRAM" },
  { value: "INSTAGRAM_POST", label: "Instagram Post", platform: "INSTAGRAM" },
  { value: "FACEBOOK", label: "Facebook", platform: "FACEBOOK" },
  { value: "LINKEDIN", label: "LinkedIn", platform: "LINKEDIN" },
  { value: "X", label: "X", platform: "X" },
  { value: "TIKTOK", label: "TikTok", platform: "TIKTOK" },
  { value: "YOUTUBE", label: "YouTube", platform: "YOUTUBE" },
  { value: "SHORT", label: "Short", platform: "YOUTUBE" },
  { value: "NEWSLETTER", label: "Newsletter", platform: "NEWSLETTER" },
  { value: "BLOG", label: "Blog", platform: "BLOG" },
];

export const CONTENT_PRIORITIES: {
  value: ContentPriority;
  label: string;
}[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export const DEFAULT_CHECKLIST = [
  "Research",
  "Approve Script",
  "Create Visual",
  "Review",
  "Publish",
];

export const DEFAULT_TEMPLATES = [
  {
    name: "Launch",
    category: "Launch",
    format: "INSTAGRAM_REEL" as ContentFormat,
    platform: "INSTAGRAM" as ContentPlatform,
    titleHint: "Product launch",
    briefHook: "Something new is here.",
    checklist: DEFAULT_CHECKLIST,
  },
  {
    name: "Promotion",
    category: "Promotion",
    format: "INSTAGRAM_POST" as ContentFormat,
    platform: "INSTAGRAM" as ContentPlatform,
    titleHint: "Limited offer",
    briefHook: "A clear reason to act now.",
    checklist: DEFAULT_CHECKLIST,
  },
  {
    name: "Educational",
    category: "Educational",
    format: "INSTAGRAM_CAROUSEL" as ContentFormat,
    platform: "INSTAGRAM" as ContentPlatform,
    titleHint: "Teach one idea",
    briefHook: "Start with a surprising fact.",
    checklist: ["Research", "Outline", "Design", "Review", "Publish"],
  },
  {
    name: "Behind The Scenes",
    category: "Behind The Scenes",
    format: "INSTAGRAM_STORY" as ContentFormat,
    platform: "INSTAGRAM" as ContentPlatform,
    titleHint: "Day in the life",
    checklist: ["Capture", "Select clips", "Review", "Publish"],
  },
  {
    name: "FAQ",
    category: "FAQ",
    format: "INSTAGRAM_CAROUSEL" as ContentFormat,
    platform: "INSTAGRAM" as ContentPlatform,
    titleHint: "Answer a common question",
    checklist: DEFAULT_CHECKLIST,
  },
  {
    name: "Testimonials",
    category: "Testimonials",
    format: "INSTAGRAM_POST" as ContentFormat,
    platform: "INSTAGRAM" as ContentPlatform,
    titleHint: "Customer story",
    checklist: ["Collect quote", "Design", "Review", "Publish"],
  },
];

export function formatLabel(format: ContentFormat) {
  return CONTENT_FORMATS.find((f) => f.value === format)?.label ?? format;
}

export function statusLabel(status: ContentStatus) {
  return PIPELINE_COLUMNS.find((c) => c.status === status)?.label ?? status;
}
