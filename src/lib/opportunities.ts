export const EVENT_SOURCES = [
  { key: "INTERNATIONAL_DAY", label: "International Days" },
  { key: "COUNTRY_HOLIDAY", label: "Country Holidays" },
  { key: "FOOD_CALENDAR", label: "Food Calendars" },
  { key: "RETAIL_CALENDAR", label: "Retail Calendars" },
  { key: "SEASONAL", label: "Seasonal Events" },
  { key: "RELIGIOUS", label: "Religious Events" },
  { key: "SPORTS", label: "Sports Events" },
  { key: "ENTERTAINMENT", label: "Entertainment Releases" },
  { key: "TECHNOLOGY", label: "Technology Events" },
  { key: "INDUSTRY_CONFERENCE", label: "Industry Conferences" },
  { key: "LOCAL", label: "Local Events" },
  { key: "WEATHER_SEASON", label: "Weather Seasons" },
  { key: "SCHOOL_CALENDAR", label: "School Calendars" },
  { key: "SHOPPING", label: "Shopping Events" },
] as const;

export const PLANNING_MODES = [
  {
    key: "AUTO",
    label: "Auto Strategy",
    description: "AI picks the optimal mix and schedule.",
  },
  {
    key: "GUIDED",
    label: "Guided Strategy",
    description: "You set limits; AI builds the best plan inside them.",
  },
  {
    key: "MANUAL",
    label: "Manual Strategy",
    description: "You define exact requirements; AI optimizes quality only.",
  },
] as const;

export const ALERT_OFFSETS = [
  { key: "DAYS_30", days: 30, label: "30 days before" },
  { key: "DAYS_14", days: 14, label: "14 days before" },
  { key: "DAYS_7", days: 7, label: "7 days before" },
  { key: "DAYS_3", days: 3, label: "3 days before" },
  { key: "DAYS_1", days: 1, label: "1 day before" },
  { key: "DAY_OF", days: 0, label: "On event day" },
] as const;

export const RECOMMENDATION_KINDS = [
  "campaign",
  "promotion",
  "content_series",
  "reel",
  "carousel",
  "story",
  "email",
  "landing_page",
  "cta",
  "offer",
  "hashtags",
] as const;

export const SCORE_KEYS = [
  { key: "relevance", label: "Relevance" },
  { key: "urgency", label: "Urgency" },
  { key: "expectedReach", label: "Expected Reach" },
  { key: "salesPotential", label: "Sales Potential" },
  { key: "engagementPotential", label: "Engagement Potential" },
  { key: "difficulty", label: "Difficulty" },
  { key: "confidence", label: "Confidence" },
] as const;

export type SeedEvent = {
  key: string;
  name: string;
  description: string;
  source: (typeof EVENT_SOURCES)[number]["key"];
  categoryKey: string;
  month: number;
  day: number;
  countries?: string[];
  industries?: string[];
  tags?: string[];
  audienceHints?: string[];
};

export const OPPORTUNITY_CATEGORIES = [
  { key: "awareness", name: "Brand Awareness", sortOrder: 1 },
  { key: "commerce", name: "Commerce & Offers", sortOrder: 2 },
  { key: "community", name: "Community & Culture", sortOrder: 3 },
  { key: "seasonal", name: "Seasonal Moments", sortOrder: 4 },
  { key: "industry", name: "Industry Moments", sortOrder: 5 },
];

/** Curated high-signal moments — not a full holiday dump. */
export const SEED_EVENTS: SeedEvent[] = [
  {
    key: "new_year",
    name: "New Year",
    description: "Fresh-start campaigns and goal-setting content.",
    source: "SEASONAL",
    categoryKey: "seasonal",
    month: 1,
    day: 1,
    tags: ["goals", "launch"],
    audienceHints: ["general"],
  },
  {
    key: "valentines",
    name: "Valentine's Day",
    description: "Gift, couple, and appreciation marketing window.",
    source: "RETAIL_CALENDAR",
    categoryKey: "commerce",
    month: 2,
    day: 14,
    tags: ["gifts", "romance"],
    industries: ["retail", "food", "beauty", "flowers"],
  },
  {
    key: "womens_day",
    name: "International Women's Day",
    description: "Purpose-led brand and community storytelling.",
    source: "INTERNATIONAL_DAY",
    categoryKey: "community",
    month: 3,
    day: 8,
    tags: ["equity", "stories"],
  },
  {
    key: "spring_equinox",
    name: "Spring Equinox",
    description: "Seasonal refresh and outdoor lifestyle angle.",
    source: "WEATHER_SEASON",
    categoryKey: "seasonal",
    month: 3,
    day: 20,
    tags: ["refresh", "season"],
  },
  {
    key: "earth_day",
    name: "Earth Day",
    description: "Sustainability and responsible brand moments.",
    source: "INTERNATIONAL_DAY",
    categoryKey: "community",
    month: 4,
    day: 22,
    tags: ["sustainability", "esg"],
    industries: ["retail", "tech", "food", "fashion"],
  },
  {
    key: "mothers_day_us",
    name: "Mother's Day (US)",
    description: "Gift and appreciation peak for family audiences.",
    source: "RETAIL_CALENDAR",
    categoryKey: "commerce",
    month: 5,
    day: 11,
    countries: ["US"],
    tags: ["gifts", "family"],
  },
  {
    key: "world_coffee_day",
    name: "International Coffee Day",
    description: "Food & beverage community and product moments.",
    source: "FOOD_CALENDAR",
    categoryKey: "community",
    month: 10,
    day: 1,
    industries: ["food", "cafe", "hospitality"],
    tags: ["beverage"],
  },
  {
    key: "fathers_day_us",
    name: "Father's Day (US)",
    description: "Gift campaigns for dads and mentors.",
    source: "RETAIL_CALENDAR",
    categoryKey: "commerce",
    month: 6,
    day: 15,
    countries: ["US"],
    tags: ["gifts", "family"],
  },
  {
    key: "pride_month_start",
    name: "Pride Month Kickoff",
    description: "Inclusive community and brand values storytelling.",
    source: "INTERNATIONAL_DAY",
    categoryKey: "community",
    month: 6,
    day: 1,
    tags: ["inclusion", "community"],
  },
  {
    key: "summer_solstice",
    name: "Summer Solstice",
    description: "Peak summer lifestyle and outdoor campaigns.",
    source: "WEATHER_SEASON",
    categoryKey: "seasonal",
    month: 6,
    day: 21,
    tags: ["summer", "lifestyle"],
  },
  {
    key: "back_to_school",
    name: "Back to School",
    description: "Education, family, and productivity purchasing window.",
    source: "SCHOOL_CALENDAR",
    categoryKey: "commerce",
    month: 8,
    day: 15,
    tags: ["education", "productivity"],
    industries: ["retail", "education", "tech"],
  },
  {
    key: "labor_day_us",
    name: "Labor Day (US)",
    description: "End-of-summer retail and long-weekend promotions.",
    source: "COUNTRY_HOLIDAY",
    categoryKey: "commerce",
    month: 9,
    day: 1,
    countries: ["US"],
    tags: ["sale", "weekend"],
  },
  {
    key: "world_tourism_day",
    name: "World Tourism Day",
    description: "Travel, hospitality, and experience marketing.",
    source: "INTERNATIONAL_DAY",
    categoryKey: "industry",
    month: 9,
    day: 27,
    industries: ["travel", "hospitality", "tourism"],
    tags: ["travel"],
  },
  {
    key: "halloween",
    name: "Halloween",
    description: "Seasonal creative, F&B, and retail thematic window.",
    source: "SEASONAL",
    categoryKey: "seasonal",
    month: 10,
    day: 31,
    tags: ["theme", "retail", "food"],
  },
  {
    key: "singles_day",
    name: "Singles' Day / 11.11",
    description: "Major shopping event for commerce brands.",
    source: "SHOPPING",
    categoryKey: "commerce",
    month: 11,
    day: 11,
    tags: ["sale", "ecommerce"],
    industries: ["retail", "ecommerce"],
  },
  {
    key: "black_friday",
    name: "Black Friday",
    description: "Peak promotional and offer window.",
    source: "SHOPPING",
    categoryKey: "commerce",
    month: 11,
    day: 28,
    tags: ["sale", "offers"],
    industries: ["retail", "ecommerce", "tech"],
  },
  {
    key: "cyber_monday",
    name: "Cyber Monday",
    description: "Digital-first shopping peak after Black Friday.",
    source: "SHOPPING",
    categoryKey: "commerce",
    month: 12,
    day: 1,
    tags: ["ecommerce", "sale"],
    industries: ["retail", "ecommerce", "tech"],
  },
  {
    key: "giving_tuesday",
    name: "Giving Tuesday",
    description: "Cause and community contribution moment.",
    source: "INTERNATIONAL_DAY",
    categoryKey: "community",
    month: 12,
    day: 2,
    tags: ["cause", "community"],
  },
  {
    key: "christmas",
    name: "Christmas",
    description: "Gift, family, and year-end brand campaigns.",
    source: "RELIGIOUS",
    categoryKey: "seasonal",
    month: 12,
    day: 25,
    tags: ["gifts", "family"],
  },
  {
    key: "boxing_day",
    name: "Boxing Day",
    description: "Post-holiday clearance and retail stretch.",
    source: "RETAIL_CALENDAR",
    categoryKey: "commerce",
    month: 12,
    day: 26,
    countries: ["UK", "CA", "AU"],
    tags: ["sale"],
  },
  {
    key: "wwdc_window",
    name: "WWDC Season",
    description: "Apple ecosystem tech conversation window.",
    source: "TECHNOLOGY",
    categoryKey: "industry",
    month: 6,
    day: 9,
    industries: ["tech", "software", "apps"],
    tags: ["tech", "product"],
  },
  {
    key: "ces_window",
    name: "CES Season",
    description: "Consumer electronics and innovation narrative.",
    source: "TECHNOLOGY",
    categoryKey: "industry",
    month: 1,
    day: 7,
    industries: ["tech", "hardware", "electronics"],
    tags: ["innovation"],
  },
  {
    key: "super_bowl",
    name: "Super Bowl Sunday",
    description: "Mass cultural attention and creative peak.",
    source: "SPORTS",
    categoryKey: "awareness",
    month: 2,
    day: 8,
    countries: ["US"],
    tags: ["attention", "creative"],
  },
  {
    key: "world_mental_health",
    name: "World Mental Health Day",
    description: "Wellness and empathetic brand storytelling.",
    source: "INTERNATIONAL_DAY",
    categoryKey: "community",
    month: 10,
    day: 10,
    tags: ["wellness", "care"],
    industries: ["health", "wellness", "hr"],
  },
  {
    key: "small_business_saturday",
    name: "Small Business Saturday",
    description: "Local commerce and community support moment.",
    source: "SHOPPING",
    categoryKey: "commerce",
    month: 11,
    day: 29,
    countries: ["US"],
    tags: ["local", "smb"],
  },
  {
    key: "ramadan_window",
    name: "Ramadan Season (approx)",
    description: "Cultural and retail moment for relevant markets.",
    source: "RELIGIOUS",
    categoryKey: "community",
    month: 3,
    day: 1,
    tags: ["culture", "community"],
    countries: ["AE", "SA", "TR", "ID", "MY"],
  },
  {
    key: "autumn_equinox",
    name: "Autumn Equinox",
    description: "Fall lifestyle, reset, and seasonal product shift.",
    source: "WEATHER_SEASON",
    categoryKey: "seasonal",
    month: 9,
    day: 22,
    tags: ["fall", "reset"],
  },
  {
    key: "national_pizza_day",
    name: "National Pizza Day",
    description: "Food calendar engagement spike for F&B.",
    source: "FOOD_CALENDAR",
    categoryKey: "community",
    month: 2,
    day: 9,
    industries: ["food", "restaurant"],
    tags: ["food"],
  },
  {
    key: "fashion_week_paris",
    name: "Paris Fashion Week Window",
    description: "Style, beauty, and lifestyle narrative peak.",
    source: "INDUSTRY_CONFERENCE",
    categoryKey: "industry",
    month: 9,
    day: 25,
    industries: ["fashion", "beauty", "lifestyle"],
    tags: ["style"],
  },
  {
    key: "local_founders_day",
    name: "Local Founders / SMB Appreciation",
    description: "Local community and founder story opportunities.",
    source: "LOCAL",
    categoryKey: "community",
    month: 5,
    day: 20,
    tags: ["local", "founder"],
  },
];

export function eventDateForYear(month: number, day: number, year: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function nextOccurrence(month: number, day: number, from = new Date()) {
  const year = from.getUTCFullYear();
  let d = eventDateForYear(month, day, year);
  const today = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  if (d < today) d = eventDateForYear(month, day, year + 1);
  return d;
}

export function daysUntil(date: Date, from = new Date()) {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((b - a) / 86400000);
}
