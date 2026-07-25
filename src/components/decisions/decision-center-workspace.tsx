"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  Sunrise,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  DECISION_ACTIONS,
  SCORE_KEYS,
  decisionTypeLabel,
  focusBucket,
} from "@/lib/decisions";

type Evidence = {
  id: string;
  source: string;
  label: string;
  detail: string;
  metricValue: string | null;
};

type Recommendation = {
  id: string;
  type: string;
  title: string;
  summary: string;
  status: string;
  priority: number;
  confidence: number;
  businessImpact: number;
  expectedRoi: number;
  effort: number;
  urgency: number;
  reason: string;
  whatHappened: string;
  whyItMatters: string;
  consequences: string;
  recommendedAction: string;
  alternatives: string[] | null;
  risks: string | null;
  postponedUntil: string | null;
  evidence: Evidence[];
};

type DailyBrief = {
  id: string;
  todaysSummary: string;
  motivationalInsight: string | null;
  topPriorities: string[] | null;
  biggestOpportunities: string[] | null;
  biggestRisks: string[] | null;
  campaignHealth: string | null;
  contentHealth: string | null;
  communityHealth: string | null;
  salesSignals: string | null;
  insights?: Array<{
    id: string;
    kind: string;
    title: string;
    detail: string;
    severity: string;
  }>;
};

type MorningBrief = {
  id: string;
  greeting: string | null;
  todaysFocus: string | null;
  motivationalQuote: string | null;
  estimatedWorkload: string | null;
  suggestedSchedule: string | null;
  topTasks: Array<{ title: string; urgency?: number }> | null;
  criticalNotifications: string[] | null;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function ScoreBars({ rec }: { rec: Recommendation }) {
  return (
    <div className="space-y-2">
      {SCORE_KEYS.map((k) => {
        const raw = rec[k.key as keyof Recommendation];
        const value =
          k.key === "confidence"
            ? Math.round(Number(raw) * 100)
            : Math.round(Number(raw));
        return (
          <div key={k.key}>
            <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
              <span>{k.label}</span>
              <span>{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-amber-400/80"
                style={{ width: `${Math.min(100, value)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DecisionCenterWorkspace({ workspaceSlug, brandSlug }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [daily, setDaily] = useState<DailyBrief | null>(null);
  const [morning, setMorning] = useState<MorningBrief | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [counts, setCounts] = useState({
    pending: 0,
    postponed: 0,
    assigned: 0,
    total: 0,
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const apply = (data: Record<string, unknown>) => {
    setDaily((data.daily as DailyBrief) || null);
    setMorning((data.morning as MorningBrief) || null);
    const recs = (data.recommendations as Recommendation[]) || [];
    setRecommendations(recs);
    setCounts(
      (data.counts as typeof counts) || {
        pending: 0,
        postponed: 0,
        assigned: 0,
        total: 0,
      },
    );
    if (!activeId && recs[0]?.id) setActiveId(recs[0].id);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/decisions?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      apply(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, [qs, activeId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/decisions", {
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
      const data = await post({ intent: "generate", focusMode });
      apply(data.dashboard || {});
      toast.success("Morning brief ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: string) => {
    if (!activeId) return;
    setBusy(true);
    try {
      const data = await post({
        intent: "action",
        recommendationId: activeId,
        action,
      });
      if (
        data.href &&
        (action === "GENERATE_CONTENT" ||
          action === "SCHEDULE" ||
          action === "CONVERT_CAMPAIGN" ||
          action === "CREATE_TASK")
      ) {
        toast.success("Action applied");
        router.push(data.href);
        return;
      }
      toast.success("Decision recorded");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    if (!focusMode) return recommendations;
    return recommendations.filter((r) => {
      const bucket = focusBucket(r);
      return bucket === "attention" || bucket === "next" || bucket === "blocked";
    });
  }, [recommendations, focusMode]);

  const active = visible.find((r) => r.id === activeId) || visible[0] || null;

  if (loading) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-[280px_1fr_320px]">
        <Skeleton className="h-[70vh] w-full" />
        <Skeleton className="h-[70vh] w-full" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
            Decision Center
          </p>
          <h1 className="font-serif text-2xl tracking-tight">
            What deserves attention today
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Executive brain — decisions with evidence, not another analytics page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFocusMode((v) => !v)}
            className={cn(focusMode && "border-amber-400/40 bg-amber-400/10")}
          >
            {focusMode ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            Focus Mode
          </Button>
          <Button size="sm" onClick={() => void generate()} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate today&apos;s brief
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* Decision cards */}
        <aside className="min-h-0 overflow-y-auto border-r border-white/5 p-3">
          <div className="mb-3 flex gap-2 text-[11px] text-muted-foreground">
            <span>{counts.pending} pending</span>
            <span>·</span>
            <span>{counts.assigned} assigned</span>
          </div>
          {!visible.length ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <p className="font-serif text-lg">No decisions yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Generate this morning&apos;s brief to surface what matters.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((r) => {
                const bucket = focusBucket(r);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(r.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition",
                        active?.id === r.id
                          ? "border-amber-400/40 bg-amber-400/10"
                          : "border-white/5 bg-white/[0.02] hover:border-white/15",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {decisionTypeLabel(r.type)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          P{Math.round(r.priority)}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug">{r.title}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {r.recommendedAction}
                      </p>
                      {focusMode ? (
                        <p className="mt-2 text-[10px] uppercase tracking-wide text-amber-200/60">
                          {bucket}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Active decision */}
        <section className="min-h-0 overflow-y-auto p-6">
          {!active ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Sunrise className="mb-3 size-8 text-amber-300/70" />
              <p className="font-serif text-2xl">Start the morning review</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Inzorya will analyze campaigns, content, community, and opportunities —
                then tell you only what deserves a decision.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-8">
              <div>
                <Badge className="mb-3">{decisionTypeLabel(active.type)}</Badge>
                <h2 className="font-serif text-3xl tracking-tight">{active.title}</h2>
                <p className="mt-2 text-muted-foreground">{active.summary}</p>
              </div>

              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
                <p className="text-xs uppercase tracking-wide text-amber-200/70">
                  Recommended action
                </p>
                <p className="mt-2 font-serif text-xl">{active.recommendedAction}</p>
                <p className="mt-2 text-sm text-muted-foreground">{active.reason}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    What happened
                  </p>
                  <p className="text-sm leading-relaxed">{active.whatHappened}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Why it matters
                  </p>
                  <p className="text-sm leading-relaxed">{active.whyItMatters}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Expected consequences
                  </p>
                  <p className="text-sm leading-relaxed">{active.consequences}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Risks
                  </p>
                  <p className="text-sm leading-relaxed">
                    {active.risks || "No major risks flagged."}
                  </p>
                </div>
              </div>

              {asList(active.alternatives).length ? (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Alternatives
                  </p>
                  <ul className="space-y-1 text-sm">
                    {asList(active.alternatives).map((a) => (
                      <li key={a} className="text-muted-foreground">
                        · {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Supporting evidence
                </p>
                <ul className="space-y-2">
                  {active.evidence.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{e.label}</p>
                        {e.metricValue ? (
                          <span className="text-xs text-amber-200/80">
                            {e.metricValue}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{e.source}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{e.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <ScoreBars rec={active} />

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Action Center
                </p>
                <div className="flex flex-wrap gap-2">
                  {DECISION_ACTIONS.map((a) => (
                    <Button
                      key={a.key}
                      size="sm"
                      variant={
                        a.key === "APPROVE"
                          ? "default"
                          : a.key === "REJECT"
                            ? "destructive"
                            : "outline"
                      }
                      disabled={busy || active.status === "REJECTED"}
                      onClick={() => void act(a.key)}
                    >
                      {a.key === "APPROVE" ? (
                        <Check className="size-3.5" />
                      ) : a.key === "REJECT" ? (
                        <X className="size-3.5" />
                      ) : null}
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Morning + daily brief */}
        <aside className="min-h-0 overflow-y-auto border-l border-white/5 p-4">
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-200/80">
              <Sunrise className="size-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Morning Brief</p>
            </div>
            <p className="font-serif text-2xl">
              {morning?.greeting || "Good morning."}
            </p>
            {morning?.todaysFocus ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="text-foreground">Today&apos;s Focus — </span>
                {morning.todaysFocus}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate the brief to unlock today&apos;s focus.
              </p>
            )}
            {asList(morning?.criticalNotifications).length ? (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Critical
                </p>
                {asList(morning?.criticalNotifications).map((n) => (
                  <p key={n} className="text-sm text-amber-100/90">
                    · {n}
                  </p>
                ))}
              </div>
            ) : null}
            {Array.isArray(morning?.topTasks) && morning!.topTasks.length ? (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Top 5 tasks
                </p>
                <ol className="space-y-1 text-sm">
                  {morning!.topTasks.slice(0, 5).map((t, i) => (
                    <li key={`${t.title}-${i}`}>
                      {i + 1}. {t.title}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {morning?.estimatedWorkload ? (
              <p className="text-xs text-muted-foreground">
                Workload · {morning.estimatedWorkload}
              </p>
            ) : null}
            {morning?.suggestedSchedule ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {morning.suggestedSchedule}
              </p>
            ) : null}
            {morning?.motivationalQuote ? (
              <p className="border-l border-amber-400/30 pl-3 font-serif text-sm italic text-amber-50/90">
                {morning.motivationalQuote}
              </p>
            ) : null}
          </div>

          {daily ? (
            <div className="space-y-4 border-t border-white/5 pt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Daily Executive Brief
              </p>
              <p className="text-sm leading-relaxed">{daily.todaysSummary}</p>
              {[
                ["Priorities", asList(daily.topPriorities)],
                ["Opportunities", asList(daily.biggestOpportunities)],
                ["Risks", asList(daily.biggestRisks)],
              ].map(([label, items]) =>
                (items as string[]).length ? (
                  <div key={label as string}>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label as string}
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {(items as string[]).map((item) => (
                        <li key={item}>· {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
              {[
                ["Campaign", daily.campaignHealth],
                ["Content", daily.contentHealth],
                ["Community", daily.communityHealth],
                ["Sales", daily.salesSignals],
              ].map(([label, text]) =>
                text ? (
                  <div key={label as string}>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label as string} health
                    </p>
                    <p className="text-sm text-muted-foreground">{text as string}</p>
                  </div>
                ) : null,
              )}
              {daily.motivationalInsight ? (
                <p className="font-serif text-sm italic text-amber-50/80">
                  {daily.motivationalInsight}
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
