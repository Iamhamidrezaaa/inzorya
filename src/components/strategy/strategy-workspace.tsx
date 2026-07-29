"use client";

import { usePageCopy } from "@/i18n/use-page-copy";
import { useI18n } from "@/i18n/client";
import { faLabel } from "@/i18n/display-labels";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CONTENT_TYPE_OPTIONS,
  MARKETING_GOAL_OPTIONS,
  PLATFORM_OPTIONS,
  ROADMAP_STAGES,
  moveItem,
  toggleInList,
} from "@/lib/strategy";

type Persona = {
  id: string;
  name: string;
  age: string;
  gender: string;
  location: string;
  interests: string;
  painPoints: string;
  buyingMotivation: string;
  objections: string;
  goals: string;
};

type Competitor = {
  id: string;
  name: string;
  website: string;
  instagram: string;
  notes: string;
};

type Pillar = {
  id: string;
  name: string;
  description: string;
};

type RoadmapTask = {
  id: string;
  title: string;
  done: boolean;
};

type Overview = {
  industry: string;
  targetAudience: string;
  businessGoals: string;
  mainProducts: string;
  brandPersonality: string;
  preferredTone: string;
  languages: string;
};

function uid() {
  return crypto.randomUUID();
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[15px] font-medium tracking-tight">{title}</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChipToggle({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-[background-color,border-color,color] duration-150",
        selected
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border/80 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
      {label}
    </button>
  );
}

const GOAL_FA: Record<string, string> = {
  "Increase Sales": "افزایش فروش",
  "Generate Leads": "جذب سرنخ",
  "Grow Followers": "افزایش دنبال‌کننده",
  "Increase Engagement": "افزایش تعامل",
  "Brand Awareness": "آگاهی از برند",
  "Customer Support": "پشتیبانی مشتری",
  "Launch Product": "عرضه محصول",
  "Website Traffic": "ترافیک وب‌سایت",
  "Local Customers": "مشتریان محلی",
  Recruitment: "استخدام",
};

const PILLAR_FA: Record<string, string> = {
  Education: "آموزش",
  "Behind the Scenes": "پشت صحنه",
  Testimonials: "نظرات مشتریان",
  Entertainment: "سرگرمی",
  FAQ: "پرسش‌های پرتکرار",
  Offers: "پیشنهادها",
  Culture: "فرهنگ",
  "Teach your audience something useful.": "چیزی مفید به مخاطب خود آموزش دهید.",
  "Show how the work happens.": "نشان دهید کار چگونه انجام می‌شود.",
  "Social proof and customer stories.": "اثبات اجتماعی و داستان‌های مشتریان.",
  "Light, shareable moments.": "لحظه‌های سبک و قابل اشتراک‌گذاری.",
  "Answer common questions.": "به سوالات رایج پاسخ دهید.",
  "Promotions and calls to action.": "پروموشن‌ها و دعوت به اقدام.",
  "Team, values, and brand personality.": "تیم، ارزش‌ها و شخصیت برند.",
};

const ROADMAP_FA: Record<string, { label: string; hint: string }> = {
  understand: {
    label: "شناخت کسب‌وکار",
    hint: "نمای کلی کسب‌وکار و لحن برند را کامل کنید.",
  },
  goals: {
    label: "تعیین اهداف بازاریابی",
    hint: "مشخص کنید موفقیت چه شکلی است.",
  },
  audience: {
    label: "تعریف مخاطب",
    hint: "پرسوناها و نقاط درد را بسازید.",
  },
  competitors: {
    label: "نقشه رقبا",
    hint: "بدانید چه کسانی توجه بازار را گرفته‌اند.",
  },
  pillars: {
    label: "شکل‌دهی ستون‌های محتوا",
    hint: "تصمیم بگیرید درباره چه چیزهایی صحبت می‌کنید.",
  },
  preferences: {
    label: "تنظیم ترجیحات",
    hint: "ریتم، فرمت‌ها و لحن را مشخص کنید.",
  },
  ready: {
    label: "آماده برنامه‌ریزی",
    hint: "استراتژی برای هوش مصنوعی آینده ساختاربندی شده است.",
  },
};

const ROADMAP_TASK_FA: Record<string, string> = {
  "Complete business overview": "تکمیل نمای کلی کسب‌وکار",
  "Finish business overview": "تکمیل نمای کلی کسب‌وکار",
  "Select marketing goals": "انتخاب اهداف بازاریابی",
  "Add at least one persona": "افزودن حداقل یک پرسونا",
  "Review content pillars": "بازبینی ستون‌های محتوا",
};

export function StrategyWorkspace({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const page = usePageCopy("strategy");
  const { locale } = useI18n();
  const t = useCallback(
    (en: string, fa: string) => (locale === "fa" ? fa : en),
    [locale],
  );
  const goalLabel = useCallback(
    (label: string) => faLabel(locale, label, GOAL_FA),
    [locale],
  );
  const pillarLabel = useCallback(
    (label: string) => faLabel(locale, label, PILLAR_FA),
    [locale],
  );
  const roadmapText = useCallback(
    (stage: (typeof ROADMAP_STAGES)[number]) =>
      locale === "fa"
        ? (ROADMAP_FA[stage.id as keyof typeof ROADMAP_FA] ?? {
            label: stage.label,
            hint: stage.hint,
          })
        : { label: stage.label, hint: stage.hint },
    [locale],
  );
  const roadmapTaskLabel = useCallback(
    (label: string) => faLabel(locale, label, ROADMAP_TASK_FA),
    [locale],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completion, setCompletion] = useState(0);
  const [channels, setChannels] = useState<
    { platform: string; name: string; handle: string | null }[]
  >([]);
  const [overview, setOverview] = useState<Overview>({
    industry: "",
    targetAudience: "",
    businessGoals: "",
    mainProducts: "",
    brandPersonality: "",
    preferredTone: "",
    languages: "",
  });
  const [goals, setGoals] = useState<string[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [prefs, setPrefs] = useState({
    postingFrequency: "",
    preferredPlatforms: [] as string[],
    contentTypes: [] as string[],
    tone: "",
    contentLength: "",
    ctaStyle: "",
  });
  const [currentStage, setCurrentStage] = useState("understand");
  const [nextStep, setNextStep] = useState("");
  const [tasks, setTasks] = useState<RoadmapTask[]>([]);
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ workspaceSlug, brandSlug });
    const res = await fetch(`/api/strategy?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(t("Could not load strategy.", "بارگذاری استراتژی ممکن نشد."));
      return;
    }
    const data = await res.json();
    const s = data.strategy;
    const p = data.profile;
    setCompletion(data.completion ?? 0);
    setChannels(data.connectedChannels ?? []);
    setOverview({
      industry: p?.industry ?? data.brand?.industry ?? "",
      targetAudience: p?.targetAudience ?? "",
      businessGoals: p?.businessGoals ?? "",
      mainProducts: p?.mainProducts ?? "",
      brandPersonality: p?.brandPersonality ?? "",
      preferredTone: p?.preferredTone ?? data.brand?.brandVoice ?? "",
      languages: (p?.languages ?? []).join(", "),
    });
    setGoals(s.goals ?? []);
    setPersonas(
      (s.personas ?? []).map(
        (x: {
          id: string;
          name: string;
          age: string | null;
          gender: string | null;
          location: string | null;
          interests: string | null;
          painPoints: string | null;
          buyingMotivation: string | null;
          objections: string | null;
          goals: string | null;
        }) => ({
          id: x.id,
          name: x.name,
          age: x.age ?? "",
          gender: x.gender ?? "",
          location: x.location ?? "",
          interests: x.interests ?? "",
          painPoints: x.painPoints ?? "",
          buyingMotivation: x.buyingMotivation ?? "",
          objections: x.objections ?? "",
          goals: x.goals ?? "",
        }),
      ),
    );
    setCompetitors(
      (s.competitors ?? []).map(
        (x: {
          id: string;
          name: string;
          website: string | null;
          instagram: string | null;
          notes: string | null;
        }) => ({
          id: x.id,
          name: x.name,
          website: x.website ?? "",
          instagram: x.instagram ?? "",
          notes: x.notes ?? "",
        }),
      ),
    );
    setPillars(
      (s.pillars ?? []).map(
        (x: { id: string; name: string; description: string | null }) => ({
          id: x.id,
          name: x.name,
          description: x.description ?? "",
        }),
      ),
    );
    setPrefs({
      postingFrequency: s.postingFrequency ?? "",
      preferredPlatforms: s.preferredPlatforms ?? [],
      contentTypes: s.contentTypes ?? [],
      tone: s.tone ?? "",
      contentLength: s.contentLength ?? "",
      ctaStyle: s.ctaStyle ?? "",
    });
    setCurrentStage(s.currentStage ?? "understand");
    setNextStep(s.nextStep ?? "");
    setTasks(
      (s.roadmapTasks ?? []).map(
        (t: { id: string; title: string; done: boolean }) => ({
          id: t.id,
          title: t.title,
          done: t.done,
        }),
      ),
    );
  }, [workspaceSlug, brandSlug, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(payload: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch("/api/strategy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(t("Could not save.", "ذخیره ممکن نشد."));
      return false;
    }
    const data = await res.json();
    if (typeof data.completion === "number") setCompletion(data.completion);
    toast.success(t("Saved", "ذخیره شد"));
    return true;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div dir={locale === "fa" ? "rtl" : "ltr"} className="space-y-6">
      <PageHeader
        title={page.title}
        description={page.description}
        actions={
          <Badge variant="muted" className="tabular-nums">
            {saving
              ? t("Saving…", "در حال ذخیره…")
              : t(
                  `${completion}% business complete`,
                  `${completion}% کسب‌وکار کامل شده`,
                )}
          </Badge>
        }
      />

      {/* 1 — Business Overview */}
      <Section
        title={t("Business overview", "نمای کلی کسب‌وکار")}
        description={t(
          "Core facts Inzorya will use for every future plan.",
          "حقایق اصلی که اینزوریا برای هر برنامه آینده استفاده می‌کند.",
        )}
        action={
          <Button
            size="sm"
            disabled={saving}
            onClick={() =>
              void save({
                overview: {
                  industry: overview.industry || null,
                  targetAudience: overview.targetAudience || null,
                  businessGoals: overview.businessGoals || null,
                  mainProducts: overview.mainProducts || null,
                  brandPersonality: overview.brandPersonality || null,
                  preferredTone: overview.preferredTone || null,
                  languages: overview.languages
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                },
              })
            }
          >
            {t("Save overview", "ذخیره نمای کلی")}
          </Button>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {t("Completion", "میزان تکمیل")}
            </span>
            <span className="font-medium tabular-nums">{completion}%</span>
          </div>
          {channels.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              {t("No channels connected yet", "هنوز کانالی وصل نشده است")}
            </span>
          ) : (
            channels.map((c) => (
              <Badge key={c.platform} variant="secondary">
                {c.name}
                {c.handle ? ` · ${c.handle}` : ""}
              </Badge>
            ))
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["industry", t("Industry", "صنعت")],
              ["preferredTone", t("Brand voice / tone", "لحن / صدای برند")],
              [
                "languages",
                t("Languages (comma separated)", "زبان‌ها (با کاما جدا شود)"),
              ],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Input
                value={overview[key]}
                onChange={(e) =>
                  setOverview((o) => ({ ...o, [key]: e.target.value }))
                }
              />
            </div>
          ))}
          {(
            [
              ["targetAudience", t("Audience", "مخاطب")],
              ["businessGoals", t("Goals", "اهداف")],
              [
                "mainProducts",
                t("Products / services", "محصولات / خدمات"),
              ],
              [
                "brandPersonality",
                t("Brand personality", "شخصیت برند"),
              ],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2 md:col-span-2">
              <Label>{label}</Label>
              <Textarea
                rows={3}
                value={overview[key]}
                onChange={(e) =>
                  setOverview((o) => ({ ...o, [key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </Section>

      {/* 2 — Marketing Goals */}
      <Section
        title={t("Marketing goals", "اهداف بازاریابی")}
        description={t(
          "Choose what success looks like. Multiple goals are fine.",
          "تعریف کنید موفقیت چه شکلی است. انتخاب چند هدف اشکالی ندارد.",
        )}
        action={
          <Button
            size="sm"
            disabled={saving}
            onClick={() => void save({ goals })}
          >
            {t("Save goals", "ذخیره اهداف")}
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {MARKETING_GOAL_OPTIONS.map((g) => (
            <ChipToggle
              key={g.key}
              label={goalLabel(g.label)}
              selected={goals.includes(g.key)}
              onClick={() => setGoals((prev) => toggleInList(prev, g.key))}
            />
          ))}
        </div>
      </Section>

      {/* 3 — Target Audience */}
      <Section
        title={t("Target audience", "مخاطب هدف")}
        description={t(
          "Structured personas — not a freeform blob.",
          "پرسوناهای ساخت‌یافته — نه یک متن آزاد.",
        )}
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const id = uid();
                setPersonas((p) => [
                  ...p,
                  {
                    id,
                    name: t("New persona", "پرسونای جدید"),
                    age: "",
                    gender: "",
                    location: "",
                    interests: "",
                    painPoints: "",
                    buyingMotivation: "",
                    objections: "",
                    goals: "",
                  },
                ]);
                setExpandedPersona(id);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("Add persona", "افزودن پرسونا")}
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={() =>
                void save({
                  personas: personas.map((p, i) => ({
                    ...p,
                    age: p.age || null,
                    gender: p.gender || null,
                    location: p.location || null,
                    interests: p.interests || null,
                    painPoints: p.painPoints || null,
                    buyingMotivation: p.buyingMotivation || null,
                    objections: p.objections || null,
                    goals: p.goals || null,
                    sortOrder: i,
                  })),
                })
              }
            >
              {t("Save personas", "ذخیره پرسوناها")}
            </Button>
          </div>
        }
      >
        {personas.length === 0 ? (
          <EmptyState
            className="min-h-0 py-12"
            title={t("No personas yet", "هنوز پرسونایی نیست")}
            description={t(
              "Add who you sell to — age, pains, motivations, objections.",
              "مشتری‌تان را تعریف کنید — سن، دغدغه‌ها، انگیزه‌ها، اعتراض‌ها.",
            )}
            actionLabel={t("Add persona", "افزودن پرسونا")}
            onAction={() => {
              const id = uid();
              setPersonas([
                {
                  id,
                  name: t("Primary buyer", "خریدار اصلی"),
                  age: "",
                  gender: "",
                  location: "",
                  interests: "",
                  painPoints: "",
                  buyingMotivation: "",
                  objections: "",
                  goals: "",
                },
              ]);
              setExpandedPersona(id);
            }}
          />
        ) : (
          <div className="space-y-3">
            {personas.map((persona, index) => {
              const open = expandedPersona === persona.id;
              return (
                <div
                  key={persona.id}
                  className="rounded-xl border border-border/70 bg-background/40"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    onClick={() =>
                      setExpandedPersona(open ? null : persona.id)
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {persona.name || t("Untitled persona", "پرسونای بدون عنوان")}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[persona.age, persona.location, persona.gender]
                          .filter(Boolean)
                          .join(" · ") || t("Fill in details", "جزئیات را تکمیل کنید")}
                      </div>
                    </div>
                    {open ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {open ? (
                    <div className="space-y-4 border-t border-border/60 px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            ["name", t("Persona name", "نام پرسونا")],
                            ["age", t("Age", "سن")],
                            ["gender", t("Gender", "جنسیت")],
                            ["location", t("Location", "موقعیت مکانی")],
                          ] as const
                        ).map(([key, label]) => (
                          <div key={key} className="space-y-1.5">
                            <Label>{label}</Label>
                            <Input
                              value={persona[key]}
                              onChange={(e) =>
                                setPersonas((list) =>
                                  list.map((p) =>
                                    p.id === persona.id
                                      ? { ...p, [key]: e.target.value }
                                      : p,
                                  ),
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                      {(
                        [
                          ["interests", t("Interests", "علایق")],
                          ["painPoints", t("Pain points", "دغدغه‌ها")],
                          [
                            "buyingMotivation",
                            t("Buying motivation", "انگیزه خرید"),
                          ],
                          ["objections", t("Objections", "اعتراض‌ها")],
                          ["goals", t("Goals", "اهداف")],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="space-y-1.5">
                          <Label>{label}</Label>
                          <Textarea
                            rows={2}
                            value={persona[key]}
                            onChange={(e) =>
                              setPersonas((list) =>
                                list.map((p) =>
                                  p.id === persona.id
                                    ? { ...p, [key]: e.target.value }
                                    : p,
                                ),
                              )
                            }
                          />
                        </div>
                      ))}
                      <div className="flex justify-between">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={index === 0}
                            onClick={() =>
                              setPersonas((list) =>
                                moveItem(list, index, index - 1),
                              )
                            }
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={index === personas.length - 1}
                            onClick={() =>
                              setPersonas((list) =>
                                moveItem(list, index, index + 1),
                              )
                            }
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() =>
                            setPersonas((list) =>
                              list.filter((p) => p.id !== persona.id),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("Remove", "حذف")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* 4 — Competitors */}
      <Section
        title={t("Competitors", "رقبا")}
        description={t(
          "Who else is competing for attention.",
          "چه کسان دیگری برای جلب توجه رقابت می‌کنند.",
        )}
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setCompetitors((c) => [
                  ...c,
                  {
                    id: uid(),
                    name: "",
                    website: "",
                    instagram: "",
                    notes: "",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              {t("Add", "افزودن")}
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={() =>
                void save({
                  competitors: competitors
                    .filter((c) => c.name.trim())
                    .map((c, i) => ({
                      name: c.name,
                      website: c.website || null,
                      instagram: c.instagram || null,
                      notes: c.notes || null,
                      sortOrder: i,
                    })),
                })
              }
            >
              {t("Save competitors", "ذخیره رقبا")}
            </Button>
          </div>
        }
      >
        {competitors.length === 0 ? (
          <EmptyState
            className="min-h-0 py-12"
            title={t("No competitors yet", "هنوز رقیبی نیست")}
            description={t(
              "Add names, sites, Instagram handles, and notes.",
              "نام‌ها، سایت‌ها، آیدی اینستاگرام و یادداشت‌ها را اضافه کنید.",
            )}
            actionLabel={t("Add competitor", "افزودن رقیب")}
            onAction={() =>
              setCompetitors([
                {
                  id: uid(),
                  name: "",
                  website: "",
                  instagram: "",
                  notes: "",
                },
              ])
            }
          />
        ) : (
          <div className="space-y-3">
            {competitors.map((comp) => (
              <div
                key={comp.id}
                className="grid gap-3 rounded-xl border border-border/70 bg-background/40 p-4 md:grid-cols-2"
              >
                <div className="space-y-1.5">
                  <Label>{t("Name", "نام")}</Label>
                  <Input
                    value={comp.name}
                    onChange={(e) =>
                      setCompetitors((list) =>
                        list.map((c) =>
                          c.id === comp.id
                            ? { ...c, name: e.target.value }
                            : c,
                        ),
                      )
                    }
                    placeholder={t("Competitor name", "نام رقیب")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("Website", "وب‌سایت")}</Label>
                  <Input
                    value={comp.website}
                    onChange={(e) =>
                      setCompetitors((list) =>
                        list.map((c) =>
                          c.id === comp.id
                            ? { ...c, website: e.target.value }
                            : c,
                        ),
                      )
                    }
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("Instagram", "اینستاگرام")}</Label>
                  <Input
                    value={comp.instagram}
                    onChange={(e) =>
                      setCompetitors((list) =>
                        list.map((c) =>
                          c.id === comp.id
                            ? { ...c, instagram: e.target.value }
                            : c,
                        ),
                      )
                    }
                    placeholder="@handle"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>{t("Notes", "یادداشت‌ها")}</Label>
                  <Textarea
                    rows={2}
                    value={comp.notes}
                    onChange={(e) =>
                      setCompetitors((list) =>
                        list.map((c) =>
                          c.id === comp.id
                            ? { ...c, notes: e.target.value }
                            : c,
                        ),
                      )
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      setCompetitors((list) =>
                        list.filter((c) => c.id !== comp.id),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("Remove", "حذف")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 5 — Content Pillars */}
      <Section
        title={t("Content pillars", "ستون‌های محتوا")}
        description={t(
          "Categories you'll talk about. Reorder to set priority.",
          "دسته‌هایی که درباره‌شان صحبت می‌کنید. برای اولویت‌بندی جابه‌جا کنید.",
        )}
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setPillars((p) => [
                  ...p,
                  {
                    id: uid(),
                    name: t("New pillar", "ستون جدید"),
                    description: "",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              {t("Add pillar", "افزودن ستون")}
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={() =>
                void save({
                  pillars: pillars.map((p, i) => ({
                    name: p.name,
                    description: p.description || null,
                    sortOrder: i,
                  })),
                })
              }
            >
              {t("Save pillars", "ذخیره ستون‌ها")}
            </Button>
          </div>
        }
      >
        {pillars.length === 0 ? (
          <EmptyState
            className="min-h-0 py-12"
            title={t("No pillars", "هنوز ستونی نیست")}
            description={t(
              "Add education, offers, culture — whatever shapes your content system.",
              "آموزش، پیشنهادها، فرهنگ — هرچه سیستم محتوایی شما را شکل می‌دهد اضافه کنید.",
            )}
            actionLabel={t("Add pillar", "افزودن ستون")}
            onAction={() =>
              setPillars([
                { id: uid(), name: t("Education", "آموزش"), description: "" },
              ])
            }
          />
        ) : (
          <ul className="space-y-2">
            {pillars.map((pillar, index) => (
              <li
                key={pillar.id}
                className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/40 p-4 sm:flex-row sm:items-start"
              >
                <div className="flex gap-1 sm:flex-col">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() =>
                      setPillars((list) => moveItem(list, index, index - 1))
                    }
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={index === pillars.length - 1}
                    onClick={() =>
                      setPillars((list) => moveItem(list, index, index + 1))
                    }
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("Name", "نام")}</Label>
                    <Input
                      value={pillarLabel(pillar.name)}
                      onChange={(e) =>
                        setPillars((list) =>
                          list.map((p) =>
                            p.id === pillar.id
                              ? { ...p, name: e.target.value }
                              : p,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("Description", "توضیحات")}</Label>
                    <Input
                      value={pillarLabel(pillar.description)}
                      onChange={(e) =>
                        setPillars((list) =>
                          list.map((p) =>
                            p.id === pillar.id
                              ? { ...p, description: e.target.value }
                              : p,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() =>
                    setPillars((list) =>
                      list.filter((p) => p.id !== pillar.id),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 6 — Content Preferences */}
      <Section
        title={t("Content preferences", "ترجیحات محتوا")}
        description={t(
          "Cadence, formats, and how you sound — still no generation.",
          "ریتم، فرمت‌ها و لحن شما — هنوز بدون تولید محتوا.",
        )}
        action={
          <Button
            size="sm"
            disabled={saving}
            onClick={() =>
              void save({
                preferences: {
                  postingFrequency: prefs.postingFrequency || null,
                  preferredPlatforms: prefs.preferredPlatforms,
                  contentTypes: prefs.contentTypes,
                  tone: prefs.tone || null,
                  contentLength: prefs.contentLength || null,
                  ctaStyle: prefs.ctaStyle || null,
                },
              })
            }
          >
            {t("Save preferences", "ذخیره ترجیحات")}
          </Button>
        }
      >
        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{t("Posting frequency", "فرکانس انتشار")}</Label>
              <Input
                value={prefs.postingFrequency}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, postingFrequency: e.target.value }))
                }
                placeholder={t("e.g. 4× / week", "مثلاً ۴× در هفته")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Tone", "لحن")}</Label>
              <Input
                value={prefs.tone}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, tone: e.target.value }))
                }
                placeholder={t("Warm, expert…", "گرم، متخصصانه…")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Length", "طول")}</Label>
              <Input
                value={prefs.contentLength}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, contentLength: e.target.value }))
                }
                placeholder={t("Short / medium", "کوتاه / متوسط")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("CTA style", "سبک فراخوان به اقدام")}</Label>
            <Input
              value={prefs.ctaStyle}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, ctaStyle: e.target.value }))
              }
              placeholder={t("Soft invite, direct ask…", "دعوت ملایم، درخواست مستقیم…")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("Preferred platforms", "پلتفرم‌های ترجیحی")}</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((platform) => (
                <ChipToggle
                  key={platform}
                  label={platform}
                  selected={prefs.preferredPlatforms.includes(platform)}
                  onClick={() =>
                    setPrefs((p) => ({
                      ...p,
                      preferredPlatforms: toggleInList(
                        p.preferredPlatforms,
                        platform,
                      ),
                    }))
                  }
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("Content types", "انواع محتوا")}</Label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPE_OPTIONS.map((ct) => (
                <ChipToggle
                  key={ct.key}
                  label={ct.label}
                  selected={prefs.contentTypes.includes(ct.key)}
                  onClick={() =>
                    setPrefs((p) => ({
                      ...p,
                      contentTypes: toggleInList(p.contentTypes, ct.key),
                    }))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* 7 — Roadmap */}
      <Section
        title={t("Roadmap", "نقشه راه")}
        description={t(
          "Where you are in the strategy workflow — not AI output.",
          "جایگاه شما در گردش‌کار استراتژی — نه خروجی هوش مصنوعی.",
        )}
        action={
          <Button
            size="sm"
            disabled={saving}
            onClick={() =>
              void save({
                roadmap: {
                  currentStage,
                  nextStep: nextStep || null,
                },
                roadmapTasks: tasks.map((t, i) => ({
                  title: t.title,
                  done: t.done,
                  sortOrder: i,
                })),
              })
            }
          >
            {t("Save roadmap", "ذخیره نقشه راه")}
          </Button>
        }
      >
        <ol className="relative space-y-0 border-l border-border/70 pl-6">
          {ROADMAP_STAGES.map((stage, index) => {
            const active = currentStage === stage.id;
            const stageText = roadmapText(stage);
            const stageIndex = ROADMAP_STAGES.findIndex(
              (s) => s.id === currentStage,
            );
            const past = index < stageIndex;
            return (
              <li key={stage.id} className="relative pb-8 last:pb-0">
                <span
                  className={cn(
                    "absolute -left-[1.55rem] top-1 flex h-4 w-4 items-center justify-center rounded-full border",
                    active
                      ? "border-primary bg-primary"
                      : past
                        ? "border-primary/50 bg-primary/30"
                        : "border-border bg-background",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setCurrentStage(stage.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left transition-colors",
                    active ? "bg-accent/50" : "hover:bg-muted/40",
                  )}
                >
                  <div className="text-sm font-medium tracking-tight">
                    {stageText.label}
                    {active ? (
                      <span className="ml-2 text-xs font-normal text-primary">
                        {t("Current", "فعلی")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {stageText.hint}
                  </p>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 space-y-2">
          <Label>{t("Next step", "قدم بعدی")}</Label>
          <Input
            value={roadmapTaskLabel(nextStep)}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder={t("What should happen next?", "چه اتفاقی باید بعد بیفتد؟")}
          />
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <Label>{t("Upcoming tasks", "کارهای پیش رو")}</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setTasks((prev) => [
                  ...prev,
                  { id: uid(), title: t("New task", "کار جدید"), done: false },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              {t("Add task", "افزودن کار")}
            </Button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "No tasks yet. Add the next few moves.",
                "هنوز کاری نیست. چند قدم بعدی را اضافه کنید.",
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-2"
                >
                  <button
                    type="button"
                    aria-label={
                      task.done
                        ? t("Mark undone", "علامت‌گذاری به‌عنوان انجام‌نشده")
                        : t("Mark done", "علامت‌گذاری به‌عنوان انجام‌شده")
                    }
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      task.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                    onClick={() =>
                      setTasks((list) =>
                        list.map((t) =>
                          t.id === task.id ? { ...t, done: !t.done } : t,
                        ),
                      )
                    }
                  >
                    {task.done ? <Check className="h-3 w-3" /> : null}
                  </button>
                  <Input
                    className={cn(
                      "h-8 border-0 bg-transparent shadow-none focus-visible:ring-0",
                      task.done && "text-muted-foreground line-through",
                    )}
                    value={roadmapTaskLabel(task.title)}
                    onChange={(e) =>
                      setTasks((list) =>
                        list.map((t) =>
                          t.id === task.id
                            ? { ...t, title: e.target.value }
                            : t,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground"
                    onClick={() =>
                      setTasks((list) =>
                        list.filter((t) => t.id !== task.id),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
}
