import { addDays, format, subDays } from "date-fns";

export type TimeRangeKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "12m"
  | "custom";

export type DailyValues = {
  followers: number;
  reach: number;
  impressions: number;
  profileVisits: number;
  websiteClicks: number;
  messages: number;
  comments: number;
  shares: number;
  saves: number;
  likes: number;
  conversions: number;
  revenue: number;
  engagement: number;
  contentProduced: number;
};

export type AnalyticsBundle = {
  range: { start: string; end: string; label: string; compareStart: string; compareEnd: string };
  kpis: {
    key: string;
    label: string;
    current: number;
    previous: number;
    changePct: number;
    sparkline: number[];
    unit: string;
  }[];
  series: { date: string; values: DailyValues }[];
  engagement: {
    daily: { date: string; engagement: number; reach: number; rate: number }[];
    weekly: { label: string; engagement: number }[];
    monthly: { label: string; engagement: number }[];
  };
  audience: {
    followersGrowth: { date: string; followers: number }[];
    locations: { name: string; value: number }[];
    ages: { name: string; value: number }[];
    genders: { name: string; value: number }[];
    languages: { name: string; value: number }[];
    activeHours: number[][];
    devices: { name: string; value: number }[];
  };
  content: {
    posts: {
      id: string;
      title: string;
      platform: string;
      contentType: string;
      author: string;
      status: string;
      publishedAt: string;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      ctr: number;
      engagement: number;
    }[];
    averages: { engagement: number; reach: number; saves: number };
    top: { posts: string[]; reels: string[]; stories: string[]; carousels: string[] };
    worst: string[];
  };
  campaigns: {
    id: string;
    name: string;
    status: string;
    reach: number;
    engagement: number;
    clicks: number;
    conversions: number;
    roi: number;
    spend: number;
    revenue: number;
  }[];
  channels: {
    platform: string;
    followers: number;
    reach: number;
    impressions: number;
    engagement: number;
    messages: number;
    profileVisits: number;
    series: { date: string; reach: number; engagement: number }[];
  }[];
  funnel: { stage: string; value: number }[];
  heatmap: { day: string; hours: number[] }[];
  growth: {
    followers: { date: string; value: number }[];
    reach: { date: string; value: number }[];
    engagement: { date: string; value: number }[];
    content: { date: string; value: number }[];
  };
  insights: {
    kind: string;
    severity: string;
    title: string;
    body: string;
    metricKey?: string;
    changePct?: number;
    ruleKey: string;
  }[];
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function resolveRange(
  key: TimeRangeKey,
  customStart?: string,
  customEnd?: string,
): { start: Date; end: Date; label: string; days: number } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (key === "custom" && customStart && customEnd) {
    const start = new Date(customStart);
    const endCustom = new Date(customEnd);
    const days =
      Math.max(
        1,
        Math.round((endCustom.getTime() - start.getTime()) / 86400000),
      ) + 1;
    return {
      start,
      end: endCustom,
      label: "Custom range",
      days,
    };
  }
  const map: Record<Exclude<TimeRangeKey, "custom">, { days: number; label: string }> = {
    today: { days: 1, label: "Today" },
    yesterday: { days: 1, label: "Yesterday" },
    "7d": { days: 7, label: "Last 7 days" },
    "30d": { days: 30, label: "Last 30 days" },
    "90d": { days: 90, label: "Last 90 days" },
    "12m": { days: 365, label: "Last 12 months" },
  };
  const conf = map[key === "custom" ? "30d" : key];
  let start = subDays(end, conf.days - 1);
  let rangeEnd = end;
  if (key === "yesterday") {
    rangeEnd = subDays(end, 1);
    start = rangeEnd;
  }
  if (key === "today") start = end;
  return { start, end: rangeEnd, label: conf.label, days: conf.days };
}

const KPI_DEFS = [
  { key: "followers", label: "Followers", unit: "count", base: 12400 },
  { key: "reach", label: "Reach", unit: "count", base: 82000 },
  { key: "impressions", label: "Impressions", unit: "count", base: 145000 },
  { key: "profileVisits", label: "Profile visits", unit: "count", base: 6400 },
  { key: "websiteClicks", label: "Website clicks", unit: "count", base: 2100 },
  { key: "messages", label: "Messages", unit: "count", base: 890 },
  { key: "comments", label: "Comments", unit: "count", base: 3200 },
  { key: "shares", label: "Shares", unit: "count", base: 1100 },
  { key: "saves", label: "Saves", unit: "count", base: 2400 },
  { key: "likes", label: "Likes", unit: "count", base: 28600 },
  { key: "conversions", label: "Conversions", unit: "count", base: 180 },
  { key: "revenue", label: "Revenue", unit: "currency", base: 18400 },
] as const;

export function generateMockAnalytics(input: {
  brandId: string;
  rangeKey: TimeRangeKey;
  customStart?: string;
  customEnd?: string;
}): AnalyticsBundle {
  const range = resolveRange(input.rangeKey, input.customStart, input.customEnd);
  const rand = mulberry32(hashSeed(`${input.brandId}:${range.label}:${range.days}`));
  const series: AnalyticsBundle["series"] = [];
  let followers = 11000 + Math.floor(rand() * 2000);

  for (let i = 0; i < range.days; i++) {
    const date = addDays(range.start, i);
    const wave = 0.85 + Math.sin(i / 3) * 0.15 + rand() * 0.1;
    const reach = Math.round(2200 * wave + rand() * 800);
    const likes = Math.round(reach * (0.12 + rand() * 0.08));
    const comments = Math.round(likes * (0.08 + rand() * 0.05));
    const shares = Math.round(likes * (0.03 + rand() * 0.03));
    const saves = Math.round(likes * (0.06 + rand() * 0.04));
    const engagement = likes + comments + shares + saves;
    followers += Math.floor(rand() * 40) - 5;
    series.push({
      date: format(date, "yyyy-MM-dd"),
      values: {
        followers,
        reach,
        impressions: Math.round(reach * (1.4 + rand() * 0.4)),
        profileVisits: Math.round(reach * 0.08),
        websiteClicks: Math.round(reach * 0.025),
        messages: Math.round(8 + rand() * 30),
        comments,
        shares,
        saves,
        likes,
        conversions: Math.round(2 + rand() * 10),
        revenue: Math.round(80 + rand() * 400),
        engagement,
        contentProduced: rand() > 0.55 ? 1 : 0,
      },
    });
  }

  const sum = (key: keyof DailyValues) =>
    series.reduce((acc, d) => acc + d.values[key], 0);
  const avg = (key: keyof DailyValues) =>
    series.length ? sum(key) / series.length : 0;

  const compareDays = range.days;
  const compareSeries = series.map((d, i) => {
    const factor = 0.82 + rand() * 0.12;
    return {
      ...d,
      values: Object.fromEntries(
        Object.entries(d.values).map(([k, v]) => [
          k,
          Math.round(Number(v) * factor * (1 + ((i % 5) - 2) * 0.01)),
        ]),
      ) as DailyValues,
    };
  });
  const prevSum = (key: keyof DailyValues) =>
    compareSeries.reduce((acc, d) => acc + d.values[key], 0);

  const kpis = KPI_DEFS.map((def, idx) => {
    const current =
      def.key === "followers"
        ? series[series.length - 1]?.values.followers || def.base
        : def.key === "revenue" || def.key === "conversions"
          ? sum(def.key)
          : sum(def.key);
    const previous =
      def.key === "followers"
        ? Math.round(current * (0.9 + rand() * 0.08))
        : prevSum(def.key as keyof DailyValues);
    const changePct =
      previous === 0 ? 0 : ((current - previous) / previous) * 100;
    const sparkline = series
      .slice(-14)
      .map((d) => d.values[def.key as keyof DailyValues] || 0);
    return {
      key: def.key,
      label: def.label,
      current: Math.round(current),
      previous: Math.round(previous),
      changePct: Math.round(changePct * 10) / 10,
      sparkline:
        sparkline.length > 0
          ? sparkline
          : Array.from({ length: 14 }, () => def.base * (0.8 + rand() * 0.4)),
      unit: def.unit,
      sortOrder: idx,
    };
  });

  const platforms = ["INSTAGRAM", "FACEBOOK", "MESSENGER"] as const;
  const types = ["post", "reel", "story", "carousel"] as const;
  const posts = Array.from({ length: 24 }, (_, i) => {
    const platform = platforms[i % platforms.length]!;
    const contentType = types[i % types.length]!;
    const reach = Math.round(3000 + rand() * 40000);
    const likes = Math.round(reach * (0.05 + rand() * 0.15));
    const comments = Math.round(likes * 0.1);
    const shares = Math.round(likes * 0.04);
    const saves = Math.round(likes * 0.08);
    return {
      id: `post_${i + 1}`,
      title: `${contentType[0]!.toUpperCase()}${contentType.slice(1)} idea ${i + 1}`,
      platform,
      contentType,
      author: i % 3 === 0 ? "Sarah" : i % 3 === 1 ? "Alex" : "Studio",
      status: i % 11 === 0 ? "draft" : "published",
      publishedAt: format(subDays(range.end, i), "yyyy-MM-dd"),
      reach,
      likes,
      comments,
      shares,
      saves,
      ctr: Math.round((1 + rand() * 6) * 10) / 10,
      engagement: likes + comments + shares + saves,
    };
  }).sort((a, b) => b.engagement - a.engagement);

  const byType = (t: string) =>
    posts.filter((p) => p.contentType === t).slice(0, 3).map((p) => p.title);

  const insights = buildDeterministicInsights(kpis, posts);

  const weekly = ["W1", "W2", "W3", "W4"].map((label, i) => ({
    label,
    engagement: Math.round(
      series
        .slice(i * 7, i * 7 + 7)
        .reduce((a, d) => a + d.values.engagement, 0) || 1000 + rand() * 5000,
    ),
  }));

  const monthly = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((label) => ({
    label,
    engagement: Math.round(12000 + rand() * 18000),
  }));

  const heatmapDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmap = heatmapDays.map((day) => ({
    day,
    hours: Array.from({ length: 24 }, (_, h) =>
      Math.round(
        (h >= 9 && h <= 21 ? 40 : 10) +
          rand() * 60 +
          (day === "Tue" || day === "Thu" ? 25 : 0),
      ),
    ),
  }));

  return {
    range: {
      start: format(range.start, "yyyy-MM-dd"),
      end: format(range.end, "yyyy-MM-dd"),
      label: range.label,
      compareStart: format(subDays(range.start, compareDays), "yyyy-MM-dd"),
      compareEnd: format(subDays(range.start, 1), "yyyy-MM-dd"),
    },
    kpis: kpis.map(({ sortOrder: _s, ...rest }) => rest),
    series,
    engagement: {
      daily: series.map((d) => ({
        date: d.date,
        engagement: d.values.engagement,
        reach: d.values.reach,
        rate:
          d.values.reach === 0
            ? 0
            : Math.round((d.values.engagement / d.values.reach) * 1000) / 10,
      })),
      weekly,
      monthly,
    },
    audience: {
      followersGrowth: series.map((d) => ({
        date: d.date,
        followers: d.values.followers,
      })),
      locations: [
        { name: "Iran", value: 38 },
        { name: "UAE", value: 16 },
        { name: "USA", value: 14 },
        { name: "UK", value: 9 },
        { name: "Germany", value: 7 },
        { name: "Other", value: 16 },
      ],
      ages: [
        { name: "18-24", value: 22 },
        { name: "25-34", value: 41 },
        { name: "35-44", value: 21 },
        { name: "45-54", value: 10 },
        { name: "55+", value: 6 },
      ],
      genders: [
        { name: "Female", value: 54 },
        { name: "Male", value: 43 },
        { name: "Other", value: 3 },
      ],
      languages: [
        { name: "Persian", value: 48 },
        { name: "English", value: 32 },
        { name: "Arabic", value: 12 },
        { name: "Other", value: 8 },
      ],
      activeHours: heatmap.map((d) => d.hours),
      devices: [
        { name: "Mobile", value: 78 },
        { name: "Desktop", value: 17 },
        { name: "Tablet", value: 5 },
      ],
    },
    content: {
      posts,
      averages: {
        engagement: Math.round(avg("engagement")),
        reach: Math.round(avg("reach")),
        saves: Math.round(avg("saves")),
      },
      top: {
        posts: byType("post"),
        reels: byType("reel"),
        stories: byType("story"),
        carousels: byType("carousel"),
      },
      worst: [...posts].sort((a, b) => a.engagement - b.engagement).slice(0, 3).map((p) => p.title),
    },
    campaigns: [
      {
        id: "cmp_spring",
        name: "Spring Launch",
        status: "active",
        reach: Math.round(sum("reach") * 0.35),
        engagement: Math.round(sum("engagement") * 0.3),
        clicks: Math.round(sum("websiteClicks") * 0.4),
        conversions: Math.round(sum("conversions") * 0.45),
        spend: 4200,
        revenue: Math.round(sum("revenue") * 0.4),
        roi: 2.4,
      },
      {
        id: "cmp_ugc",
        name: "UGC Amplify",
        status: "active",
        reach: Math.round(sum("reach") * 0.25),
        engagement: Math.round(sum("engagement") * 0.35),
        clicks: Math.round(sum("websiteClicks") * 0.2),
        conversions: Math.round(sum("conversions") * 0.2),
        spend: 1800,
        revenue: Math.round(sum("revenue") * 0.22),
        roi: 1.9,
      },
      {
        id: "cmp_retarget",
        name: "Retarget Warm",
        status: "paused",
        reach: Math.round(sum("reach") * 0.15),
        engagement: Math.round(sum("engagement") * 0.12),
        clicks: Math.round(sum("websiteClicks") * 0.25),
        conversions: Math.round(sum("conversions") * 0.25),
        spend: 2600,
        revenue: Math.round(sum("revenue") * 0.28),
        roi: 3.1,
      },
    ],
    channels: platforms.map((platform, i) => ({
      platform,
      followers: Math.round(8000 + rand() * 6000 - i * 800),
      reach: Math.round(sum("reach") * (0.5 - i * 0.12)),
      impressions: Math.round(sum("impressions") * (0.5 - i * 0.1)),
      engagement: Math.round(sum("engagement") * (0.48 - i * 0.1)),
      messages: Math.round(sum("messages") * (0.55 - i * 0.15)),
      profileVisits: Math.round(sum("profileVisits") * (0.5 - i * 0.1)),
      series: series.slice(-14).map((d) => ({
        date: d.date,
        reach: Math.round(d.values.reach * (0.5 - i * 0.1)),
        engagement: Math.round(d.values.engagement * (0.5 - i * 0.1)),
      })),
    })),
    funnel: [
      { stage: "Profile visit", value: Math.round(sum("profileVisits")) },
      { stage: "Website click", value: Math.round(sum("websiteClicks")) },
      { stage: "Lead", value: Math.round(sum("conversions") * 2.2) },
      { stage: "Customer", value: Math.round(sum("conversions")) },
    ],
    heatmap,
    growth: {
      followers: series.map((d) => ({ date: d.date, value: d.values.followers })),
      reach: series.map((d) => ({ date: d.date, value: d.values.reach })),
      engagement: series.map((d) => ({
        date: d.date,
        value: d.values.engagement,
      })),
      content: series.map((d) => ({
        date: d.date,
        value: d.values.contentProduced,
      })),
    },
    insights,
  };
}

function buildDeterministicInsights(
  kpis: { key: string; label: string; changePct: number }[],
  posts: { title: string; engagement: number; platform: string }[],
) {
  const insights: AnalyticsBundle["insights"] = [];
  for (const kpi of kpis) {
    if (kpi.changePct >= 15) {
      insights.push({
        kind: "growth",
        severity: "positive",
        title: `${kpi.label} up ${kpi.changePct}%`,
        body: `${kpi.label} grew materially versus the previous period. Investigate which posts and channels drove the lift.`,
        metricKey: kpi.key,
        changePct: kpi.changePct,
        ruleKey: "large_growth_gte_15",
      });
    } else if (kpi.changePct <= -12) {
      insights.push({
        kind: "drop",
        severity: "warning",
        title: `${kpi.label} down ${Math.abs(kpi.changePct)}%`,
        body: `${kpi.label} dropped versus the previous period. Check posting cadence, reach quality, and channel health.`,
        metricKey: kpi.key,
        changePct: kpi.changePct,
        ruleKey: "large_drop_lte_m12",
      });
    }
  }
  const top = posts[0];
  if (top) {
    insights.push({
      kind: "anomaly",
      severity: "info",
      title: `Top content: ${top.title}`,
      body: `${top.platform} post leads engagement (${top.engagement.toLocaleString()}). Compare format and timing against weaker posts.`,
      ruleKey: "top_content_spotlight",
    });
  }
  return insights.slice(0, 8);
}

export const METRIC_CATALOG = KPI_DEFS.map((d) => ({
  key: d.key,
  name: d.label,
  category: d.key === "revenue" || d.key === "conversions" ? "business" : "social",
  unit: d.unit,
}));
