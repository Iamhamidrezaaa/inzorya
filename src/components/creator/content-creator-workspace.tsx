"use client";

import { usePageCopy } from "@/i18n/use-page-copy";
import { useI18n } from "@/i18n/client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  FileDown,
  Heart,
  History,
  Loader2,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CREATOR_CONTENT_TYPES,
  CREATOR_OBJECTIVES,
  CREATOR_PLATFORMS,
  REWRITE_STYLES,
  SCORE_DIMENSIONS,
  VARIATION_COUNTS,
  contentTypesForPlatform,
  type CreatorContentTypeKey,
  type CreatorObjectiveKey,
} from "@/lib/creator";

type Campaign = { id: string; name: string; status: string; objective: string | null };

type HistoryItem = {
  id: string;
  title: string;
  platform: string;
  objective: string;
  contentType: string;
  status: string;
  favorited: boolean;
  version: number;
  campaignName: string | null;
  updatedAt: string;
  _count: { variations: number };
};

type Score = {
  brandConsistency: number;
  readability: number;
  ctaStrength: number;
  emotionalImpact: number;
  engagementPotential: number;
  seoQuality: number;
  platformCompatibility: number;
  overall: number;
  explanation: string;
};

type Variation = {
  id: string;
  label: string;
  title: string;
  hook: string;
  body: string;
  cta: string | null;
  visualDirection: string | null;
  suggestedCover: string | null;
  hashtags: string[];
  keywords: string[];
  estimatedReadTime: string | null;
  carouselSlides: Array<{ order: number; title: string; text: string; isCta?: boolean }> | null;
  reelBreakdown: {
    openingHook?: string;
    scenes?: Array<{ title: string; visual: string; script: string }>;
    endingCta?: string;
  } | null;
  overallScore: number | null;
  status: string;
  score: Score | null;
  brandValidation: {
    passed: boolean;
    notes: string | null;
    repetitionNotes: string | null;
  } | null;
  visuals: Array<{ id: string; kind: string; title: string; detail: string }>;
};

type Generated = {
  id: string;
  title: string;
  platform: string;
  objective: string;
  contentType: string;
  status: string;
  favorited: boolean;
  version: number;
  qualityFlags: Array<{ kind: string; message: string }> | null;
  variations: Variation[];
  versions: Array<{
    id: string;
    version: number;
    title: string;
    status: string;
    rewriteStyle: string | null;
    createdAt: string;
  }>;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ScoreBars({ score }: { score: Score }) {
  const { locale } = useI18n();
  const t = (en: string, fa: string) => (locale === "fa" ? fa : en);
  const labels: Record<string, string> = {
    brandConsistency: t("Brand Consistency", "ثبات برند"),
    readability: t("Readability", "خوانایی"),
    ctaStrength: t("CTA Strength", "قدرت دعوت به اقدام"),
    emotionalImpact: t("Emotional Impact", "تأثیر احساسی"),
    engagementPotential: t("Engagement Potential", "پتانسیل تعامل"),
    seoQuality: t("SEO Quality", "کیفیت سئو"),
    platformCompatibility: t("Platform Compatibility", "سازگاری پلتفرم"),
  };
  return (
    <div className="space-y-1.5">
      {SCORE_DIMENSIONS.map((d) => {
        const value = score[d.key as keyof Score] as number;
        return (
          <div key={d.key}>
            <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
              <span>{labels[d.key] ?? d.label}</span>
              <span>{Math.round(value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-teal-400/80"
                style={{ width: `${Math.min(100, value)}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
        {score.explanation}
      </p>
    </div>
  );
}

export function ContentCreatorWorkspace({ workspaceSlug, brandSlug }: Props) {
  const page = usePageCopy("creator");
  const { locale } = useI18n();
  const t = (en: string, fa: string) => (locale === "fa" ? fa : en);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [platform, setPlatform] = useState("INSTAGRAM");
  const [objective, setObjective] = useState<CreatorObjectiveKey>("ENGAGEMENT");
  const [contentType, setContentType] = useState<CreatorContentTypeKey>("INSTAGRAM_CAPTION");
  const [campaignId, setCampaignId] = useState("");
  const [variationCount, setVariationCount] = useState(3);
  const [content, setContent] = useState<Generated | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const typeOptions = useMemo(() => contentTypesForPlatform(platform), [platform]);

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/creator?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setHistory(data.history || []);
      setCampaigns(data.campaigns || []);
      if (data.defaults?.platform) setPlatform(data.defaults.platform);
      if (data.defaults?.objective) setObjective(data.defaults.objective);
      if (data.defaults?.contentType) setContentType(data.defaults.contentType);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("Unable to load creator", "بارگذاری تولیدکننده ممکن نشد"),
      );
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!typeOptions.some((t) => t.key === contentType) && typeOptions[0]) {
      setContentType(typeOptions[0].key);
    }
  }, [typeOptions, contentType]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/creator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const openContent = async (id: string) => {
    const res = await fetch(`/api/creator?${qs}&view=content&contentId=${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    setContent(data.content);
    setSelectedIds(data.content.variations?.[0] ? [data.content.variations[0].id] : []);
  };

  const generate = async () => {
    setBusy(true);
    try {
      const data = await post({
        intent: "generate",
        platform,
        objective,
        contentType,
        campaignId: campaignId || null,
        variationCount,
        language: locale,
      });
      setContent(data.content);
      setSelectedIds(data.content.variations?.[0] ? [data.content.variations[0].id] : []);
      toast.success(t("Variations ready for review", "نسخه‌ها آماده بازبینی هستند"));
      await loadBootstrap();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Generate failed", "تولید ناموفق بود"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter" && !busy) {
        e.preventDefault();
        void generate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, platform, objective, contentType, campaignId, variationCount]);

  const activeVariations = content?.variations || [];
  const visible = compareMode
    ? activeVariations.filter((v) => selectedIds.includes(v.id))
    : activeVariations.filter((v) => selectedIds[0] === v.id);
  const primary = activeVariations.find((v) => v.id === selectedIds[0]) || activeVariations[0];

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="hidden h-full rounded-2xl lg:block" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/8 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.08),_transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
            <PenLine className="size-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">{page.title}</h1>
            <p className="text-xs text-muted-foreground">
              {t(
                "Creative director workflow — context first, prompts never shown",
                "گردش کار کارگردان خلاق — اول زمینه، پرامپت هرگز نمایش داده نمی‌شود",
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={compareMode ? "secondary" : "ghost"}
            disabled={!content || selectedIds.length < 2}
            onClick={() => setCompareMode((v) => !v)}
          >
            {t("Compare", "مقایسه")}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void generate()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {t("Generate", "تولید")}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* LEFT — flow */}
        <aside className="hidden min-h-0 flex-col border-r border-white/6 lg:flex">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("1 · Platform", "۱ · پلتفرم")}
              </p>
              <div className="flex flex-wrap gap-1">
                {CREATOR_PLATFORMS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPlatform(p.key)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px]",
                      platform === p.key
                        ? "border-teal-500/40 bg-teal-500/10"
                        : "border-white/10 text-muted-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("2 · Objective", "۲ · هدف")}
              </p>
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                value={objective}
                onChange={(e) => setObjective(e.target.value as CreatorObjectiveKey)}
              >
                {CREATOR_OBJECTIVES.map((o) => (
                  <option key={o.key} value={o.key}>
                    {t(o.label, {
                      "Brand Awareness": "آگاهی از برند",
                      "Lead Generation": "جذب سرنخ",
                      Engagement: "تعامل",
                      Sales: "فروش",
                      Education: "آموزش",
                      Community: "جامعه",
                      Retention: "نگهداشت",
                      Traffic: "ترافیک",
                      Launch: "لانچ",
                      Support: "پشتیبانی",
                    }[o.label] ?? o.label)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("3 · Campaign", "۳ · کمپین")}
              </p>
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                <option value="">{t("No campaign", "بدون کمپین")}</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("4 · Content type", "۴ · نوع محتوا")}
              </p>
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                value={contentType}
                onChange={(e) => setContentType(e.target.value as CreatorContentTypeKey)}
              >
                {(typeOptions.length ? typeOptions : CREATOR_CONTENT_TYPES).map((ct) => (
                  <option key={ct.key} value={ct.key}>
                    {t(
                      ct.label,
                      (
                        {
                          "Instagram Caption": "کپشن اینستاگرام",
                          Carousel: "کاروسل",
                          Story: "استوری",
                          "Reel Script": "اسکریپت ریل",
                          "Video Hook": "قلاب ویدیو",
                          "Video Description": "توضیح ویدیو",
                          Threads: "تردز",
                          "LinkedIn Post": "پست لینکدین",
                          "Facebook Post": "پست فیسبوک",
                          "X Post": "پست X",
                          Newsletter: "خبرنامه",
                          "Blog Article": "مقاله بلاگ",
                          "Landing Page Copy": "کپی لندینگ",
                          "Email Campaign": "کمپین ایمیل",
                          "Product Description": "توضیح محصول",
                          CTA: "دعوت به اقدام",
                          Headline: "تیتر",
                          Hashtags: "هشتگ‌ها",
                        } as Record<string, string>
                      )[ct.label] ?? ct.label,
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("Variations", "نسخه‌ها")}
              </p>
              <div className="flex gap-1">
                {VARIATION_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setVariationCount(n)}
                    className={cn(
                      "flex-1 rounded-lg border py-1.5 text-sm",
                      variationCount === n
                        ? "border-teal-500/40 bg-teal-500/10"
                        : "border-white/10 text-muted-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t("⌘/Ctrl + Enter to generate", "⌘/Ctrl + Enter برای تولید")}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <History className="size-3" />
                {t("History", "تاریخچه")}
              </p>
              <div className="space-y-1">
                {history.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => void openContent(h.id)}
                    className={cn(
                      "w-full rounded-lg px-2 py-2 text-left text-sm",
                      content?.id === h.id ? "bg-white/8" : "hover:bg-white/4",
                    )}
                  >
                    <span className="line-clamp-1 font-medium">{h.title}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      v{h.version} · {h._count.variations} vars · {h.status}
                    </span>
                  </button>
                ))}
                {!history.length ? (
                  <p className="text-xs text-muted-foreground">
                    {t("No generations yet.", "هنوز تولیدی نیست.")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <section className="flex min-h-0 flex-col">
          {!content ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-lg space-y-3">
                <h2 className="text-2xl tracking-tight">
                  {t("Select. Generate. Approve.", "انتخاب. تولید. تأیید.")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Business Brain, brand voice, audience, campaigns and content history are loaded automatically. You never start from a blank prompt.",
                    "مغز کسب‌وکار، لحن برند، مخاطب، کمپین‌ها و تاریخچه محتوا به‌طور خودکار بارگذاری می‌شوند. هرگز از یک پرامپت خالی شروع نمی‌کنید.",
                  )}
                </p>
                <Button disabled={busy} onClick={() => void generate()}>
                  <Sparkles className="size-3.5" />
                  {t("Generate variations", "تولید نسخه‌ها")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-white/6 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{content.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {content.platform} ·{" "}
                    {t(
                      content.contentType.replaceAll("_", " "),
                      (
                        {
                          INSTAGRAM_CAPTION: "کپشن اینستاگرام",
                          CAROUSEL: "کاروسل",
                          STORY: "استوری",
                          REEL_SCRIPT: "اسکریپت ریل",
                          VIDEO_HOOK: "قلاب ویدیو",
                          VIDEO_DESCRIPTION: "توضیح ویدیو",
                          THREADS: "تردز",
                          LINKEDIN_POST: "پست لینکدین",
                          FACEBOOK_POST: "پست فیسبوک",
                          X_POST: "پست X",
                          NEWSLETTER: "خبرنامه",
                          BLOG_ARTICLE: "مقاله بلاگ",
                          LANDING_PAGE_COPY: "کپی لندینگ",
                          EMAIL_CAMPAIGN: "کمپین ایمیل",
                          PRODUCT_DESCRIPTION: "توضیح محصول",
                          CTA: "دعوت به اقدام",
                          HEADLINE: "تیتر",
                          HASHTAGS: "هشتگ‌ها",
                        } as Record<string, string>
                      )[content.contentType] ||
                        content.contentType.replaceAll("_", " "),
                    )}{" "}
                    · {locale === "fa" ? "ن" : "v"}
                    {content.version}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void post({
                        intent: "update",
                        contentId: content.id,
                        favorited: !content.favorited,
                      }).then((d) => {
                        setContent(d.content);
                        return loadBootstrap();
                      })
                    }
                  >
                    <Heart
                      className={cn(
                        "size-3.5",
                        content.favorited && "fill-current text-teal-400",
                      )}
                    />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void post({
                        intent: "update",
                        contentId: content.id,
                        duplicate: true,
                      }).then((d) => {
                        toast.success(t("Duplicated", "تکثیر شد"));
                        setContent(d.content);
                        return loadBootstrap();
                      })
                    }
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void generate()}
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-1 overflow-x-auto border-b border-white/6 px-3 py-2">
                {activeVariations.map((v) => {
                  const on = selectedIds.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        if (compareMode) {
                          setSelectedIds((prev) =>
                            prev.includes(v.id)
                              ? prev.filter((id) => id !== v.id)
                              : [...prev, v.id].slice(0, 3),
                          );
                        } else {
                          setSelectedIds([v.id]);
                        }
                      }}
                      className={cn(
                        "shrink-0 rounded-lg border px-2.5 py-1.5 text-left text-xs",
                        on
                          ? "border-teal-500/40 bg-teal-500/10"
                          : "border-white/10 text-muted-foreground",
                      )}
                    >
                      <span className="font-medium">{v.label}</span>
                      <span className="ml-2 text-muted-foreground">
                        {Math.round(v.overallScore || 0)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                className={cn(
                  "min-h-0 flex-1 gap-3 overflow-auto p-4",
                  compareMode && visible.length > 1
                    ? "grid md:grid-cols-2 xl:grid-cols-3"
                    : "block",
                )}
              >
                {(visible.length ? visible : primary ? [primary] : []).map((v) => (
                  <article
                    key={v.id}
                    className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.04] to-transparent p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-md">
                        {v.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t("Overall", "کل")} {Math.round(v.overallScore || 0)}
                      </span>
                      {v.estimatedReadTime ? (
                        <span className="text-xs text-muted-foreground">
                          · {v.estimatedReadTime}
                        </span>
                      ) : null}
                      {v.brandValidation?.passed ? (
                        <Badge variant="outline" className="rounded-md text-[10px]">
                          {t("Review passed", "بازبینی موفق")}
                        </Badge>
                      ) : null}
                    </div>

                    <h2 className="text-xl tracking-tight text-foreground">
                      {v.title}
                    </h2>
                    <p className="mt-3 text-sm font-medium text-teal-200/90">{v.hook}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                      {v.body}
                    </p>
                    {v.cta ? (
                      <p className="mt-4 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("CTA", "دعوت به اقدام")}
                        </span>
                        <br />
                        {v.cta}
                      </p>
                    ) : null}

                    {Array.isArray(v.carouselSlides) && v.carouselSlides.length ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {t("Carousel", "کاروسل")}
                        </p>
                        {v.carouselSlides.map((s) => (
                          <div
                            key={s.order}
                            className="rounded-lg border border-white/8 px-3 py-2 text-sm"
                          >
                            <span className="text-xs text-muted-foreground">
                              {t("Slide", "اسلاید")} {s.order}
                              {s.isCta ? ` · ${t("CTA", "دعوت به اقدام")}` : ""}
                            </span>
                            <p className="font-medium">{s.title}</p>
                            <p className="text-muted-foreground">{s.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {v.reelBreakdown ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {t("Reel breakdown", "شرح ریل")}
                        </p>
                        <p className="text-sm">
                          <strong>{t("Hook:", "قلاب:")}</strong> {v.reelBreakdown.openingHook}
                        </p>
                        {(v.reelBreakdown.scenes || []).map((s, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-white/8 px-3 py-2 text-sm"
                          >
                            <p className="font-medium">{s.title}</p>
                            <p className="text-muted-foreground">{s.visual}</p>
                            <p>{s.script}</p>
                          </div>
                        ))}
                        <p className="text-sm">
                          <strong>{t("Ending CTA:", "دعوت پایانی:")}</strong>{" "}
                          {v.reelBreakdown.endingCta}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>
                        <span className="text-foreground/80">{t("Visual:", "بصری:")}</span>{" "}
                        {v.visualDirection || "—"}
                      </p>
                      <p>
                        <span className="text-foreground/80">{t("Cover:", "کاور:")}</span>{" "}
                        {v.suggestedCover || "—"}
                      </p>
                      <p className="sm:col-span-2">
                        {t("Hashtags:", "هشتگ‌ها:")} {v.hashtags.join(" ") || "—"}
                      </p>
                      <p className="sm:col-span-2">
                        {t("Keywords:", "کلیدواژه‌ها:")} {v.keywords.join(", ") || "—"}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            [v.hook, v.body, v.cta].filter(Boolean).join("\n\n"),
                          ).then(() => toast.success(t("Copied", "کپی شد")))
                        }
                      >
                        <Copy className="size-3.5" />
                        {t("Copy", "کپی")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void fetch(
                            `/api/creator?${qs}&view=export&contentId=${content.id}&variationId=${v.id}`,
                          )
                            .then((r) => r.json())
                            .then((d) =>
                              download(
                                `${v.title || "content"}.md`,
                                d.markdown,
                                "text/markdown",
                              ),
                            )
                        }
                      >
                        <FileDown className="size-3.5" />
                        MD
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void fetch(
                            `/api/creator?${qs}&view=export&contentId=${content.id}&variationId=${v.id}`,
                          )
                            .then((r) => r.json())
                            .then((d) => {
                              const w = window.open("", "_blank");
                              if (!w) return;
                              w.document.write(
                                `<html><head><title>${d.title}</title><style>body{font-family:Georgia,serif;padding:40px;line-height:1.6;max-width:720px;margin:auto;white-space:pre-wrap}</style></head><body>${String(
                                  d.markdown,
                                )
                                  .replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;")}<script>window.print()<\\/script></body></html>`,
                              );
                              w.document.close();
                            })
                        }
                      >
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void fetch(
                            `/api/creator?${qs}&view=export&contentId=${content.id}&variationId=${v.id}`,
                          )
                            .then((r) => r.json())
                            .then((d) =>
                              download(
                                `${v.title || "content"}.docx`,
                                d.docxText,
                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                              ),
                            )
                        }
                      >
                        DOCX
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void post({
                            intent: "favorite_variation",
                            variationId: v.id,
                            favorited: v.status !== "FAVORITED",
                          }).then(() => openContent(content.id))
                        }
                      >
                        <Star
                          className={cn(
                            "size-3.5",
                            v.status === "FAVORITED" && "fill-current text-teal-400",
                          )}
                        />
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void post({
                            intent: "push_studio",
                            contentId: content.id,
                            variationId: v.id,
                          }).then(() => {
                            toast.success(t("Pushed to Content Studio", "به استودیو محتوا ارسال شد"));
                            return openContent(content.id);
                          })
                        }
                      >
                        <Send className="size-3.5" />
                        {t("Studio", "استودیو")}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        {/* RIGHT */}
        <aside className="hidden min-h-0 flex-col border-l border-white/6 lg:flex">
          <div className="border-b border-white/6 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("Score & visuals", "امتیاز و بصری‌ها")}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            {primary?.score ? <ScoreBars score={primary.score} /> : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "Generate to see brand consistency, CTA strength, and platform fit.",
                  "برای دیدن سازگاری برند، قدرت دعوت به اقدام و تناسب پلتفرم، تولید کنید.",
                )}
              </p>
            )}

            {content?.qualityFlags?.length ? (
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Quality control", "کنترل کیفیت")}
                </Label>
                {content.qualityFlags.map((f, i) => (
                  <p
                    key={i}
                    className="rounded-lg border border-white/8 px-2 py-1.5 text-xs text-muted-foreground"
                  >
                    {f.message}
                  </p>
                ))}
              </div>
            ) : null}

            {primary?.visuals?.length ? (
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Visual suggestions", "پیشنهادهای بصری")}
                </Label>
                {primary.visuals.map((vis) => (
                  <div
                    key={vis.id}
                    className="rounded-lg border border-white/8 px-2 py-1.5 text-xs"
                  >
                    <p className="font-medium">
                      {vis.kind}: {vis.title}
                    </p>
                    <p className="text-muted-foreground">{vis.detail}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {primary ? (
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Rewrite", "بازنویسی")}
                </Label>
                <div className="flex flex-wrap gap-1">
                  {REWRITE_STYLES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void post({
                          intent: "rewrite",
                          contentId: content!.id,
                          variationId: primary.id,
                          style: s.key,
                          language: locale,
                        }).then((d) => {
                          toast.success(
                            t(`Rewritten: ${s.label}`, `بازنویسی شد: ${s.label}`),
                          );
                          setContent(d.content);
                          setSelectedIds(
                            d.content.variations?.[0]
                              ? [d.content.variations[0].id]
                              : [],
                          );
                          return loadBootstrap();
                        })
                      }
                      className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-muted-foreground hover:border-teal-500/40 hover:text-foreground disabled:opacity-50"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {content?.versions?.length ? (
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Version history", "تاریخچه نسخه‌ها")}
                </Label>
                {content.versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/4"
                    onClick={() =>
                      void post({
                        intent: "restore",
                        contentId: v.id,
                      }).then((d) => {
                        toast.success(t("Version restored", "نسخه بازیابی شد"));
                        setContent(d.content);
                        return loadBootstrap();
                      })
                    }
                  >
                    <span>
                      v{v.version}
                      {v.rewriteStyle ? ` · ${v.rewriteStyle}` : ""}
                    </span>
                    <Check className="size-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
