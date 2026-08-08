"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_ONBOARDING_STEPS } from "@/lib/business";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

type FormState = {
  name: string;
  businessSummary: string;
  industry: string;
  website: string;
  country: string;
  languages: string;
  businessGoals: string;
  mainProducts: string;
  targetAudience: string;
  competitors: string;
  brandPersonality: string;
  preferredTone: string;
  contentStyle: string;
  mainCta: string;
  postingFrequency: string;
  preferredPlatforms: string;
  marketingChallenges: string;
  monthlyBudget: string;
  teamSize: string;
};

const emptyForm: FormState = {
  name: "",
  businessSummary: "",
  industry: "",
  website: "",
  country: "",
  languages: "",
  businessGoals: "",
  mainProducts: "",
  targetAudience: "",
  competitors: "",
  brandPersonality: "",
  preferredTone: "",
  contentStyle: "",
  mainCta: "",
  postingFrequency: "",
  preferredPlatforms: "",
  marketingChallenges: "",
  monthlyBudget: "",
  teamSize: "",
};

const INDUSTRIES = [
  { en: "Restaurant", fa: "رستوران" },
  { en: "Coffee Shop", fa: "کافه" },
  { en: "SaaS", fa: "نرم‌افزار SaaS" },
  { en: "E-commerce", fa: "فروشگاه آنلاین" },
  { en: "Agency", fa: "آژانس" },
  { en: "Beauty", fa: "زیبایی" },
  { en: "Real Estate", fa: "املاک" },
];

const TONES = [
  { en: "Friendly", fa: "صمیمی" },
  { en: "Professional", fa: "حرفه‌ای" },
  { en: "Luxury", fa: "لوکس" },
  { en: "Funny", fa: "شاد و بامزه" },
  { en: "Minimal", fa: "مینیمال" },
  { en: "Educational", fa: "آموزشی" },
  { en: "Premium", fa: "پریمیوم" },
];

const AUDIENCES = [
  { en: "Parents", fa: "والدین" },
  { en: "Students", fa: "دانشجویان" },
  { en: "Business Owners", fa: "صاحبان کسب‌وکار" },
  { en: "Developers", fa: "توسعه‌دهندگان" },
  { en: "Doctors", fa: "پزشکان" },
  { en: "Restaurant Customers", fa: "مشتریان رستوران" },
  { en: "Gym Members", fa: "اعضای باشگاه" },
  { en: "Tourists", fa: "گردشگران" },
];

const GOALS = [
  { en: "Increase Sales", fa: "افزایش فروش" },
  { en: "Brand Awareness", fa: "آگاهی از برند" },
  { en: "More Leads", fa: "سرنخ بیشتر" },
  { en: "Community Growth", fa: "رشد جامعه" },
  { en: "Customer Retention", fa: "حفظ مشتری" },
  { en: "Launch New Product", fa: "لانچ محصول جدید" },
];

const LANGUAGES = [
  { en: "English", fa: "انگلیسی", value: "English" },
  { en: "Persian", fa: "فارسی", value: "Persian" },
  { en: "Arabic", fa: "عربی", value: "Arabic" },
  { en: "Turkish", fa: "ترکی", value: "Turkish" },
  { en: "French", fa: "فرانسوی", value: "French" },
  { en: "German", fa: "آلمانی", value: "German" },
];

const PLATFORMS = [
  "Instagram",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "X",
  "Facebook",
];

function splitList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function toggleCsv(current: string, item: string) {
  const set = new Set(splitList(current));
  if (set.has(item)) set.delete(item);
  else set.add(item);
  return Array.from(set).join(", ");
}

function hasCsv(current: string, item: string) {
  return splitList(current).includes(item);
}

function ChoiceCard({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border/70 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border/70 text-muted-foreground hover:bg-accent/40",
      )}
    >
      {label}
    </button>
  );
}

export function BusinessOnboardingWizard({
  workspaceSlug,
  initialBrandSlug,
  initialStep = 0,
  initialForm,
}: {
  workspaceSlug: string;
  initialBrandSlug?: string | null;
  initialStep?: number;
  initialForm?: Partial<FormState>;
}) {
  const router = useRouter();
  const { locale, dictionary: d } = useI18n();
  const ui = d.onboardingUi;
  const fa = locale === "fa";
  const [step, setStep] = useState(initialStep);
  const [brandSlug, setBrandSlug] = useState(initialBrandSlug ?? "");
  const [form, setForm] = useState<FormState>({ ...emptyForm, ...initialForm });
  const [pending, setPending] = useState(false);
  const [industrySearch, setIndustrySearch] = useState("");
  const [customAudience, setCustomAudience] = useState("");

  const total = BUSINESS_ONBOARDING_STEPS.length + 1;
  const progress = Math.round(((step + 1) / total) * 100);

  const title = useMemo(() => {
    if (step === 0) return ui.nameTitle;
    return BUSINESS_ONBOARDING_STEPS[step - 1]?.title ?? "Business";
  }, [step, ui.nameTitle]);

  const description = useMemo(() => {
    if (step === 0) return ui.nameDesc;
    return BUSINESS_ONBOARDING_STEPS[step - 1]?.description ?? "";
  }, [step, ui.nameDesc]);

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function fill(template: string, vars: Record<string, string | number>) {
    return Object.entries(vars).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      template,
    );
  }

  async function ensureBrand() {
    if (brandSlug) return brandSlug;
    const res = await fetch("/api/business-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        name: form.name,
        website: form.website,
        businessSummary: form.businessSummary,
        industry: form.industry,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Could not create brand.");
    }
    const data = (await res.json()) as { brandSlug: string };
    setBrandSlug(data.brandSlug);
    return data.brandSlug;
  }

  async function save(opts: { nextStep?: number; complete?: boolean }) {
    if (step === 0 && form.name.trim().length < 2) {
      toast.error(ui.nameRequired);
      return;
    }

    setPending(true);
    try {
      const slug = await ensureBrand();
      const res = await fetch("/api/business-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          brandSlug: slug,
          name: form.name,
          businessSummary: form.businessSummary || null,
          industry: form.industry || null,
          website: form.website || null,
          country: form.country || null,
          languages: splitList(form.languages),
          businessGoals: form.businessGoals || null,
          mainProducts: form.mainProducts || null,
          targetAudience: form.targetAudience || null,
          competitors: form.competitors || null,
          brandPersonality: form.brandPersonality || null,
          preferredTone: form.preferredTone || null,
          contentStyle: form.contentStyle || null,
          mainCta: form.mainCta || null,
          postingFrequency: form.postingFrequency || null,
          preferredPlatforms: splitList(form.preferredPlatforms),
          marketingChallenges: form.marketingChallenges || null,
          monthlyBudget: form.monthlyBudget || null,
          teamSize: form.teamSize || null,
          onboardingStep: opts.nextStep ?? step,
          complete: opts.complete,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed.");
      }

      if (opts.complete) {
        toast.success(fa ? "پروفایل کسب‌وکار آماده است." : "Business profile ready.");
        router.push(`/w/${workspaceSlug}/home`);
        router.refresh();
        return;
      }

      toast.success(fa ? "پیشرفت ذخیره شد." : "Progress saved.");
      if (typeof opts.nextStep === "number") {
        setStep(opts.nextStep);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  const filteredIndustries = INDUSTRIES.filter((i) => {
    const q = industrySearch.trim().toLowerCase();
    if (!q) return true;
    return i.en.toLowerCase().includes(q) || i.fa.includes(q);
  });

  return (
    <div className="mx-auto w-full max-w-2xl" dir={fa ? "rtl" : "ltr"}>
      <div className="mb-10">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{fill(ui.stepOf, { step: step + 1, total })}</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-md md:p-9">
        <h1 className="text-2xl font-semibold tracking-tight">
          {step === 0
            ? title
            : fa
              ? (
                  {
                    identity: "هویت کسب‌وکار",
                    market: "بازار و پیشنهاد",
                    voice: "صدای برند",
                    ops: "عملیات بازاریابی",
                  } as Record<string, string>
                )[BUSINESS_ONBOARDING_STEPS[step - 1]?.id ?? ""] ?? title
              : title}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          {step === 0
            ? description
            : fa
              ? (
                  {
                    identity: "کیستید و کجا فعالیت می‌کنید.",
                    market: "چه می‌فروشید و به چه کسانی.",
                    voice: "اینزوریا بعداً با چه لحنی کمک کند.",
                    ops: "ریتم، پلتفرم‌ها و محدودیت‌ها.",
                  } as Record<string, string>
                )[BUSINESS_ONBOARDING_STEPS[step - 1]?.id ?? ""] ?? description
              : description}
        </p>

        <div className="mt-8 space-y-5">
          {step === 0 ? (
            <>
              <Field
                label={ui.businessName}
                value={form.name}
                onChange={(v) => setField("name", v)}
                required
              />
              <Field
                label={ui.website}
                value={form.website}
                onChange={(v) => setField("website", v)}
                placeholder="https://"
              />
              <Area
                label={ui.summary}
                value={form.businessSummary}
                onChange={(v) => setField("businessSummary", v)}
              />

              <div className="space-y-2">
                <Label>{ui.industry}</Label>
                <Input
                  value={industrySearch}
                  onChange={(e) => setIndustrySearch(e.target.value)}
                  placeholder={ui.industrySearch}
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {filteredIndustries.map((i) => (
                    <ChoiceCard
                      key={i.en}
                      label={fa ? i.fa : i.en}
                      active={form.industry === i.en}
                      onClick={() => setField("industry", i.en)}
                    />
                  ))}
                </div>
                {industrySearch.trim() &&
                !INDUSTRIES.some(
                  (i) => i.en.toLowerCase() === industrySearch.trim().toLowerCase(),
                ) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setField("industry", industrySearch.trim())}
                  >
                    {industrySearch.trim()}
                  </Button>
                ) : null}
              </div>

              <Field
                label={ui.country}
                value={form.country}
                onChange={(v) => setField("country", v)}
              />

              <div className="space-y-2">
                <Label>{ui.languages}</Label>
                <p className="text-xs text-muted-foreground">{ui.languagesHint}</p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <Chip
                      key={l.value}
                      label={fa ? l.fa : l.en}
                      active={hasCsv(form.languages, l.value)}
                      onClick={() =>
                        setField("languages", toggleCsv(form.languages, l.value))
                      }
                    />
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label>{ui.goalsTitle}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map((g) => (
                    <ChoiceCard
                      key={g.en}
                      label={fa ? g.fa : g.en}
                      active={hasCsv(form.businessGoals, g.en)}
                      onClick={() =>
                        setField(
                          "businessGoals",
                          toggleCsv(form.businessGoals, g.en),
                        )
                      }
                    />
                  ))}
                </div>
              </div>
              <Area
                label={ui.products}
                value={form.mainProducts}
                onChange={(v) => setField("mainProducts", v)}
              />
              <div className="space-y-2">
                <Label>{ui.audienceTitle}</Label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => (
                    <Chip
                      key={a.en}
                      label={fa ? a.fa : a.en}
                      active={hasCsv(form.targetAudience, a.en)}
                      onClick={() =>
                        setField(
                          "targetAudience",
                          toggleCsv(form.targetAudience, a.en),
                        )
                      }
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customAudience}
                    onChange={(e) => setCustomAudience(e.target.value)}
                    placeholder={ui.audienceCustom}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!customAudience.trim()}
                    onClick={() => {
                      setField(
                        "targetAudience",
                        toggleCsv(form.targetAudience, customAudience.trim()),
                      );
                      setCustomAudience("");
                    }}
                  >
                    +
                  </Button>
                </div>
              </div>
              <Area
                label={ui.competitors}
                value={form.competitors}
                onChange={(v) => setField("competitors", v)}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="space-y-2">
                <Label>{ui.toneTitle}</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TONES.map((t) => (
                    <ChoiceCard
                      key={t.en}
                      label={fa ? t.fa : t.en}
                      active={form.preferredTone === t.en}
                      onClick={() => setField("preferredTone", t.en)}
                    />
                  ))}
                </div>
              </div>
              <Area
                label={ui.personality}
                value={form.brandPersonality}
                onChange={(v) => setField("brandPersonality", v)}
              />
              <Area
                label={ui.contentStyle}
                value={form.contentStyle}
                onChange={(v) => setField("contentStyle", v)}
              />
              <Field
                label={ui.mainCta}
                value={form.mainCta}
                onChange={(v) => setField("mainCta", v)}
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Field
                label={ui.frequency}
                value={form.postingFrequency}
                onChange={(v) => setField("postingFrequency", v)}
                placeholder={fa ? "۳ بار در هفته" : "3x / week"}
              />
              <div className="space-y-2">
                <Label>{ui.platforms}</Label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <Chip
                      key={p}
                      label={p}
                      active={hasCsv(form.preferredPlatforms, p)}
                      onClick={() =>
                        setField(
                          "preferredPlatforms",
                          toggleCsv(form.preferredPlatforms, p),
                        )
                      }
                    />
                  ))}
                </div>
              </div>
              <Area
                label={ui.challenges}
                value={form.marketingChallenges}
                onChange={(v) => setField("marketingChallenges", v)}
              />
              <Field
                label={ui.budget}
                value={form.monthlyBudget}
                onChange={(v) => setField("monthlyBudget", v)}
              />
              <Field
                label={ui.teamSize}
                value={form.teamSize}
                onChange={(v) => setField("teamSize", v)}
              />
            </>
          ) : null}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-2">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              {ui.back}
            </Button>
          ) : null}
          {step < total - 1 ? (
            <Button
              type="button"
              disabled={pending}
              className="ms-auto"
              onClick={() => void save({ nextStep: step + 1 })}
            >
              {pending ? ui.saving : ui.continue}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending}
              className="ms-auto"
              onClick={() => void save({ complete: true, nextStep: step })}
            >
              {pending ? ui.saving : ui.finish}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 w-7 rounded-full transition-colors duration-200",
              i <= step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
