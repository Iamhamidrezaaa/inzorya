"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page";
import { useI18n } from "@/i18n/client";
import { localizeBrainCompletion } from "@/i18n/localize-brain";
import { usePageCopy } from "@/i18n/use-page-copy";
import { faLabel } from "@/i18n/display-labels";
import { cn } from "@/lib/utils";
import {
  BRAIN_DEFAULT_PILLARS,
  BRAIN_GROUPS,
  BRAIN_QUESTIONS,
  estimateRemainingSeconds,
  formatMinutes,
  type BrainCompletion,
  type BrainQuestionDef,
} from "@/lib/business-brain";

type CompetitorRow = {
  name: string;
  website: string;
  instagram: string;
  strengths: string;
  weaknesses: string;
  notes: string;
};

type PillarRow = { name: string; description: string };

type AssetRow = {
  id: string;
  kind: string;
  url: string;
  label: string | null;
  originalName: string | null;
};

const BRAIN_FA: Record<string, string> = {
  Friendly: "دوستانه",
  Luxury: "لوکس",
  Professional: "حرفه‌ای",
  Minimal: "مینیمال",
  Playful: "بازیگوش",
  Premium: "پریمیوم",
  Bold: "جسور",
  Modern: "مدرن",
  Traditional: "سنتی",
  Reels: "ریلز",
  Carousel: "کاروسل",
  Stories: "استوری",
  Blog: "وبلاگ",
  Newsletter: "خبرنامه",
  "Behind The Scenes": "پشت صحنه",
  Testimonials: "نظرات مشتریان",
  "Case Studies": "مطالعات موردی",
  Offers: "پیشنهادها",
  Community: "جامعه",
  News: "اخبار",
  Culture: "فرهنگ",
  Name: "نام",
  Website: "وب‌سایت",
  Instagram: "اینستاگرام",
  Strengths: "نقاط قوت",
  Weaknesses: "نقاط ضعف",
  Notes: "یادداشت‌ها",
};

const BRAIN_Q_FA: Record<string, { prompt: string; help: string }> = {
  "brand.name": {
    prompt: "نام برند شما چیست؟",
    help: "نامی که مشتریان شما را با آن می‌شناسند.",
  },
  "brand.website": {
    prompt: "وب‌سایت دارید؟",
    help: "اگر دارید، لینک کامل را وارد کنید.",
  },
  "brand.logo": {
    prompt: "می‌خواهید لوگوی خود را آپلود کنید؟",
    help: "فعلاً اختیاری است — بعداً هم می‌توانید در دارایی‌ها اضافه کنید.",
  },
  "brand.industry": {
    prompt: "در چه صنعتی فعالیت می‌کنید؟",
    help: "مثلاً قهوه، SaaS، مد، کلینیک.",
  },
  "brand.description": {
    prompt: "در چند جمله کسب‌وکار شما چه کاری انجام می‌دهد؟",
    help: "انگار دارید برای یک دوست باهوش توضیح می‌دهید.",
  },
  "brand.years": {
    prompt: "چند سال است که فعالیت می‌کنید؟",
    help: "تقریبی هم باشد کافی است.",
  },
};

function parseList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
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
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
        selected
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border/80 text-muted-foreground hover:text-foreground",
      )}
    >
      {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
      {label}
    </button>
  );
}

export function BusinessBrainWorkspace({
  workspaceSlug,
  brandSlug,
  mode = "overview",
}: {
  workspaceSlug: string;
  brandSlug: string;
  mode?: "overview" | "interview";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dictionary: d, locale } = useI18n();
  const page = usePageCopy("brain");
  const brandBase = `/w/${workspaceSlug}/b/${brandSlug}`;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answersByKey, setAnswersByKey] = useState<Record<string, string>>({});
  const [traits, setTraits] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [pillars, setPillars] = useState<PillarRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [completion, setCompletion] = useState<BrainCompletion | null>(null);
  const [currentKey, setCurrentKey] = useState(BRAIN_QUESTIONS[0]?.key ?? "");
  const [version, setVersion] = useState(1);
  const [brandName, setBrandName] = useState("");

  const index = Math.max(
    0,
    BRAIN_QUESTIONS.findIndex((q) => q.key === currentKey),
  );
  const question = BRAIN_QUESTIONS[index] as BrainQuestionDef | undefined;
  const localizedQuestion = question
    ? {
        prompt:
          locale === "fa"
            ? (BRAIN_Q_FA[question.key]?.prompt ?? question.prompt)
            : question.prompt,
        helpText:
          locale === "fa"
            ? (BRAIN_Q_FA[question.key]?.help ?? question.helpText)
            : question.helpText,
      }
    : null;
  const remainingLabel =
    locale === "fa"
      ? `${remaining} باقی‌مانده`
      : `${formatMinutes(remaining)} left`;
  const localizeBrainLabel = (value: string) => faLabel(locale, value, BRAIN_FA);

  const answeredKeys = useMemo(
    () => new Set(Object.keys(answersByKey).filter((k) => answersByKey[k]?.trim())),
    [answersByKey],
  );

  const remaining = formatMinutes(
    estimateRemainingSeconds(index, answeredKeys),
  );

  const displayCompletion = useMemo(
    () =>
      completion ? localizeBrainCompletion(completion, d.brain) : null,
    [completion, d.brain],
  );

  const fill = (template: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      template,
    );

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ workspaceSlug, brandSlug });
    const res = await fetch(`/api/brain?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(d.brain.loadError);
      return;
    }
    const data = await res.json();
    setAnswersByKey(data.answersByKey ?? {});
    setTraits(data.voice?.traits ?? []);
    setAssets(data.assets ?? []);
    setCompletion(data.completion);
    setVersion(data.brain?.version ?? 1);
    setBrandName(data.brand?.name ?? "");
    setCompetitors(
      (data.competitors ?? []).map(
        (c: {
          name: string;
          website: string | null;
          instagram: string | null;
          notes: string | null;
        }) => ({
          name: c.name,
          website: c.website ?? "",
          instagram: c.instagram ?? "",
          strengths: "",
          weaknesses: "",
          notes: c.notes ?? "",
        }),
      ),
    );
    setPillars(
      (data.pillars ?? []).map(
        (p: { name: string; description: string | null }) => ({
          name: p.name,
          description: p.description ?? "",
        }),
      ),
    );

    const group = searchParams.get("group");
    if (mode === "interview") {
      if (group) {
        const first = BRAIN_QUESTIONS.find((q) => q.groupKey === group);
        if (first) setCurrentKey(first.key);
      } else if (data.brain?.currentQuestionKey) {
        setCurrentKey(data.brain.currentQuestionKey);
      }
    }
  }, [workspaceSlug, brandSlug, mode, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch("/api/brain", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...body }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save.");
      return null;
    }
    const data = await res.json();
    if (data.answersByKey) setAnswersByKey(data.answersByKey);
    if (data.voice?.traits) setTraits(data.voice.traits);
    if (data.completion) setCompletion(data.completion);
    if (data.brain?.version) setVersion(data.brain.version);
    if (data.competitors) {
      setCompetitors(
        data.competitors.map(
          (c: {
            name: string;
            website: string | null;
            instagram: string | null;
            notes: string | null;
          }) => ({
            name: c.name,
            website: c.website ?? "",
            instagram: c.instagram ?? "",
            strengths: "",
            weaknesses: "",
            notes: c.notes ?? "",
          }),
        ),
      );
    }
    if (data.pillars) {
      setPillars(
        data.pillars.map(
          (p: { name: string; description: string | null }) => ({
            name: p.name,
            description: p.description ?? "",
          }),
        ),
      );
    }
    if (data.assets) setAssets(data.assets);
    return data;
  }

  async function saveCurrent(go?: "next" | "prev" | "stay") {
    if (!question) return;

    let payload: Record<string, unknown> = {
      currentQuestionKey: question.key,
    };

    if (question.key === "personality.traits") {
      payload = {
        ...payload,
        questionKey: question.key,
        value: traits.join(", "),
        valueJson: traits,
        voice: { traits },
      };
    } else if (question.inputType === "competitors") {
      payload = {
        ...payload,
        questionKey: question.key,
        value: String(competitors.length),
        competitors: competitors.filter((c) => c.name.trim()),
      };
    } else if (question.inputType === "pillars") {
      payload = {
        ...payload,
        questionKey: question.key,
        value: String(pillars.length),
        pillars: pillars.filter((p) => p.name.trim()),
      };
    } else if (
      question.key === "communication.tone" ||
      question.key === "communication.emoji" ||
      question.key === "communication.style" ||
      question.key === "communication.cta"
    ) {
      const value = answersByKey[question.key] ?? "";
      payload = {
        ...payload,
        questionKey: question.key,
        value,
        voice: {
          ...(question.key === "communication.tone"
            ? { toneOfVoice: value }
            : {}),
          ...(question.key === "communication.emoji"
            ? { emojiUsage: value }
            : {}),
          ...(question.key === "communication.style"
            ? { writingStyle: value }
            : {}),
          ...(question.key === "communication.cta" ? { ctaStyle: value } : {}),
        },
      };
    } else if (
      question.key === "communication.forbidden" ||
      question.key === "communication.preferred"
    ) {
      const value = answersByKey[question.key] ?? "";
      const list = parseList(value);
      payload = {
        ...payload,
        questionKey: question.key,
        value,
        valueJson: list,
        voice: {
          ...(question.key === "communication.forbidden"
            ? { forbiddenWords: list }
            : { preferredWords: list }),
        },
      };
    } else {
      payload = {
        ...payload,
        questionKey: question.key,
        value: answersByKey[question.key] ?? "",
      };
    }

    const data = await patch(payload);
    if (!data) return;

    if (go === "next" && index < BRAIN_QUESTIONS.length - 1) {
      const nextKey = BRAIN_QUESTIONS[index + 1]!.key;
      setCurrentKey(nextKey);
      await patch({ currentQuestionKey: nextKey });
    } else if (go === "prev" && index > 0) {
      const prevKey = BRAIN_QUESTIONS[index - 1]!.key;
      setCurrentKey(prevKey);
      await patch({ currentQuestionKey: prevKey });
    } else if (go === "next" && index === BRAIN_QUESTIONS.length - 1) {
      await patch({ snapshot: true });
      toast.success("Interview saved.");
      router.push(`${brandBase}/brain`);
    } else {
      toast.success("Saved");
    }
  }

  async function uploadAsset(file: File, kind: string) {
    const form = new FormData();
    form.set("workspaceSlug", workspaceSlug);
    form.set("brandSlug", brandSlug);
    form.set("kind", kind);
    form.set("file", file);
    const res = await fetch("/api/brain/assets", { method: "POST", body: form });
    if (!res.ok) {
      toast.error("Upload failed.");
      return;
    }
    toast.success("Uploaded");
    await load();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (mode === "overview") {
    return (
      <div className="space-y-6">
        <PageHeader
          title={page.title}
          description={d.brain.overviewDescription}
          actions={
            <Button asChild>
              <Link href={`${brandBase}/brain/interview`}>
                <Sparkles className="h-4 w-4" />
                {displayCompletion && displayCompletion.completionPercent > 0
                  ? d.brain.resumeInterview
                  : d.brain.startInterview}
              </Link>
            </Button>
          }
          secondaryActions={
            <Button asChild variant="outline">
              <Link href={`${brandBase}/strategy`}>{d.home.openStrategy}</Link>
            </Button>
          }
        />

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs md:col-span-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {d.brain.brainScore}
            </div>
            <div className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">
              {displayCompletion?.score ?? 0}
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{
                  width: `${displayCompletion?.completionPercent ?? 0}%`,
                }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {fill(d.brain.percentSections, {
                percent: displayCompletion?.completionPercent ?? 0,
                done: displayCompletion?.sectionsCompleted ?? 0,
                total:
                  displayCompletion?.sectionsTotal ?? BRAIN_GROUPS.length,
                version,
              })}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs md:col-span-2">
            <h2 className="text-[15px] font-medium tracking-tight">
              {d.brain.nextActionTitle}
            </h2>
            {displayCompletion?.nextAction ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {fill(d.brain.strengthen, {
                    label: displayCompletion.nextAction.label,
                    brand: brandName || d.brain.thisBrand,
                  })}
                </p>
                <Button asChild size="sm">
                  <Link
                    href={`${brandBase}${displayCompletion.nextAction.hrefSuffix}`}
                  >
                    {d.home.continue}
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {d.brain.completeMsg}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {(displayCompletion?.recommendations ?? []).map((r) => (
                <Badge
                  key={r}
                  variant="secondary"
                  className="max-w-full whitespace-normal py-1"
                >
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
          <h2 className="text-[15px] font-medium tracking-tight">
            {d.home.missingSections}
          </h2>
          {(displayCompletion?.missing.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {d.brain.noMissing}
            </p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {displayCompletion?.missing.map((m) => (
                <li key={m.groupKey}>
                  <Link
                    href={`${brandBase}/brain/interview?group=${m.groupKey}`}
                    className="interactive-card flex items-center justify-between rounded-lg border border-border/70 px-3 py-3 text-sm"
                  >
                    <span>{m.groupLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      {fill(d.home.leftCount, { count: m.keys.length })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {BRAIN_GROUPS.map((g) => {
            const miss = displayCompletion?.missing.find(
              (m) => m.groupKey === g.key,
            );
            const done = !miss;
            const groupLabel =
              d.brain.groups[g.key as keyof typeof d.brain.groups] ?? g.label;
            return (
              <Link
                key={g.key}
                href={`${brandBase}/brain/interview?group=${g.key}`}
                className={cn(
                  "rounded-xl border px-4 py-4 text-sm transition-colors",
                  done
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/80 bg-card hover:bg-accent/40",
                )}
              >
                <div className="font-medium tracking-tight">{groupLabel}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {done
                    ? d.brain.complete
                    : fill(d.brain.remainingCount, {
                        count: miss?.keys.length ?? 0,
                      })}
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    );
  }

  // Interview mode
  if (!question) return null;

  const progress = Math.round(((index + 1) / BRAIN_QUESTIONS.length) * 100);
  const value = answersByKey[question.key] ?? "";

  return (
    <div dir={locale === "fa" ? "rtl" : "ltr"} className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`${brandBase}/brain`}>
            <ArrowLeft className="h-4 w-4" />
            {d.brain.brainOverview}
          </Link>
        </Button>
        <div className="text-xs text-muted-foreground">
          {saving ? (locale === "fa" ? "در حال ذخیره…" : "Saving…") : remainingLabel}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {(d.brain.groups[question.groupKey as keyof typeof d.brain.groups] ??
              question.groupLabel)}{" "}
            · {index + 1} / {BRAIN_QUESTIONS.length}
          </span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-md md:p-9">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {d.brain.groups[question.groupKey as keyof typeof d.brain.groups] ??
            question.groupLabel}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-[1.75rem]">
          {localizedQuestion?.prompt}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {localizedQuestion?.helpText}
        </p>

        <div className="mt-8 space-y-4">
          {question.inputType === "textarea" ? (
            <Textarea
              rows={5}
              value={value}
              onChange={(e) =>
                setAnswersByKey((a) => ({ ...a, [question.key]: e.target.value }))
              }
              placeholder={locale === "fa" ? "پاسخ خود را بنویسید…" : "Type your answer…"}
              autoFocus
            />
          ) : null}

          {question.inputType === "text" ||
          question.inputType === "url" ||
          question.inputType === "number" ||
          question.inputType === "chips" ||
          question.inputType === "colors" ? (
            <Input
              type={question.inputType === "number" ? "number" : "text"}
              value={value}
              onChange={(e) =>
                setAnswersByKey((a) => ({ ...a, [question.key]: e.target.value }))
              }
              placeholder={
                question.inputType === "chips"
                  ? locale === "fa"
                    ? "با ویرگول جدا کنید"
                    : "Comma separated"
                  : question.inputType === "url"
                    ? "https://"
                    : locale === "fa"
                      ? "پاسخ شما"
                      : "Your answer"
              }
              autoFocus
            />
          ) : null}

          {question.inputType === "multiselect" ? (
            <div className="flex flex-wrap gap-2">
              {(question.options ?? []).map((opt) => {
                const selected =
                  question.key === "personality.traits"
                    ? traits.includes(opt)
                    : parseList(value).includes(opt);
                return (
                  <ChipToggle
                    key={opt}
                    label={localizeBrainLabel(opt)}
                    selected={selected}
                    onClick={() => {
                      if (question.key === "personality.traits") {
                        setTraits((t) =>
                          t.includes(opt)
                            ? t.filter((x) => x !== opt)
                            : [...t, opt],
                        );
                      } else {
                        const list = parseList(value);
                        const next = list.includes(opt)
                          ? list.filter((x) => x !== opt)
                          : [...list, opt];
                        setAnswersByKey((a) => ({
                          ...a,
                          [question.key]: next.join(", "),
                        }));
                      }
                    }}
                  />
                );
              })}
            </div>
          ) : null}

          {question.inputType === "competitors" ? (
            <div className="space-y-3">
              {competitors.map((c, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-xl border border-border/70 p-4"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder={localizeBrainLabel("Name")}
                      value={c.name}
                      onChange={(e) =>
                        setCompetitors((list) =>
                          list.map((row, idx) =>
                            idx === i ? { ...row, name: e.target.value } : row,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder={localizeBrainLabel("Website")}
                      value={c.website}
                      onChange={(e) =>
                        setCompetitors((list) =>
                          list.map((row, idx) =>
                            idx === i
                              ? { ...row, website: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder={localizeBrainLabel("Instagram")}
                      value={c.instagram}
                      onChange={(e) =>
                        setCompetitors((list) =>
                          list.map((row, idx) =>
                            idx === i
                              ? { ...row, instagram: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder={localizeBrainLabel("Strengths")}
                      value={c.strengths}
                      onChange={(e) =>
                        setCompetitors((list) =>
                          list.map((row, idx) =>
                            idx === i
                              ? { ...row, strengths: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder={localizeBrainLabel("Weaknesses")}
                      value={c.weaknesses}
                      onChange={(e) =>
                        setCompetitors((list) =>
                          list.map((row, idx) =>
                            idx === i
                              ? { ...row, weaknesses: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </div>
                  <Textarea
                    rows={2}
                    placeholder={localizeBrainLabel("Notes")}
                    value={c.notes}
                    onChange={(e) =>
                      setCompetitors((list) =>
                        list.map((row, idx) =>
                          idx === i ? { ...row, notes: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      setCompetitors((list) => list.filter((_, idx) => idx !== i))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    {locale === "fa" ? "حذف" : "Remove"}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCompetitors((list) => [
                    ...list,
                    {
                      name: "",
                      website: "",
                      instagram: "",
                      strengths: "",
                      weaknesses: "",
                      notes: "",
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                {locale === "fa" ? "افزودن رقیب" : "Add competitor"}
              </Button>
            </div>
          ) : null}

          {question.inputType === "pillars" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {BRAIN_DEFAULT_PILLARS.map((name) => (
                  <ChipToggle
                    key={name}
                    label={localizeBrainLabel(name)}
                    selected={pillars.some((p) => p.name === name)}
                    onClick={() =>
                      setPillars((list) =>
                        list.some((p) => p.name === name)
                          ? list.filter((p) => p.name !== name)
                          : [...list, { name, description: "" }],
                      )
                    }
                  />
                ))}
              </div>
              {pillars.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={p.name}
                    onChange={(e) =>
                      setPillars((list) =>
                        list.map((row, idx) =>
                          idx === i ? { ...row, name: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setPillars((list) => list.filter((_, idx) => idx !== i))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPillars((list) => [
                    ...list,
                    { name: locale === "fa" ? "ستون جدید" : "New pillar", description: "" },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                {locale === "fa" ? "افزودن ستون سفارشی" : "Add custom pillar"}
              </Button>
            </div>
          ) : null}

          {question.inputType === "assets" ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="brain-upload">{locale === "fa" ? "آپلود فایل" : "Upload file"}</Label>
                <Input
                  id="brain-upload"
                  type="file"
                  accept="image/*,.pdf"
                  className="mt-2"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void uploadAsset(
                        file,
                        question.key === "brand.logo" ? "logo" : "guideline",
                      );
                    }
                  }}
                />
              </div>
              {assets.length > 0 ? (
                <ul className="space-y-2">
                  {assets.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm"
                    >
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:underline"
                      >
                        {a.label || a.originalName || a.kind}
                      </a>
                      <Badge variant="muted">{a.kind}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {locale === "fa"
                    ? "هنوز دارایی‌ای اضافه نشده — می‌توانید فعلاً رد کنید و بعداً اضافه کنید."
                    : "No assets yet — you can skip and add later."}
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={index === 0 || saving}
            onClick={() => void saveCurrent("prev")}
          >
            <ArrowLeft className="h-4 w-4" />
            {locale === "fa" ? "قبلی" : "Previous"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void saveCurrent("stay")}
          >
            {locale === "fa" ? "ذخیره پیشرفت" : "Save progress"}
          </Button>
          <Button
            type="button"
            className="ml-auto"
            disabled={saving}
            onClick={() => void saveCurrent("next")}
          >
            {index === BRAIN_QUESTIONS.length - 1
              ? locale === "fa"
                ? "پایان"
                : "Finish"
              : locale === "fa"
                ? "بعدی"
                : "Next"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
