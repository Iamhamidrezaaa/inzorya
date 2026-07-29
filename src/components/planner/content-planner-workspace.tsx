"use client";

import { usePageCopy } from "@/i18n/use-page-copy";
import { useI18n } from "@/i18n/client";
import { faLabel } from "@/i18n/display-labels";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Copy,
  Lightbulb,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PLAN_SETTINGS,
  MIX_CATEGORIES,
  PLAN_TYPES,
  PLANNER_FORMATS,
  PLANNER_PLATFORMS,
  type PlanSettings,
  type PlanTypeKey,
} from "@/lib/planner";

const PLANNER_FA: Record<string, string> = {
  "Weekly Plan": "برنامه هفتگی",
  "Monthly Plan": "برنامه ماهانه",
  "Quarterly Plan": "برنامه فصلی",
  "Campaign Plan": "برنامه کمپین",
  "Launch Plan": "برنامه لانچ",
  "Holiday Plan": "برنامه مناسبتی",
  "Seasonal Plan": "برنامه فصلیِ مناسبتی",
  "Product Promotion Plan": "برنامه ترویج محصول",
  Educational: "آموزشی",
  Promotional: "پروموشن",
  Community: "جامعه",
  Entertainment: "سرگرمی",
  "Social Proof": "اثبات اجتماعی",
  "Behind The Scenes": "پشت صحنه",
  News: "اخبار",
  Offers: "پیشنهادها",
  "User Generated Content": "محتوای تولیدشده توسط کاربر",
  Instagram: "اینستاگرام",
  INSTAGRAM: "اینستاگرام",
  Facebook: "فیسبوک",
  FACEBOOK: "فیسبوک",
  LinkedIn: "لینکدین",
  LINKEDIN: "لینکدین",
  X: "ایکس",
  TikTok: "تیک‌تاک",
  TIKTOK: "تیک‌تاک",
  YouTube: "یوتیوب",
  YOUTUBE: "یوتیوب",
  Blog: "بلاگ",
  BLOG: "بلاگ",
  Newsletter: "خبرنامه",
  NEWSLETTER: "خبرنامه",
  "Instagram Reel": "ریلز اینستاگرام",
  INSTAGRAM_REEL: "ریلز اینستاگرام",
  "Instagram Carousel": "کاروسل اینستاگرام",
  INSTAGRAM_CAROUSEL: "کاروسل اینستاگرام",
  "Instagram Story": "استوری اینستاگرام",
  INSTAGRAM_STORY: "استوری اینستاگرام",
  "Instagram Post": "پست اینستاگرام",
  INSTAGRAM_POST: "پست اینستاگرام",
  LINKEDIN_POST: "پست لینکدین",
  FACEBOOK_POST: "پست فیسبوک",
  Short: "ویدیوی کوتاه",
  SHORT: "ویدیوی کوتاه",
  professional: "حرفه‌ای",
  friendly: "صمیمی",
  luxury: "لوکس",
  funny: "طنز",
  emotional: "احساسی",
  educational: "آموزشی",
  storytelling: "داستان‌گو",
  sales: "فروش‌محور",
  fa: "فارسی",
  en: "انگلیسی",
};

const TONE_OPTIONS = [
  "professional",
  "friendly",
  "luxury",
  "funny",
  "emotional",
  "educational",
  "storytelling",
  "sales",
] as const;

type PlanListItem = {
  id: string;
  title: string;
  type: PlanTypeKey;
  status: string;
  startDate: string;
  endDate: string;
  updatedAt: string;
  _count: { items: number };
};

type PlanItem = {
  id: string;
  title: string;
  goal: string | null;
  platform: string;
  contentType: string;
  mixCategory: string;
  suggestedDate: string;
  targetAudience: string | null;
  contentPillar: string | null;
  campaignName: string | null;
  priority: string;
  expectedOutcome: string | null;
  status: string;
  studioContentId: string | null;
};

type Insight = {
  id: string;
  itemId: string | null;
  kind: string;
  message: string;
  severity: string;
};

type Plan = {
  id: string;
  title: string;
  type: PlanTypeKey;
  status: string;
  startDate: string;
  endDate: string;
  summary: string | null;
  settings: PlanSettings;
  distribution: Record<string, number> | null;
  conflicts: { kind: string; message: string }[] | null;
  items: PlanItem[];
  insights: Insight[];
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

function toDay(value: string) {
  return value.slice(0, 10);
}

function addDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildMonthGrid(anchor: string) {
  const base = new Date(anchor);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const startPad = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: string[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(Date.UTC(year, month, 1 - (startPad - i)));
    cells.push(d.toISOString().slice(0, 10));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10));
  }
  while (cells.length % 7 !== 0) {
    const last = new Date(cells[cells.length - 1]);
    last.setUTCDate(last.getUTCDate() + 1);
    cells.push(last.toISOString().slice(0, 10));
  }
  return { year, month, cells };
}

type JalaliDateParts = { jy: number; jm: number; jd: number };

const JALALI_MONTHS_FA = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

const GREGORIAN_MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function div(a: number, b: number) {
  return Math.floor(a / b);
}

function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDateParts {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    g_d_m[gm - 1]!;
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  let days =
    365 * jy +
    div(jy, 33) * 8 +
    div((jy % 33) + 3, 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > (sal_a[gm] ?? 0); gm++) {
    gd -= sal_a[gm] ?? 0;
  }
  return { gy, gm, gd };
}

function jalaliMonthLength(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const roundTrip = gregorianToJalali(
    jalaliToGregorian(jy, 12, 30).gy,
    jalaliToGregorian(jy, 12, 30).gm,
    jalaliToGregorian(jy, 12, 30).gd,
  );
  return roundTrip.jy === jy && roundTrip.jm === 12 && roundTrip.jd === 30 ? 30 : 29;
}

function gregorianIsoToJalali(iso: string): JalaliDateParts {
  const [gy, gm, gd] = iso.slice(0, 10).split("-").map(Number);
  return gregorianToJalali(gy || 0, gm || 1, gd || 1);
}

function jalaliToGregorianIso(jy: number, jm: number, jd: number) {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return `${gy.toString().padStart(4, "0")}-${gm.toString().padStart(2, "0")}-${gd
    .toString()
    .padStart(2, "0")}`;
}

function gregorianIsoParts(iso: string) {
  const [gy, gm, gd] = iso.slice(0, 10).split("-").map(Number);
  return { gy: gy || 0, gm: gm || 1, gd: gd || 1 };
}

function gregorianMonthLength(gy: number, gm: number) {
  return new Date(Date.UTC(gy, gm, 0)).getUTCDate();
}

function formatFaPlainNumber(value: number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}

export function ContentPlannerWorkspace({ workspaceSlug, brandSlug }: Props) {
  const page = usePageCopy("planner");
  const { locale } = useI18n();
  const t = (en: string, fa: string) => (locale === "fa" ? fa : en);
  const tr = useCallback((value: string) => faLabel(locale, value, PLANNER_FA), [locale]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [settings, setSettings] = useState<PlanSettings>(() => ({
    ...DEFAULT_PLAN_SETTINGS,
    language: locale === "fa" ? "fa" : "en",
  }));
  const [planType, setPlanType] = useState<PlanTypeKey>("WEEKLY");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const jalaliStart = useMemo(() => gregorianIsoToJalali(startDate), [startDate]);
  const gregorianStart = useMemo(() => gregorianIsoParts(startDate), [startDate]);
  const jalaliYears = useMemo(
    () => Array.from({ length: 6 }, (_, i) => jalaliStart.jy - 1 + i),
    [jalaliStart.jy],
  );
  const gregorianYears = useMemo(
    () => Array.from({ length: 6 }, (_, i) => gregorianStart.gy - 1 + i),
    [gregorianStart.gy],
  );

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/planner?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPlans(data.plans || []);
      if (data.defaultSettings) {
        setSettings({
          ...data.defaultSettings,
          language: locale === "fa" ? "fa" : data.defaultSettings.language || "en",
        });
      }
      if (!plan && data.plans?.[0]?.id) {
        await openPlan(data.plans[0].id);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("Unable to load planner", "بارگذاری برنامه‌ریز ممکن نشد"),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, locale]);

  useEffect(() => {
    setSettings((s) => ({
      ...s,
      language: locale === "fa" ? "fa" : s.language === "fa" ? "en" : s.language,
    }));
  }, [locale]);

  const openPlan = async (planId: string) => {
    const res = await fetch(`/api/planner?${qs}&view=plan&planId=${planId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    setPlan(data.plan);
    setSelected(new Set());
    setActiveItemId(null);
  };

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const generate = async () => {
    setBusy(true);
    try {
      const data = await post({
        intent: "generate",
        planType,
        settings,
        startDate,
      });
      setPlan(data.plan);
      toast.success(t("Plan ready for review", "برنامه آماده بازبینی است"));
      await loadBootstrap();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Generate failed", "تولید ناموفق بود"));
    } finally {
      setBusy(false);
    }
  };

  const refreshPlan = async (next: Plan | null | undefined) => {
    if (next) setPlan(next);
    else if (plan) await openPlan(plan.id);
    await loadBootstrap();
  };

  const activeItem = plan?.items.find((i) => i.id === activeItemId) || null;
  const activeInsights =
    plan?.insights.filter((i) => i.itemId === activeItemId) || [];
  const planConflicts = Array.isArray(plan?.conflicts) ? plan!.conflicts! : [];
  const grid = buildMonthGrid(plan ? toDay(plan.startDate) : startDate);
  const itemsByDay = useMemo(() => {
    const map = new Map<string, PlanItem[]>();
    for (const item of plan?.items || []) {
      if (item.status === "REJECTED") continue;
      const key = toDay(item.suggestedDate);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [plan]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateJalaliStartDate = useCallback(
    (patch: Partial<JalaliDateParts>) => {
      const next = {
        jy: patch.jy ?? jalaliStart.jy,
        jm: patch.jm ?? jalaliStart.jm,
        jd: patch.jd ?? jalaliStart.jd,
      };
      const maxDay = jalaliMonthLength(next.jy, next.jm);
      const safeDay = Math.min(next.jd, maxDay);
      setStartDate(jalaliToGregorianIso(next.jy, next.jm, safeDay));
    },
    [jalaliStart],
  );
  const updateGregorianStartDate = useCallback(
    (patch: Partial<{ gy: number; gm: number; gd: number }>) => {
      const next = {
        gy: patch.gy ?? gregorianStart.gy,
        gm: patch.gm ?? gregorianStart.gm,
        gd: patch.gd ?? gregorianStart.gd,
      };
      const maxDay = gregorianMonthLength(next.gy, next.gm);
      const safeDay = Math.min(next.gd, maxDay);
      setStartDate(
        `${next.gy.toString().padStart(4, "0")}-${next.gm
          .toString()
          .padStart(2, "0")}-${safeDay.toString().padStart(2, "0")}`,
      );
    },
    [gregorianStart],
  );

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="hidden h-full rounded-2xl lg:block" />
      </div>
    );
  }

  return (
    <div
      dir={locale === "fa" ? "rtl" : "ltr"}
      className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/8 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.07),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]"
    >
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
            <CalendarDays className="size-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">{page.title}</h1>
            <p className="text-xs text-muted-foreground">
              {t(
                "Strategic publishing plans — never captions or scripts",
                "برنامه‌های انتشار استراتژیک — نه کپشن یا اسکریپت",
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || selected.size === 0}
                onClick={() =>
                  void post({
                    intent: "bulk_status",
                    planId: plan.id,
                    itemIds: [...selected],
                    status: "APPROVED",
                  }).then((d) => {
                    toast.success(t("Approved", "تأیید شد"));
                    return refreshPlan(d.plan);
                  })
                }
              >
                <Check className="size-3.5" />
                {t("Bulk approve", "تأیید گروهی")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || selected.size === 0}
                onClick={() =>
                  void post({
                    intent: "regenerate",
                    planId: plan.id,
                    itemIds: [...selected],
                  }).then((d) => {
                    toast.success(t("Regenerated", "بازتولید شد"));
                    return refreshPlan(d.plan);
                  })
                }
              >
                <RefreshCw className="size-3.5" />
                {t("Bulk regen", "بازتولید گروهی")}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void post({
                    intent: "update_plan",
                    planId: plan.id,
                    status: "APPROVED",
                  })
                    .then(() =>
                      post({
                        intent: "push_studio",
                        planId: plan.id,
                        itemIds: selected.size ? [...selected] : undefined,
                      }),
                    )
                    .then((d) => {
                      toast.success(
                        t(
                          `Pushed ${d.createdCount} items to Studio`,
                          `${d.createdCount} مورد به استودیو ارسال شد`,
                        ),
                      );
                      return refreshPlan(d.plan);
                    })
                    .catch((e) =>
                      toast.error(
                        e instanceof Error ? e.message : t("Push failed", "ارسال ناموفق بود"),
                      ),
                    )
                }
              >
                <Send className="size-3.5" />
                {t("Send to Studio", "ارسال به استودیو")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* LEFT — generate + history */}
        <aside className="hidden min-h-0 flex-col border-r border-white/6 lg:flex">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("Generate", "تولید")}
              </p>
              <div className="space-y-2">
                <Label className="text-xs">{t("Plan type", "نوع برنامه")}</Label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value as PlanTypeKey)}
                >
                  {PLAN_TYPES.map((pt) => (
                    <option key={pt.key} value={pt.key}>
                      {tr(pt.label)}
                    </option>
                  ))}
                </select>
                <Label className="text-xs">{t("Start date", "تاریخ شروع")}</Label>
                {locale === "fa" ? (
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                      value={jalaliStart.jd}
                      onChange={(e) =>
                        updateJalaliStartDate({ jd: Number(e.target.value) })
                      }
                    >
                      {Array.from(
                        { length: jalaliMonthLength(jalaliStart.jy, jalaliStart.jm) },
                        (_, i) => i + 1,
                      ).map((day) => (
                        <option key={day} value={day}>
                          {formatFaPlainNumber(day)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                      value={jalaliStart.jm}
                      onChange={(e) =>
                        updateJalaliStartDate({ jm: Number(e.target.value) })
                      }
                    >
                      {JALALI_MONTHS_FA.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                      value={jalaliStart.jy}
                      onChange={(e) =>
                        updateJalaliStartDate({ jy: Number(e.target.value) })
                      }
                    >
                      {jalaliYears.map((year) => (
                        <option key={year} value={year}>
                          {formatFaPlainNumber(year)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                      value={gregorianStart.gd}
                      onChange={(e) =>
                        updateGregorianStartDate({ gd: Number(e.target.value) })
                      }
                    >
                      {Array.from(
                        { length: gregorianMonthLength(gregorianStart.gy, gregorianStart.gm) },
                        (_, i) => i + 1,
                      ).map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                      value={gregorianStart.gm}
                      onChange={(e) =>
                        updateGregorianStartDate({ gm: Number(e.target.value) })
                      }
                    >
                      {GREGORIAN_MONTHS_EN.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                      value={gregorianStart.gy}
                      onChange={(e) =>
                        updateGregorianStartDate({ gy: Number(e.target.value) })
                      }
                    >
                      {gregorianYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Label className="text-xs">{t("Business goal", "هدف کسب‌وکار")}</Label>
                <Input
                  value={settings.businessGoal}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, businessGoal: e.target.value }))
                  }
                  placeholder={t("e.g. Increase engagement", "مثلاً افزایش تعامل")}
                />
                <Label className="text-xs">{t("Audience", "مخاطب")}</Label>
                <Input
                  value={settings.targetAudience}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, targetAudience: e.target.value }))
                  }
                />
                <Label className="text-xs">{t("Frequency", "فرکانس")}</Label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                  value={settings.publishingFrequency}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      publishingFrequency: e.target.value as PlanSettings["publishingFrequency"],
                    }))
                  }
                >
                  <option value="light">{t("Light", "کم")}</option>
                  <option value="steady">{t("Steady", "ثابت")}</option>
                  <option value="aggressive">{t("Aggressive", "پرحجم")}</option>
                </select>
                <Label className="text-xs">{t("Tone / Language", "لحن / زبان")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                    value={settings.tone}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, tone: e.target.value }))
                    }
                  >
                    {Array.from(new Set([settings.tone, ...TONE_OPTIONS])).map((tone) => (
                      <option key={tone} value={tone}>
                        {tr(tone)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                    value={settings.language}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, language: e.target.value }))
                    }
                  >
                    <option value="fa">{tr("fa")}</option>
                    <option value="en">{tr("en")}</option>
                  </select>
                </div>
                <Label className="text-xs">{t("Platforms", "پلتفرم‌ها")}</Label>
                <div className="flex flex-wrap gap-1">
                  {PLANNER_PLATFORMS.map((p) => {
                    const on = settings.platforms.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            platforms: on
                              ? s.platforms.filter((x) => x !== p)
                              : [...s.platforms, p],
                          }))
                        }
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[10px]",
                          on
                            ? "border-teal-500/40 bg-teal-500/10 text-foreground"
                            : "border-white/10 text-muted-foreground",
                        )}
                      >
                        {tr(p)}
                      </button>
                    );
                  })}
                </div>
                <Label className="text-xs">{t("Content mix", "ترکیب محتوا")}</Label>
                <div className="flex flex-wrap gap-1">
                  {MIX_CATEGORIES.map((m) => {
                    const on = settings.contentMix.includes(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            contentMix: on
                              ? s.contentMix.filter((x) => x !== m.key)
                              : [...s.contentMix, m.key],
                          }))
                        }
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[10px]",
                          on
                            ? "border-teal-500/40 bg-teal-500/10"
                            : "border-white/10 text-muted-foreground",
                        )}
                      >
                        {tr(m.label)}
                      </button>
                    );
                  })}
                </div>
                <Button className="w-full" disabled={busy} onClick={() => void generate()}>
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {t("Generate plan", "تولید برنامه")}
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("History", "تاریخچه")}
              </p>
              <div className="space-y-1">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void openPlan(p.id)}
                    className={cn(
                      "w-full rounded-lg px-2 py-2 text-left text-sm",
                      plan?.id === p.id ? "bg-white/8" : "hover:bg-white/4",
                    )}
                  >
                    <span className="line-clamp-1 font-medium">{p.title}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {p.status} · {p._count.items} items
                    </span>
                  </button>
                ))}
                {!plans.length ? (
                  <p className="px-1 text-xs text-muted-foreground">
                    {t(
                      "No plans yet — generate your first calendar.",
                      "هنوز برنامه‌ای نیست — اولین تقویم خود را بسازید.",
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER — calendar */}
        <section className="flex min-h-0 flex-col">
          <div className="border-b border-white/6 px-4 py-2">
            <p className="text-sm font-medium">
              {plan?.title || t("Calendar", "تقویم")}
            </p>
            {plan?.summary ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{plan.summary}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "Generate → Review → Modify → Approve → Send to Studio",
                  "تولید ← بازبینی ← ویرایش ← تأیید ← ارسال به استودیو",
                )}
              </p>
            )}
          </div>

          {!plan ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-md space-y-3">
                <h2 className="text-2xl tracking-tight">
                  {t(
                    "Start from intelligence, not a blank page",
                    "از هوش شروع کنید، نه از صفحه خالی",
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Plans use Business Brain, pillars, campaigns, analytics and brand voice. Only strategic slots are created — never full captions.",
                    "برنامه‌ها از مغز کسب‌وکار، ستون‌ها، کمپین‌ها، تحلیل‌ها و لحن برند استفاده می‌کنند. فقط اسلات‌های استراتژیک ساخته می‌شوند — هرگز کپشن کامل.",
                  )}
                </p>
                <Button disabled={busy} onClick={() => void generate()}>
                  <Sparkles className="size-3.5" />
                  {t("Generate weekly plan", "تولید برنامه هفتگی")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                {[
                  t("Sun", "ی"),
                  t("Mon", "د"),
                  t("Tue", "س"),
                  t("Wed", "چ"),
                  t("Thu", "پ"),
                  t("Fri", "ج"),
                  t("Sat", "ش"),
                ].map((d, i) => (
                  <div key={`${d}-${i}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grid.cells.map((day) => {
                  const inPlanMonth =
                    day.slice(0, 7) === toDay(plan.startDate).slice(0, 7) ||
                    (day >= toDay(plan.startDate) && day <= toDay(plan.endDate));
                  const dayItems = itemsByDay.get(day) || [];
                  return (
                    <div
                      key={day}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!dragItemId) return;
                        void post({
                          intent: "update_item",
                          itemId: dragItemId,
                          suggestedDate: day,
                        })
                          .then((d) => refreshPlan(d.plan))
                          .finally(() => setDragItemId(null));
                      }}
                      className={cn(
                        "min-h-[108px] rounded-xl border p-1.5",
                        inPlanMonth
                          ? "border-white/8 bg-black/20"
                          : "border-transparent bg-transparent opacity-40",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between px-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {Number(day.slice(8, 10))}
                        </span>
                        {dayItems.length > 2 ? (
                          <AlertTriangle className="size-3 text-amber-400" />
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        {dayItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            draggable={item.status !== "PUSHED"}
                            onDragStart={() => setDragItemId(item.id)}
                            onClick={() => {
                              setActiveItemId(item.id);
                              toggleSelect(item.id);
                            }}
                            className={cn(
                              "w-full rounded-lg border px-1.5 py-1 text-left text-[10px] leading-snug",
                              selected.has(item.id)
                                ? "border-teal-500/50 bg-teal-500/15"
                                : "border-white/10 bg-white/[0.03] hover:border-white/20",
                              item.status === "APPROVED" && "ring-1 ring-teal-500/30",
                              item.status === "PUSHED" && "opacity-60",
                            )}
                          >
                            <span className="line-clamp-2 font-medium text-foreground">
                              {item.title}
                            </span>
                            <span className="mt-0.5 block text-muted-foreground">
                              {item.platform} · {item.mixCategory.replaceAll("_", " ")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT — insights + edit */}
        <aside className="hidden min-h-0 flex-col border-l border-white/6 lg:flex">
          <div className="border-b border-white/6 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("Insight Panel", "پنل بینش")}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            {planConflicts.length ? (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-amber-400/90">
                  {t("Conflicts", "تعارض‌ها")}
                </p>
                {planConflicts.slice(0, 6).map((c, i) => (
                  <div
                    key={`${c.kind}-${i}`}
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-xs text-muted-foreground"
                  >
                    {c.message}
                  </div>
                ))}
              </div>
            ) : null}

            {plan?.distribution ? (
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Distribution", "توزیع")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(plan.distribution).map(([k, v]) => (
                    <Badge key={k} variant="outline" className="rounded-md text-[10px]">
                      {tr(k)} · {v}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {activeItem ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="size-3.5 text-teal-300" />
                  <p className="text-sm font-medium">{t("Why this slot", "چرا این اسلات")}</p>
                </div>
                {activeInsights.length ? (
                  activeInsights.map((i) => (
                    <p key={i.id} className="text-xs leading-relaxed text-muted-foreground">
                      {i.message}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Grounded in business context and schedule balance.",
                      "بر پایه زمینه کسب‌وکار و تعادل برنامه.",
                    )}
                  </p>
                )}

                <div className="space-y-2 rounded-xl border border-white/8 p-2.5">
                  <Label className="text-xs">{t("Title", "عنوان")}</Label>
                  <Input
                    value={activeItem.title}
                    onChange={(e) =>
                      setPlan((p) =>
                        p
                          ? {
                              ...p,
                              items: p.items.map((it) =>
                                it.id === activeItem.id
                                  ? { ...it, title: e.target.value }
                                  : it,
                              ),
                            }
                          : p,
                      )
                    }
                    onBlur={() =>
                      void post({
                        intent: "update_item",
                        itemId: activeItem.id,
                        title: activeItem.title,
                      }).then((d) => refreshPlan(d.plan))
                    }
                  />
                  <Label className="text-xs">{t("Goal", "هدف")}</Label>
                  <Textarea
                    className="min-h-[64px]"
                    value={activeItem.goal || ""}
                    onChange={(e) =>
                      setPlan((p) =>
                        p
                          ? {
                              ...p,
                              items: p.items.map((it) =>
                                it.id === activeItem.id
                                  ? { ...it, goal: e.target.value }
                                  : it,
                              ),
                            }
                          : p,
                      )
                    }
                    onBlur={() =>
                      void post({
                        intent: "update_item",
                        itemId: activeItem.id,
                        goal: activeItem.goal,
                      }).then((d) => refreshPlan(d.plan))
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">{t("Platform", "پلتفرم")}</Label>
                      <select
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                        value={activeItem.platform}
                        onChange={(e) =>
                          void post({
                            intent: "update_item",
                            itemId: activeItem.id,
                            platform: e.target.value,
                          }).then((d) => refreshPlan(d.plan))
                        }
                      >
                        {PLANNER_PLATFORMS.map((p) => (
                          <option key={p} value={p}>
                            {tr(p)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">{t("Format", "قالب")}</Label>
                      <select
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                        value={activeItem.contentType}
                        onChange={(e) =>
                          void post({
                            intent: "update_item",
                            itemId: activeItem.id,
                            contentType: e.target.value,
                          }).then((d) => refreshPlan(d.plan))
                        }
                      >
                        {PLANNER_FORMATS.map((f) => (
                          <option key={f} value={f}>
                            {tr(f)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy || activeItem.status === "PUSHED"}
                      onClick={() =>
                        void post({
                          intent: "update_item",
                          itemId: activeItem.id,
                          status: "APPROVED",
                        }).then((d) => refreshPlan(d.plan))
                      }
                    >
                      <Check className="size-3.5" />
                      {t("Approve", "تأیید")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || activeItem.status === "PUSHED"}
                      onClick={() =>
                        void post({
                          intent: "update_item",
                          itemId: activeItem.id,
                          status: "REJECTED",
                        }).then((d) => refreshPlan(d.plan))
                      }
                    >
                      <X className="size-3.5" />
                      {t("Reject", "رد")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void post({
                          intent: "duplicate_item",
                          itemId: activeItem.id,
                        }).then((d) => refreshPlan(d.plan))
                      }
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void post({
                          intent: "regenerate",
                          planId: plan!.id,
                          itemIds: [activeItem.id],
                        }).then((d) => {
                          toast.success(t("Item regenerated", "مورد بازتولید شد"));
                          return refreshPlan(d.plan);
                        })
                      }
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || activeItem.status === "PUSHED"}
                      onClick={() =>
                        void post({
                          intent: "update_item",
                          itemId: activeItem.id,
                          suggestedDate: addDays(toDay(activeItem.suggestedDate), 1),
                        }).then((d) => refreshPlan(d.plan))
                      }
                    >
                      {t("Move +1d", "انتقال +۱ روز")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "Select a calendar item to see why it was suggested and edit details.",
                  "یک مورد تقویم را انتخاب کنید تا دلیل پیشنهاد را ببینید و جزئیات را ویرایش کنید.",
                )}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
