"use client";

import { usePageCopy } from "@/i18n/use-page-copy";
import { useI18n } from "@/i18n/client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Bookmark,
  CalendarRange,
  Loader2,
  Radar,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  PLANNING_MODES,
  SCORE_KEYS,
} from "@/lib/opportunities";

type Score = {
  relevance: number;
  urgency: number;
  expectedReach: number;
  salesPotential: number;
  engagementPotential: number;
  difficulty: number;
  confidence: number;
  overall: number;
  explanation: string;
};

type Opportunity = {
  id: string;
  title: string;
  summary: string;
  matchReason: string;
  eventDate: string;
  status: string;
  planningMode: string;
  impactTier: string;
  constraints: Record<string, unknown> | null;
  event: {
    name: string;
    source: string;
    tags: string[];
    category: { key: string; name: string } | null;
  };
  score: Score | null;
  recommendations: Array<{ id: string; kind: string; title: string; detail: string }>;
  alerts: Array<{ id: string; offset: string; notifyAt: string; sentAt: string | null }>;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

type TabKey = "upcoming" | "high" | "industry" | "seasonal" | "missed";

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const SCORE_KEY_LABELS_FA: Record<string, string> = {
  relevance: "ارتباط",
  urgency: "فوریت",
  expectedReach: "دسترسی مورد انتظار",
  salesPotential: "پتانسیل فروش",
  engagementPotential: "پتانسیل تعامل",
  difficulty: "دشواری",
  confidence: "اطمینان",
};

function ScoreGrid({ score }: { score: Score }) {
  const { locale } = useI18n();
  const t = (en: string, fa: string) => (locale === "fa" ? fa : en);
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <p className="text-sm font-medium">{t("Opportunity score", "امتیاز فرصت")}</p>
        <p className="text-2xl tracking-tight">
          {Math.round(score.overall)}
        </p>
      </div>
      {SCORE_KEYS.map((k) => {
        const value = score[k.key as keyof Score] as number;
        return (
          <div key={k.key}>
            <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
              <span>{t(k.label, SCORE_KEY_LABELS_FA[k.key] ?? k.label)}</span>
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
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {score.explanation}
      </p>
    </div>
  );
}

const PLANNING_MODE_LABELS_FA: Record<string, string> = {
  AUTO: "استراتژی خودکار",
  GUIDED: "استراتژی هدایت‌شده",
  MANUAL: "استراتژی دستی",
};

const PLANNING_MODE_DESCRIPTIONS_FA: Record<string, string> = {
  AUTO: "هوش مصنوعی بهترین ترکیب و برنامه زمانی را انتخاب می‌کند.",
  GUIDED: "شما محدودیت‌ها را تعیین می‌کنید؛ هوش مصنوعی در چارچوب آن بهترین برنامه را می‌سازد.",
  MANUAL: "شما نیازمندی‌های دقیق را تعیین می‌کنید؛ هوش مصنوعی فقط کیفیت را بهینه می‌کند.",
};

export function OpportunitiesWorkspace({ workspaceSlug, brandSlug }: Props) {
  const page = usePageCopy("opportunities");
  const { locale } = useI18n();
  const t = (en: string, fa: string) => (locale === "fa" ? fa : en);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [planningMode, setPlanningMode] = useState<"AUTO" | "GUIDED" | "MANUAL">(
    "AUTO",
  );
  const [reels, setReels] = useState(3);
  const [carousels, setCarousels] = useState(2);
  const [stories, setStories] = useState(4);
  const [upcoming, setUpcoming] = useState<Opportunity[]>([]);
  const [missed, setMissed] = useState<Opportunity[]>([]);
  const [highImpact, setHighImpact] = useState<Opportunity[]>([]);
  const [industry, setIndustry] = useState<Opportunity[]>([]);
  const [seasonal, setSeasonal] = useState<Opportunity[]>([]);
  const [pendingAlerts, setPendingAlerts] = useState<
    Array<{
      id: string;
      offset: string;
      notifyAt: string;
      opportunity: { id: string; title: string; eventDate: string };
    }>
  >([]);
  const [counts, setCounts] = useState({
    upcoming: 0,
    missed: 0,
    highImpact: 0,
    saved: 0,
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const applyDashboard = (data: Record<string, unknown>) => {
    setUpcoming((data.upcoming as Opportunity[]) || []);
    setMissed((data.missed as Opportunity[]) || []);
    setHighImpact((data.highImpact as Opportunity[]) || []);
    setIndustry((data.industry as Opportunity[]) || []);
    setSeasonal((data.seasonal as Opportunity[]) || []);
    setPendingAlerts((data.pendingAlerts as typeof pendingAlerts) || []);
    setCounts(
      (data.counts as typeof counts) || {
        upcoming: 0,
        missed: 0,
        highImpact: 0,
        saved: 0,
      },
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/opportunities?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      applyDashboard(data);
      if (!activeId && data.upcoming?.[0]?.id) setActiveId(data.upcoming[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Unable to load", "بارگذاری ممکن نشد"));
    } finally {
      setLoading(false);
    }
  }, [qs, activeId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const discover = async () => {
    setBusy(true);
    try {
      const constraints =
        planningMode === "AUTO"
          ? undefined
          : planningMode === "GUIDED"
            ? { reels, carousels, stories, publishingDays: ["Mon", "Wed", "Fri"] }
            : { lockedMix: true, reels, carousels, stories };
      const data = await post({
        intent: "discover",
        planningMode,
        constraints,
        language: locale,
      });
      applyDashboard(data.dashboard);
      toast.success(
        t(
          "Opportunities refreshed from business context",
          "فرصت‌ها بر اساس زمینه کسب‌وکار به‌روزرسانی شدند",
        ),
      );
      const first = data.dashboard?.upcoming?.[0]?.id;
      if (first) setActiveId(first);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Discover failed", "اسکن ناموفق بود"));
    } finally {
      setBusy(false);
    }
  };

  const list: Opportunity[] =
    tab === "upcoming"
      ? upcoming
      : tab === "high"
        ? highImpact
        : tab === "industry"
          ? industry
          : tab === "seasonal"
            ? seasonal
            : missed;

  const active =
    [...upcoming, ...missed, ...highImpact, ...industry, ...seasonal].find(
      (o) => o.id === activeId,
    ) || null;

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="hidden h-full rounded-2xl lg:block" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/8 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.08),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
            <Radar className="size-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">{page.title}</h1>
            <p className="text-xs text-muted-foreground">
              {t(
                "Always-on matching of world moments to your business — not a holiday dump",
                "تطبیق همیشه‌فعال لحظات جهانی با کسب‌وکار شما — نه یک لیست خام مناسبت‌ها",
              )}
            </p>
          </div>
        </div>
        <Button size="sm" disabled={busy} onClick={() => void discover()}>
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {t("Scan opportunities", "اسکن فرصت‌ها")}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        {/* LEFT */}
        <aside className="hidden min-h-0 flex-col border-r border-white/6 lg:flex">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                [t("Upcoming", "پیش‌رو"), counts.upcoming],
                [t("High impact", "تأثیر بالا"), counts.highImpact],
                [t("Saved", "ذخیره‌شده"), counts.saved],
                [t("Missed", "ازدست‌رفته"), counts.missed],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-xl border border-white/8 bg-black/20 px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-xl tracking-tight">{value as number}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("Planning mode", "حالت برنامه‌ریزی")}
              </p>
              {PLANNING_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() =>
                    setPlanningMode(m.key as "AUTO" | "GUIDED" | "MANUAL")
                  }
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left",
                    planningMode === m.key
                      ? "border-teal-500/40 bg-teal-500/10"
                      : "border-white/8 hover:bg-white/4",
                  )}
                >
                  <p className="text-sm font-medium">
                    {t(m.label, PLANNING_MODE_LABELS_FA[m.key] ?? m.label)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t(m.description, PLANNING_MODE_DESCRIPTIONS_FA[m.key] ?? m.description)}
                  </p>
                </button>
              ))}
            </div>

            {planningMode !== "AUTO" ? (
              <div className="space-y-2 rounded-xl border border-white/8 p-3">
                <Label className="text-xs">{t("Constraints", "محدودیت‌ها")}</Label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="space-y-1">
                    <span className="text-muted-foreground">{t("Reels", "ریل‌ها")}</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={reels}
                      onChange={(e) => setReels(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">{t("Carousels", "کاروسل‌ها")}</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={carousels}
                      onChange={(e) => setCarousels(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">{t("Stories", "استوری‌ها")}</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={stories}
                      onChange={(e) => setStories(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {pendingAlerts.length ? (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <Bell className="size-3" />
                  {t("Proactive alerts", "هشدارهای پیش‌دستانه")}
                </p>
                {pendingAlerts.slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setActiveId(a.opportunity.id)}
                    className="w-full rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-left text-xs"
                  >
                    <p className="font-medium">{a.opportunity.title}</p>
                    <p className="text-muted-foreground">
                      {a.offset.replaceAll("_", " ")} · {dayLabel(a.notifyAt)}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        {/* CENTER */}
        <section className="flex min-h-0 flex-col">
          <div className="flex gap-1 overflow-x-auto border-b border-white/6 px-3 py-2">
            {(
              [
                ["upcoming", t("Upcoming", "پیش‌رو")],
                ["high", t("High impact", "تأثیر بالا")],
                ["industry", t("Industry", "صنعت")],
                ["seasonal", t("Seasonal", "فصلی")],
                ["missed", t("Missed", "ازدست‌رفته")],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs",
                  tab === key
                    ? "bg-white/8 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {!list.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <CalendarRange className="size-8 text-muted-foreground" />
                <div>
                  <h2 className="text-2xl tracking-tight">
                    {t("No opportunities yet", "هنوز فرصتی نیست")}
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {t(
                      "Scan to match curated world moments against Business Brain, audience, goals and campaign history.",
                      "برای تطبیق لحظات جهانی منتخب با مغز کسب‌وکار، مخاطب، اهداف و تاریخچه کمپین اسکن کنید.",
                    )}
                  </p>
                </div>
                <Button disabled={busy} onClick={() => void discover()}>
                  <Sparkles className="size-3.5" />
                  {t("Run first scan", "اجرای اولین اسکن")}
                </Button>
              </div>
            ) : (
              list.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setActiveId(o.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    activeId === o.id
                      ? "border-teal-500/40 bg-teal-500/10"
                      : "border-white/8 bg-black/15 hover:bg-white/[0.03]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="rounded-md text-[10px]">
                          {o.event.source.replaceAll("_", " ")}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "rounded-md text-[10px]",
                            o.impactTier === "high" && "bg-teal-500/20",
                          )}
                        >
                          {o.impactTier}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {dayLabel(o.eventDate)}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium">{o.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {o.matchReason}
                      </p>
                    </div>
                    <p className="text-xl tracking-tight">
                      {Math.round(o.score?.overall || 0)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* RIGHT */}
        <aside className="hidden min-h-0 flex-col border-l border-white/6 lg:flex">
          <div className="border-b border-white/6 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("Opportunity detail", "جزئیات فرصت")}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            {!active ? (
              <p className="text-xs text-muted-foreground">
                {t(
                  "Select an opportunity to see why it matches and take action.",
                  "یک فرصت را انتخاب کنید تا دلیل تطابق را ببینید و اقدام کنید.",
                )}
              </p>
            ) : (
              <>
                <div>
                  <h2 className="text-xl tracking-tight">{active.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {active.event.name} · {dayLabel(active.eventDate)}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/85">
                    {active.summary}
                  </p>
                  <p className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      {t("Why this fits:", "چرا این مناسب است:")}{" "}
                    </span>
                    {active.matchReason}
                  </p>
                </div>

                {active.score ? <ScoreGrid score={active.score} /> : null}

                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t("AI recommendations", "پیشنهادهای هوش مصنوعی")}
                  </p>
                  {active.recommendations.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border border-white/8 px-2.5 py-2 text-xs"
                    >
                      <p className="font-medium">
                        <span className="text-muted-foreground">
                          {r.kind.replaceAll("_", " ")} ·{" "}
                        </span>
                        {r.title}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">{r.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t("Quick actions", "اقدامات سریع")}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ["create_campaign", t("Create Campaign", "ساخت کمپین")],
                        ["generate_content_plan", t("Content Plan", "برنامه محتوا")],
                        ["generate_brief", t("Generate Brief", "تولید بریف")],
                        ["create_offer", t("Create Offer", "ساخت پیشنهاد")],
                        ["schedule_content", t("Schedule Content", "زمان‌بندی محتوا")],
                      ] as const
                    ).map(([action, label]) => (
                      <Button
                        key={action}
                        size="sm"
                        variant="secondary"
                        className="justify-start"
                        disabled={busy}
                        onClick={() =>
                          void post({
                            intent: "action",
                            opportunityId: active.id,
                            action,
                          }).then((d) => {
                            toast.success(t(`${label} ready`, `${label} آماده است`));
                            if (d.result?.href) router.push(d.result.href);
                            return load();
                          })
                        }
                      >
                        {label}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void post({
                          intent: "update",
                          opportunityId: active.id,
                          status: "SAVED",
                        }).then(() => {
                          toast.success(t("Saved for later", "برای بعد ذخیره شد"));
                          return load();
                        })
                      }
                    >
                      <Bookmark className="size-3.5" />
                      {t("Save", "ذخیره")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void post({
                          intent: "feedback",
                          opportunityId: active.id,
                          action: "DISMISSED",
                        }).then(() => {
                          toast.success(
                            t("Dismissed — learning updated", "رد شد — یادگیری به‌روزرسانی شد"),
                          );
                          return load();
                        })
                      }
                    >
                      <X className="size-3.5" />
                      {t("Dismiss", "رد کردن")}
                    </Button>
                  </div>
                </div>

                {active.alerts?.length ? (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t("Alert schedule", "زمان‌بندی هشدار")}
                    </p>
                    {active.alerts.map((a) => (
                      <p key={a.id} className="text-[11px] text-muted-foreground">
                        {a.offset.replaceAll("_", " ")} · {dayLabel(a.notifyAt)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
