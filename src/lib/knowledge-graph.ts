export const RELATION_STRENGTHS = [
  { key: "VERY_WEAK", label: "Very Weak" },
  { key: "WEAK", label: "Weak" },
  { key: "MEDIUM", label: "Medium" },
  { key: "STRONG", label: "Strong" },
  { key: "VERY_STRONG", label: "Very Strong" },
] as const;

export const NODE_KINDS = [
  { key: "INDUSTRY", label: "Industry" },
  { key: "BUSINESS_TYPE", label: "Business Type" },
  { key: "PRODUCT_CATEGORY", label: "Product / Service" },
  { key: "AUDIENCE", label: "Audience" },
  { key: "CAMPAIGN_TYPE", label: "Campaign Type" },
  { key: "OBJECTIVE", label: "Objective" },
  { key: "CONTENT_TYPE", label: "Content Type" },
  { key: "CHANNEL", label: "Channel" },
  { key: "CTA", label: "CTA" },
  { key: "EMOTIONAL_TONE", label: "Emotional Tone" },
  { key: "SEASON", label: "Season" },
  { key: "CUSTOM", label: "Custom" },
] as const;

export const RELATION_TYPES = [
  { key: "suits_industry", name: "Suits Industry" },
  { key: "has_business_type", name: "Has Business Type" },
  { key: "references_product", name: "References Product" },
  { key: "targets_audience", name: "Targets Audience" },
  { key: "uses_campaign", name: "Uses Campaign Type" },
  { key: "serves_objective", name: "Serves Objective" },
  { key: "fits_content", name: "Fits Content Type" },
  { key: "distributes_on", name: "Distributes On" },
  { key: "suggests_cta", name: "Suggests CTA" },
  { key: "carries_tone", name: "Carries Tone" },
  { key: "occurs_in_season", name: "Occurs In Season" },
  { key: "related_to", name: "Related To" },
] as const;

export const SEED_INDUSTRIES = [
  "Restaurant",
  "Coffee Shop",
  "Beauty Clinic",
  "Dental Clinic",
  "Real Estate",
  "Automotive",
  "Education",
  "Travel Agency",
  "Fashion",
  "Jewelry",
  "Healthcare",
  "Fitness",
  "Hotel",
  "E-commerce",
  "Software",
  "SaaS",
  "Agency",
  "Construction",
  "Finance",
  "Insurance",
  "Law Firm",
  "Photography",
  "Pets",
  "Gaming",
  "Custom",
] as const;

export const SEED_BUSINESS_TYPES: Array<{
  key: string;
  name: string;
  industry: string;
  parent?: string;
}> = [
  { key: "restaurant", name: "Restaurant", industry: "restaurant" },
  {
    key: "italian_restaurant",
    name: "Italian Restaurant",
    industry: "restaurant",
    parent: "restaurant",
  },
  {
    key: "pizza_restaurant",
    name: "Pizza Restaurant",
    industry: "restaurant",
    parent: "italian_restaurant",
  },
  {
    key: "fast_food",
    name: "Fast Food",
    industry: "restaurant",
    parent: "restaurant",
  },
  { key: "coffee_shop", name: "Coffee Shop", industry: "coffee_shop" },
  { key: "specialty_coffee", name: "Specialty Coffee", industry: "coffee_shop", parent: "coffee_shop" },
  { key: "saas_b2b", name: "B2B SaaS", industry: "saas" },
  { key: "saas_b2c", name: "B2C SaaS", industry: "saas" },
];

export const SEED_PRODUCT_CATEGORIES = [
  { key: "products", name: "Products", kind: "CATEGORY" },
  { key: "services", name: "Services", kind: "CATEGORY" },
  { key: "bundles", name: "Bundles", kind: "BUNDLE" },
  { key: "collections", name: "Collections", kind: "COLLECTION" },
  { key: "menu_items", name: "Menu Items", kind: "CATEGORY", parent: "products" },
  { key: "consulting", name: "Consulting", kind: "CATEGORY", parent: "services" },
] as const;

export const SEED_AUDIENCES = [
  "Families",
  "Students",
  "Children",
  "Women",
  "Men",
  "Professionals",
  "Businesses",
  "Tourists",
  "Luxury Buyers",
  "Budget Buyers",
  "Returning Customers",
  "VIP Customers",
  "Custom",
] as const;

export const SEED_OBJECTIVES = [
  "Awareness",
  "Reach",
  "Traffic",
  "Lead Generation",
  "Sales",
  "Retention",
  "Upsell",
  "Cross Sell",
  "Community Growth",
  "Engagement",
  "Brand Trust",
] as const;

export const SEED_CONTENT_TYPES = [
  "Reel",
  "Carousel",
  "Story",
  "Short Video",
  "Long Video",
  "Blog",
  "Email",
  "Newsletter",
  "Landing Page",
  "Podcast",
  "Live Stream",
  "Behind The Scenes",
  "Poll",
  "Quiz",
  "Case Study",
  "Custom",
] as const;

export const SEED_CAMPAIGN_TYPES = [
  "Promotion",
  "Discount",
  "Coupon",
  "Bundle",
  "Giveaway",
  "Contest",
  "Launch",
  "Seasonal Campaign",
  "Limited Offer",
  "Referral",
  "Membership",
  "Event",
  "Educational Campaign",
  "Custom",
] as const;

export const SEED_CHANNELS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "Pinterest",
  "Email",
  "SMS",
  "WhatsApp",
  "Telegram",
  "Website",
] as const;

export const SEED_CTAS = [
  "Buy Now",
  "Order Now",
  "Book Now",
  "Reserve",
  "Register",
  "Learn More",
  "Download",
  "Subscribe",
  "Contact Us",
  "Request Quote",
  "Visit Store",
] as const;

export const SEED_TONES = [
  "Luxury",
  "Friendly",
  "Funny",
  "Educational",
  "Professional",
  "Urgent",
  "Inspirational",
  "Minimal",
  "Premium",
  "Warm",
  "Family",
  "Celebration",
] as const;

export function slugifyKnowledgeKey(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

export function kindLabel(kind: string) {
  return NODE_KINDS.find((k) => k.key === kind)?.label || kind;
}
