export const CALENDAR_CATEGORIES = [
  { key: "international_days", name: "International Days", sortOrder: 1 },
  { key: "national_holidays", name: "National Holidays", sortOrder: 2 },
  { key: "religious_holidays", name: "Religious Holidays", sortOrder: 3 },
  { key: "retail_events", name: "Retail Events", sortOrder: 4 },
  { key: "shopping_seasons", name: "Shopping Seasons", sortOrder: 5 },
  { key: "sales_events", name: "Sales Events", sortOrder: 6 },
  { key: "food_days", name: "Food Days", sortOrder: 7 },
  { key: "drink_days", name: "Drink Days", sortOrder: 8 },
  { key: "coffee_events", name: "Coffee Events", sortOrder: 9 },
  { key: "restaurant_events", name: "Restaurant Events", sortOrder: 10 },
  { key: "technology_conferences", name: "Technology Conferences", sortOrder: 11 },
  { key: "developer_conferences", name: "Developer Conferences", sortOrder: 12 },
  { key: "gaming_events", name: "Gaming Events", sortOrder: 13 },
  { key: "movie_releases", name: "Movie Releases", sortOrder: 14 },
  { key: "music_festivals", name: "Music Festivals", sortOrder: 15 },
  { key: "fashion_weeks", name: "Fashion Weeks", sortOrder: 16 },
  { key: "beauty_events", name: "Beauty Events", sortOrder: 17 },
  { key: "sports_competitions", name: "Sports Competitions", sortOrder: 18 },
  { key: "olympics", name: "Olympics", sortOrder: 19 },
  { key: "world_cup", name: "World Cup", sortOrder: 20 },
  { key: "local_sports", name: "Local Sports Leagues", sortOrder: 21 },
  { key: "school_calendar", name: "School Calendar", sortOrder: 22 },
  { key: "university_calendar", name: "University Calendar", sortOrder: 23 },
  { key: "graduation_season", name: "Graduation Season", sortOrder: 24 },
  { key: "travel_seasons", name: "Travel Seasons", sortOrder: 25 },
  { key: "vacation_periods", name: "Vacation Periods", sortOrder: 26 },
  { key: "weather_seasons", name: "Weather Seasons", sortOrder: 27 },
  { key: "tax_deadlines", name: "Tax Deadlines", sortOrder: 28 },
  { key: "financial_events", name: "Financial Events", sortOrder: 29 },
  { key: "government_events", name: "Government Events", sortOrder: 30 },
  { key: "healthcare_awareness", name: "Healthcare Awareness Days", sortOrder: 31 },
  { key: "environmental_campaigns", name: "Environmental Campaigns", sortOrder: 32 },
  { key: "ngo_campaigns", name: "NGO Campaigns", sortOrder: 33 },
  { key: "industry_specific", name: "Industry Specific Events", sortOrder: 34 },
  { key: "company_custom", name: "Company Custom Events", sortOrder: 35 },
  // legacy aliases kept for older seed mapping
  { key: "food_events", name: "Food Events", sortOrder: 36 },
  { key: "technology_events", name: "Technology Events", sortOrder: 37 },
  { key: "entertainment", name: "Entertainment", sortOrder: 38 },
  { key: "sports", name: "Sports", sortOrder: 39 },
  { key: "financial", name: "Financial", sortOrder: 40 },
  { key: "educational", name: "Educational", sortOrder: 41 },
  { key: "travel", name: "Travel", sortOrder: 42 },
  { key: "health", name: "Health", sortOrder: 43 },
  { key: "beauty", name: "Beauty", sortOrder: 44 },
  { key: "fashion", name: "Fashion", sortOrder: 45 },
  { key: "automotive", name: "Automotive", sortOrder: 46 },
  { key: "pets", name: "Pets", sortOrder: 47 },
  { key: "kids", name: "Kids", sortOrder: 48 },
  { key: "gaming", name: "Gaming", sortOrder: 49 },
  { key: "environment", name: "Environment", sortOrder: 50 },
  { key: "business", name: "Business", sortOrder: 51 },
  { key: "custom_events", name: "Custom Events", sortOrder: 52 },
] as const;

export const CALENDAR_SOURCES = [
  { key: "international_day", name: "International Days" },
  { key: "national_holiday", name: "National Holidays" },
  { key: "religious", name: "Religious Holidays" },
  { key: "retail", name: "Retail Calendars" },
  { key: "food", name: "Food Calendars" },
  { key: "technology", name: "Technology Events" },
  { key: "entertainment", name: "Entertainment" },
  { key: "sports", name: "Sports" },
  { key: "seasonal", name: "Seasonal" },
  { key: "industry", name: "Industry" },
  { key: "local", name: "Local" },
  { key: "financial", name: "Financial" },
  { key: "government", name: "Government" },
  { key: "education", name: "Education" },
  { key: "healthcare", name: "Healthcare" },
  { key: "ngo", name: "NGO" },
  { key: "custom", name: "Custom" },
] as const;

export const SEED_SEASONS = [
  { key: "meteo_spring_n", name: "Meteorological Spring (N)", kind: "METEOROLOGICAL", startMonth: 3, startDay: 1, endMonth: 5, endDay: 31, hemisphere: "northern" },
  { key: "meteo_summer_n", name: "Meteorological Summer (N)", kind: "METEOROLOGICAL", startMonth: 6, startDay: 1, endMonth: 8, endDay: 31, hemisphere: "northern" },
  { key: "meteo_autumn_n", name: "Meteorological Autumn (N)", kind: "METEOROLOGICAL", startMonth: 9, startDay: 1, endMonth: 11, endDay: 30, hemisphere: "northern" },
  { key: "meteo_winter_n", name: "Meteorological Winter (N)", kind: "METEOROLOGICAL", startMonth: 12, startDay: 1, endMonth: 2, endDay: 28, hemisphere: "northern" },
  { key: "astro_spring_n", name: "Astronomical Spring (N)", kind: "ASTRONOMICAL", startMonth: 3, startDay: 20, endMonth: 6, endDay: 20, hemisphere: "northern" },
  { key: "retail_bfcm", name: "Retail BFCM Season", kind: "RETAIL", startMonth: 11, startDay: 1, endMonth: 12, endDay: 1, hemisphere: null },
  { key: "retail_back_to_school", name: "Back to School", kind: "RETAIL", startMonth: 8, startDay: 1, endMonth: 9, endDay: 15, hemisphere: "northern" },
  { key: "business_q4", name: "Business Q4", kind: "BUSINESS", startMonth: 10, startDay: 1, endMonth: 12, endDay: 31, hemisphere: null },
  { key: "tourism_summer_n", name: "Tourism Summer Peak (N)", kind: "TOURISM", startMonth: 6, startDay: 15, endMonth: 8, endDay: 31, hemisphere: "northern" },
  { key: "education_fall", name: "Education Fall Term", kind: "EDUCATION", startMonth: 9, startDay: 1, endMonth: 12, endDay: 20, hemisphere: "northern" },
  { key: "agriculture_harvest", name: "Harvest Season", kind: "AGRICULTURE", startMonth: 9, startDay: 1, endMonth: 11, endDay: 15, hemisphere: "northern" },
] as const;

export const RECURRENCE_TYPES = [
  { key: "ONE_TIME", label: "One Time" },
  { key: "ANNUAL", label: "Annual" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "CUSTOM", label: "Custom Rule" },
] as const;

export const IMPORTANCE_LEVELS = [
  { key: "LOW", label: "Low" },
  { key: "MEDIUM", label: "Medium" },
  { key: "HIGH", label: "High" },
  { key: "CRITICAL", label: "Critical" },
] as const;

export const EVENT_STATUSES = [
  { key: "DRAFT", label: "Draft" },
  { key: "ACTIVE", label: "Active" },
  { key: "ARCHIVED", label: "Archived" },
] as const;

export const VERIFICATION_STATUSES = [
  { key: "OFFICIAL", label: "Official" },
  { key: "VERIFIED", label: "Verified" },
  { key: "COMMUNITY_VERIFIED", label: "Community Verified" },
  { key: "DRAFT", label: "Draft" },
  { key: "ARCHIVED", label: "Archived" },
] as const;

export const TIME_FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "past", label: "Past" },
] as const;

export const IMPORT_FORMATS = [
  { key: "JSON", label: "JSON" },
  { key: "CSV", label: "CSV" },
  { key: "EXCEL", label: "Excel (TSV/CSV)" },
  { key: "ICS", label: "ICS" },
  { key: "REST", label: "REST API" },
] as const;

export const SEED_COUNTRIES = [
  { code: "GLOBAL", name: "Global", regionKey: "global" },
  { code: "US", name: "United States", regionKey: "north_america" },
  { code: "CA", name: "Canada", regionKey: "north_america" },
  { code: "GB", name: "United Kingdom", regionKey: "europe" },
  { code: "DE", name: "Germany", regionKey: "europe" },
  { code: "FR", name: "France", regionKey: "europe" },
  { code: "TR", name: "Turkey", regionKey: "europe" },
  { code: "AE", name: "United Arab Emirates", regionKey: "middle_east" },
  { code: "IR", name: "Iran", regionKey: "middle_east" },
  { code: "IN", name: "India", regionKey: "asia" },
  { code: "JP", name: "Japan", regionKey: "asia" },
  { code: "AU", name: "Australia", regionKey: "oceania" },
  { code: "BR", name: "Brazil", regionKey: "latam" },
] as const;

export const SEED_REGIONS = [
  { key: "global", name: "Global", kind: "GLOBAL" },
  { key: "north_america", name: "North America", kind: "REGION" },
  { key: "europe", name: "Europe", kind: "REGION" },
  { key: "middle_east", name: "Middle East", kind: "REGION" },
  { key: "asia", name: "Asia", kind: "REGION" },
  { key: "oceania", name: "Oceania", kind: "REGION" },
  { key: "latam", name: "Latin America", kind: "REGION" },
] as const;

/** Map legacy opportunity source enum → calendar category key */
export const SOURCE_TO_CATEGORY: Record<string, string> = {
  INTERNATIONAL_DAY: "international_days",
  COUNTRY_HOLIDAY: "national_holidays",
  FOOD_CALENDAR: "food_days",
  RETAIL_CALENDAR: "retail_events",
  SEASONAL: "weather_seasons",
  RELIGIOUS: "religious_holidays",
  SPORTS: "sports_competitions",
  ENTERTAINMENT: "movie_releases",
  TECHNOLOGY: "technology_conferences",
  INDUSTRY_CONFERENCE: "industry_specific",
  LOCAL: "company_custom",
  WEATHER_SEASON: "weather_seasons",
  SCHOOL_CALENDAR: "school_calendar",
  SHOPPING: "shopping_seasons",
  CUSTOM: "company_custom",
};

export type CalendarSearchInput = {
  q?: string;
  category?: string;
  country?: string;
  industry?: string;
  month?: number;
  quarter?: number;
  season?: string;
  seasonKey?: string;
  tags?: string[];
  importance?: string;
  status?: string;
  verificationStatus?: string;
  timeFilter?: (typeof TIME_FILTERS)[number]["key"];
  startDate?: string;
  endDate?: string;
  language?: string;
  limit?: number;
  offset?: number;
};

export function utcToday(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function seasonForMonth(month: number) {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function quarterForMonth(month: number) {
  return Math.ceil(month / 3);
}

export function nextOccurrenceDate(input: {
  recurrence: string;
  month?: number | null;
  day?: number | null;
  startDate?: Date | null;
  from?: Date;
}) {
  const from = utcToday(input.from);
  if (input.recurrence === "ONE_TIME" && input.startDate) {
    return utcToday(input.startDate);
  }
  if (input.month != null && input.day != null) {
    let y = from.getUTCFullYear();
    let candidate = new Date(Date.UTC(y, input.month - 1, input.day));
    if (candidate < from) {
      candidate = new Date(Date.UTC(y + 1, input.month - 1, input.day));
    }
    return candidate;
  }
  if (input.startDate) return utcToday(input.startDate);
  return from;
}

export function slugifyKey(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

export function buildSearchText(parts: Array<string | null | undefined | string[]>) {
  return parts
    .flatMap((p) => (Array.isArray(p) ? p : [p]))
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .slice(0, 4000);
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitCsvLine(lines[0], delim).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line, delim);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] || "").trim();
    });
    return row;
  });
}

function splitCsvLine(line: string, delim: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Minimal ICS VEVENT parser — no external dependency */
export function parseIcs(text: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0] || "";
    const get = (key: string) => {
      const re = new RegExp(`^${key}[^:]*:(.*)$`, "im");
      const m = body.match(re);
      return m?.[1]?.trim().replace(/\\n/g, "\n").replace(/\\,/g, ",");
    };
    const summary = get("SUMMARY");
    if (!summary) continue;
    const dtStart = get("DTSTART") || "";
    const dtEnd = get("DTEND") || "";
    const start = icsDate(dtStart);
    const end = icsDate(dtEnd);
    events.push({
      name: summary,
      description: get("DESCRIPTION") || "",
      startDate: start?.iso || null,
      endDate: end?.iso || null,
      month: start?.month ?? null,
      day: start?.day ?? null,
      recurrence: "ONE_TIME",
      timezone: "UTC",
      categoryKey: "company_custom",
      countries: ["GLOBAL"],
      source: "CUSTOM",
      sourceKey: "custom",
    });
  }
  return events;
}

function icsDate(raw: string) {
  const clean = raw.replace(/[^0-9T]/g, "");
  if (clean.length < 8) return null;
  const y = Number(clean.slice(0, 4));
  const m = Number(clean.slice(4, 6));
  const d = Number(clean.slice(6, 8));
  if (!y || !m || !d) return null;
  return {
    month: m,
    day: d,
    iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  };
}
