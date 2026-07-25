"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page";

type Profile = {
  businessSummary: string | null;
  industry: string | null;
  website: string | null;
  country: string | null;
  languages: string[];
  businessGoals: string | null;
  mainProducts: string | null;
  targetAudience: string | null;
  competitors: string | null;
  brandPersonality: string | null;
  preferredTone: string | null;
  contentStyle: string | null;
  mainCta: string | null;
  postingFrequency: string | null;
  preferredPlatforms: string[];
  marketingChallenges: string | null;
  monthlyBudget: string | null;
  teamSize: string | null;
};

export function BusinessProfileEditor({
  workspaceSlug,
  brandSlug,
  brandName,
  completion,
  profile,
}: {
  workspaceSlug: string;
  brandSlug: string;
  brandName: string;
  completion: number;
  profile: Profile | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: brandName,
    businessSummary: profile?.businessSummary ?? "",
    industry: profile?.industry ?? "",
    website: profile?.website ?? "",
    country: profile?.country ?? "",
    languages: profile?.languages?.join(", ") ?? "",
    businessGoals: profile?.businessGoals ?? "",
    mainProducts: profile?.mainProducts ?? "",
    targetAudience: profile?.targetAudience ?? "",
    competitors: profile?.competitors ?? "",
    brandPersonality: profile?.brandPersonality ?? "",
    preferredTone: profile?.preferredTone ?? "",
    contentStyle: profile?.contentStyle ?? "",
    mainCta: profile?.mainCta ?? "",
    postingFrequency: profile?.postingFrequency ?? "",
    preferredPlatforms: profile?.preferredPlatforms?.join(", ") ?? "",
    marketingChallenges: profile?.marketingChallenges ?? "",
    monthlyBudget: profile?.monthlyBudget ?? "",
    teamSize: profile?.teamSize ?? "",
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/business-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        name: form.name,
        businessSummary: form.businessSummary || null,
        industry: form.industry || null,
        website: form.website || null,
        country: form.country || null,
        languages: form.languages
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        businessGoals: form.businessGoals || null,
        mainProducts: form.mainProducts || null,
        targetAudience: form.targetAudience || null,
        competitors: form.competitors || null,
        brandPersonality: form.brandPersonality || null,
        preferredTone: form.preferredTone || null,
        contentStyle: form.contentStyle || null,
        mainCta: form.mainCta || null,
        postingFrequency: form.postingFrequency || null,
        preferredPlatforms: form.preferredPlatforms
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        marketingChallenges: form.marketingChallenges || null,
        monthlyBudget: form.monthlyBudget || null,
        teamSize: form.teamSize || null,
        complete: true,
      }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Could not save business profile.");
      return;
    }
    toast.success("Business profile saved.");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Business"
        description={`Business brain completion: ${completion}%. Edit anytime — this feeds future AI.`}
      />
      <form onSubmit={onSave} className="mx-auto max-w-3xl space-y-4">
        {(
          [
            ["name", "Business name"],
            ["website", "Website"],
            ["industry", "Industry"],
            ["country", "Country"],
            ["languages", "Languages (comma separated)"],
            ["preferredTone", "Preferred tone"],
            ["mainCta", "Main CTA"],
            ["postingFrequency", "Posting frequency"],
            ["preferredPlatforms", "Preferred platforms (comma separated)"],
            ["monthlyBudget", "Monthly marketing budget"],
            ["teamSize", "Team size"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <Input
              value={form[key]}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: e.target.value }))
              }
            />
          </div>
        ))}
        {(
          [
            ["businessSummary", "What the business does"],
            ["businessGoals", "Business goals"],
            ["mainProducts", "Main products"],
            ["targetAudience", "Target audience"],
            ["competitors", "Competitors"],
            ["brandPersonality", "Brand personality"],
            ["contentStyle", "Content style"],
            ["marketingChallenges", "Marketing challenges"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <Textarea
              rows={3}
              value={form[key]}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: e.target.value }))
              }
            />
          </div>
        ))}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save business profile"}
        </Button>
      </form>
    </div>
  );
}
