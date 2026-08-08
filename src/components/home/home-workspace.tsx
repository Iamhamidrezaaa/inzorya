"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Clapperboard,
  LineChart,
  PenLine,
  Radar,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { resolveIntentPath, type HomeIntent } from "@/lib/home-intent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HomeRecommendation = {
  id: string;
  title: string;
  href: string;
};

export type HomeUpcoming = {
  posts: number;
  stories: number;
  reels: number;
  planHref: string;
};

export type HomeHealth = {
  brand: number;
  publishing: number;
  diversity: number;
};

type HomeWorkspaceProps = {
  firstName: string;
  brandBase: string;
  recommendations: HomeRecommendation[];
  opportunities: HomeRecommendation[];
  upcoming: HomeUpcoming;
  health: HomeHealth;
};

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

function greetingKey(hour: number): "greetingMorning" | "greetingAfternoon" | "greetingEvening" {
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

export function HomeWorkspace({
  firstName,
  brandBase,
  recommendations,
  opportunities,
  upcoming,
  health,
}: HomeWorkspaceProps) {
  const router = useRouter();
  const { locale, dictionary: d } = useI18n();
  const h = d.home;
  const [prompt, setPrompt] = useState("");

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return fill(h[greetingKey(hour)], { name: firstName });
  }, [firstName, h]);

  const goals: { intent: HomeIntent; label: string; icon: typeof Sparkles }[] = [
    { intent: "content_week", label: h.goalContentWeek, icon: CalendarDays },
    { intent: "campaign", label: h.goalCampaign, icon: Sparkles },
    { intent: "analyze", label: h.goalAnalyze, icon: LineChart },
    { intent: "opportunities", label: h.goalOpportunities, icon: Radar },
    { intent: "generate", label: h.goalGenerate, icon: PenLine },
    { intent: "ask", label: h.goalAskAi, icon: Clapperboard },
  ];

  const examples = [
    h.exampleRamadan,
    h.exampleInstagram,
    h.exampleEngagement,
    h.exampleIdeas,
    h.exampleSeasonal,
  ];

  function go(intent: HomeIntent, text?: string) {
    router.push(resolveIntentPath(brandBase, intent, text));
  }

  function submitPrompt() {
    const text = prompt.trim();
    if (!text) {
      go("ask");
      return;
    }
    go("custom", text);
  }

  return (
    <div
      className="mx-auto max-w-3xl space-y-10"
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <header className="space-y-3 pt-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {greeting}
        </h1>
        <p className="text-base text-muted-foreground md:text-lg">
          {h.goalQuestion}
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-2">
        {goals.map((g) => (
          <button
            key={g.intent}
            type="button"
            onClick={() => go(g.intent)}
            className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3.5 text-start transition-colors hover:bg-accent/40"
          >
            <g.icon className="size-4 shrink-0 text-primary" />
            <span className="text-sm font-medium">{g.label}</span>
          </button>
        ))}
      </section>

      <section className="space-y-3">
        <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-xs md:p-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitPrompt();
              }
            }}
            rows={3}
            placeholder={h.promptPlaceholder}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={submitPrompt}>
              <Sparkles className="size-3.5" />
              {h.promptSubmit}
            </Button>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {h.promptExamplesLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => go("custom", ex)}
                className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-medium tracking-tight">
          {h.recommendationsTitle}
        </h2>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{h.recommendationsEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {recommendations.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 text-sm transition-colors hover:bg-accent/40"
                >
                  <span>{r.title}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    {h.recommendationCta}
                    <ArrowRight className="size-3.5 rtl:rotate-180" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-medium tracking-tight">
              {h.upcomingTitle}
            </h2>
            <Button asChild size="sm" variant="ghost">
              <Link href={upcoming.planHref}>{h.upcomingEdit}</Link>
            </Button>
          </div>
          {upcoming.posts + upcoming.stories + upcoming.reels === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{h.upcomingEmpty}</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>{fill(h.postsCount, { count: upcoming.posts })}</li>
              <li>{fill(h.storiesCount, { count: upcoming.stories })}</li>
              <li>{fill(h.reelsCount, { count: upcoming.reels })}</li>
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-medium tracking-tight">
              {h.opportunitiesTitle}
            </h2>
            <Button asChild size="sm" variant="ghost">
              <Link href={`${brandBase}/opportunities`}>
                {h.opportunitiesExplore}
              </Link>
            </Button>
          </div>
          {opportunities.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {h.opportunitiesEmpty}
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {opportunities.slice(0, 3).map((o) => (
                <li key={o.id}>
                  <Link
                    href={o.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    · {o.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs">
        <h2 className="text-[15px] font-medium tracking-tight">{h.healthTitle}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(
            [
              [h.healthBrand, health.brand],
              [h.healthPublishing, health.publishing],
              [h.healthDiversity, health.diversity],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {value}%
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full bg-primary")}
                  style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
