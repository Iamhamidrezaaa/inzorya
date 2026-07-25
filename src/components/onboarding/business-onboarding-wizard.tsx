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

function splitList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
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
  const [step, setStep] = useState(initialStep);
  const [brandSlug, setBrandSlug] = useState(initialBrandSlug ?? "");
  const [form, setForm] = useState<FormState>({ ...emptyForm, ...initialForm });
  const [pending, setPending] = useState(false);

  const total = BUSINESS_ONBOARDING_STEPS.length + 1; // + identity name step 0
  const progress = Math.round(((step + 1) / total) * 100);

  const title = useMemo(() => {
    if (step === 0) return "Name your business";
    return BUSINESS_ONBOARDING_STEPS[step - 1]?.title ?? "Business";
  }, [step]);

  const description = useMemo(() => {
    if (step === 0) {
      return "Inzorya uses this profile as the business brain for future AI planning.";
    }
    return BUSINESS_ONBOARDING_STEPS[step - 1]?.description ?? "";
  }, [step]);

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      toast.error("Business name is required.");
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
        toast.success("Business profile ready.");
        router.push(`/w/${workspaceSlug}/home`);
        router.refresh();
        return;
      }

      toast.success("Progress saved.");
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

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-10">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {total}
          </span>
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
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        <div className="mt-8 space-y-5">
          {step === 0 ? (
            <>
              <Field
                label="Business / brand name"
                value={form.name}
                onChange={(v) => setField("name", v)}
                required
              />
              <Field
                label="Website"
                value={form.website}
                onChange={(v) => setField("website", v)}
                placeholder="https://"
              />
              <Area
                label="What does your business do?"
                value={form.businessSummary}
                onChange={(v) => setField("businessSummary", v)}
              />
              <Field
                label="Industry"
                value={form.industry}
                onChange={(v) => setField("industry", v)}
              />
              <Field
                label="Country"
                value={form.country}
                onChange={(v) => setField("country", v)}
              />
              <Field
                label="Languages (comma separated)"
                value={form.languages}
                onChange={(v) => setField("languages", v)}
                placeholder="English, Persian"
              />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Area
                label="Business goals"
                value={form.businessGoals}
                onChange={(v) => setField("businessGoals", v)}
              />
              <Area
                label="Main products / services"
                value={form.mainProducts}
                onChange={(v) => setField("mainProducts", v)}
              />
              <Area
                label="Target audience"
                value={form.targetAudience}
                onChange={(v) => setField("targetAudience", v)}
              />
              <Area
                label="Competitors"
                value={form.competitors}
                onChange={(v) => setField("competitors", v)}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Area
                label="Brand personality"
                value={form.brandPersonality}
                onChange={(v) => setField("brandPersonality", v)}
              />
              <Field
                label="Preferred tone"
                value={form.preferredTone}
                onChange={(v) => setField("preferredTone", v)}
                placeholder="Warm, expert, playful…"
              />
              <Area
                label="Content style"
                value={form.contentStyle}
                onChange={(v) => setField("contentStyle", v)}
              />
              <Field
                label="Main CTA"
                value={form.mainCta}
                onChange={(v) => setField("mainCta", v)}
                placeholder="Book a demo, Shop now…"
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Field
                label="Posting frequency"
                value={form.postingFrequency}
                onChange={(v) => setField("postingFrequency", v)}
                placeholder="3x / week"
              />
              <Field
                label="Preferred platforms (comma separated)"
                value={form.preferredPlatforms}
                onChange={(v) => setField("preferredPlatforms", v)}
                placeholder="Instagram, LinkedIn"
              />
              <Area
                label="Marketing challenges"
                value={form.marketingChallenges}
                onChange={(v) => setField("marketingChallenges", v)}
              />
              <Field
                label="Monthly marketing budget (optional)"
                value={form.monthlyBudget}
                onChange={(v) => setField("monthlyBudget", v)}
              />
              <Field
                label="Current team size"
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
              Back
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => void save({ nextStep: step })}
          >
            Save & continue later
          </Button>
          {step < total - 1 ? (
            <Button
              type="button"
              disabled={pending}
              className="ml-auto"
              onClick={() => void save({ nextStep: step + 1 })}
            >
              {pending ? "Saving…" : "Save & continue"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending}
              className="ml-auto"
              onClick={() => void save({ complete: true, nextStep: step })}
            >
              {pending ? "Finishing…" : "Finish & open dashboard"}
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
