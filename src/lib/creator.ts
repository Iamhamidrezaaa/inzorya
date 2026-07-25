export const CREATOR_PLATFORMS = [
  { key: "INSTAGRAM", label: "Instagram" },
  { key: "FACEBOOK", label: "Facebook" },
  { key: "LINKEDIN", label: "LinkedIn" },
  { key: "X", label: "X" },
  { key: "THREADS", label: "Threads" },
  { key: "TIKTOK", label: "TikTok" },
  { key: "YOUTUBE", label: "YouTube" },
  { key: "EMAIL", label: "Email" },
  { key: "BLOG", label: "Blog" },
  { key: "LANDING", label: "Landing Page" },
] as const;

export const CREATOR_OBJECTIVES = [
  { key: "BRAND_AWARENESS", label: "Brand Awareness" },
  { key: "LEAD_GENERATION", label: "Lead Generation" },
  { key: "ENGAGEMENT", label: "Engagement" },
  { key: "SALES", label: "Sales" },
  { key: "EDUCATION", label: "Education" },
  { key: "COMMUNITY", label: "Community" },
  { key: "RETENTION", label: "Retention" },
  { key: "TRAFFIC", label: "Traffic" },
  { key: "LAUNCH", label: "Launch" },
  { key: "SUPPORT", label: "Support" },
] as const;

export const CREATOR_CONTENT_TYPES = [
  { key: "INSTAGRAM_CAPTION", label: "Instagram Caption", platforms: ["INSTAGRAM"] },
  { key: "CAROUSEL", label: "Carousel", platforms: ["INSTAGRAM", "LINKEDIN"] },
  { key: "STORY", label: "Story", platforms: ["INSTAGRAM", "FACEBOOK"] },
  { key: "REEL_SCRIPT", label: "Reel Script", platforms: ["INSTAGRAM", "TIKTOK"] },
  { key: "VIDEO_HOOK", label: "Video Hook", platforms: ["INSTAGRAM", "TIKTOK", "YOUTUBE"] },
  { key: "VIDEO_DESCRIPTION", label: "Video Description", platforms: ["YOUTUBE", "TIKTOK"] },
  { key: "THREADS", label: "Threads", platforms: ["THREADS"] },
  { key: "LINKEDIN_POST", label: "LinkedIn Post", platforms: ["LINKEDIN"] },
  { key: "FACEBOOK_POST", label: "Facebook Post", platforms: ["FACEBOOK"] },
  { key: "X_POST", label: "X Post", platforms: ["X"] },
  { key: "NEWSLETTER", label: "Newsletter", platforms: ["EMAIL"] },
  { key: "BLOG_ARTICLE", label: "Blog Article", platforms: ["BLOG"] },
  { key: "LANDING_PAGE_COPY", label: "Landing Page Copy", platforms: ["LANDING"] },
  { key: "EMAIL_CAMPAIGN", label: "Email Campaign", platforms: ["EMAIL"] },
  { key: "PRODUCT_DESCRIPTION", label: "Product Description", platforms: ["LANDING", "BLOG"] },
  { key: "CTA", label: "CTA", platforms: ["INSTAGRAM", "LINKEDIN", "FACEBOOK", "LANDING"] },
  { key: "HEADLINE", label: "Headline", platforms: ["LINKEDIN", "BLOG", "LANDING", "FACEBOOK"] },
  { key: "HASHTAGS", label: "Hashtags", platforms: ["INSTAGRAM", "TIKTOK", "X"] },
] as const;

export type CreatorContentTypeKey = (typeof CREATOR_CONTENT_TYPES)[number]["key"];
export type CreatorObjectiveKey = (typeof CREATOR_OBJECTIVES)[number]["key"];

export const VARIATION_COUNTS = [3, 5, 10] as const;

export const REWRITE_STYLES = [
  { key: "shorter", label: "Shorter" },
  { key: "longer", label: "Longer" },
  { key: "friendlier", label: "Friendlier" },
  { key: "professional", label: "More Professional" },
  { key: "luxury", label: "Luxury Tone" },
  { key: "funny", label: "Funny" },
  { key: "emotional", label: "Emotional" },
  { key: "educational", label: "Educational" },
  { key: "storytelling", label: "Storytelling" },
  { key: "sales", label: "Sales Focused" },
] as const;

export const SCORE_DIMENSIONS = [
  { key: "brandConsistency", label: "Brand Consistency" },
  { key: "readability", label: "Readability" },
  { key: "ctaStrength", label: "CTA Strength" },
  { key: "emotionalImpact", label: "Emotional Impact" },
  { key: "engagementPotential", label: "Engagement Potential" },
  { key: "seoQuality", label: "SEO Quality" },
  { key: "platformCompatibility", label: "Platform Compatibility" },
] as const;

export function contentTypesForPlatform(platform: string) {
  return CREATOR_CONTENT_TYPES.filter((t) =>
    (t.platforms as readonly string[]).includes(platform),
  );
}

export function estimateReadTime(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min`;
}
