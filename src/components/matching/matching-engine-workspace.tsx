"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Crosshair,
  Loader2,
  Pin,
  RefreshCw,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MATCH_FILTERS, SCORE_LEVELS } from "@/lib/matching";

type Score = {
  overall: number;
  confidence: number;
  industryScore: number;
  audienceScore: number;
  productScore: number;
  goalScore: number;
  seasonScore: number;
  locationScore: number;
  channelScore: number;
  preparationScore: number;
  brandCompatibilityScore: number;
  explanation: string;
};

type Opportunity = {
  id: string;
  title: string;
  summary: string;
  eventDate: string;
  scoreLevel: string | null;
  confidence: number | null;
  whyMatched: string | null;
  rulesMatched: string[];
  rulesFailed: string[];
  missingInfo: string[];
  pinned: boolean;
  ignored: boolean;
  planningStart: string | null;
  contentDeadline: string | null;
  publishingStart: string | null;
  expirationAt: string | null;
  event: {
    id: string;
    key: string;
    name: string;
    countries: string[];
    industries: string[];
  };
  score: Score | null;
  evidence: Array<{
    id: string;
    ruleKey: string;
    passed: boolean;
    detail: string;
    weight: number;
    contribution: number;
  }>;
  conflicts: Array<{ id: string; kind: string; title: string; detail: string }>;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

type FilterKey = (typeof MATCH_FILTERS)[number]["key"];

export function MatchingEngineWorkspace({
  workspaceSlug,
  brandSlug,
}: Props) {
  const page = usePageCopy("matching");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("upcoming");
  const [upcoming, setUpcoming] = useState<Opportunity[]>([]);
  const [critical, setCritical] = useState<Opportunity[]>([]);
  const [ignored, setIgnored] = useState<Opportunity[]>([]);
  const [expired, setExpired] = useState<Opportunity[]>([]);
  const [lowConfidence, setLowConfidence] = useState<Opportunity[]>([]);
  const [conflicts, setConflicts] = useState<
    Array<{ id: string; kind: string; title: string; detail: string; titleOpp?: string }>
  >([]);
  const [overrides, setOverrides] = useState<
    Array<{ id: string; kind: string; note: string | null; eventId: string | null }>
  >([]);
  const [counts, setCounts] = useState({
    upcoming: 0,
    critical: 0,
    ignored: 0,
    expired: 0,
    lowConfidence: 0,
    overrides: 0,
    conflicts: 0,
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const list = useMemo(() => {
    if (filter === "critical") return critical;
    if (filter === "ignored") return ignored;
    if (filter === "expired") return expired;
    if (filter === "low_confidence") return lowConfidence;
    if (filter === "manual") return upcoming.filter((o) => o.pinned);
    return upcoming;
  }, [filter, upcoming, critical, ignored, expired, lowConfidence]);

  const active = list.find((o) => o.id === activeId) || list[0] || null;

  const apply = (data: Record<string, unknown>) => {
    setUpcoming((data.upcoming as Opportunity[]) || []);
    setCritical((data.critical as Opportunity[]) || []);
    setIgnored((data.ignored as Opportunity[]) || []);
    setExpired((data.expired as Opportunity[]) || []);
    setLowConfidence((data.lowConfidence as Opportunity[]) || []);
    setConflicts((data.conflicts as typeof conflicts) || []);
    setOverrides((data.manualOverrides as typeof overrides) || []);
    setCounts(
      (data.counts as typeof counts) || {
        upcoming: 0,
        critical: 0,
        ignored: 0,
        expired: 0,
        lowConfidence: 0,
        overrides: 0,
        conflicts: 0,
      },
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matching?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      apply(data);
      if (!activeId && data.upcoming?.[0]?.id) setActiveId(data.upcoming[0].id);
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
    const res = await fetch("/api/matching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const run = async () => {
    setBusy(true);
    try {
      const data = await post({ intent: "run", horizonDays: 120 });
      apply(data.dashboard || {});
      toast.success(
        `Matched ${data.dashboard?.meta?.matched ?? 0} opportunities`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Matching failed");
    } finally {
      setBusy(false);
    }
  };

  const override = async (kind: string) => {
    if (!active) return;
    setBusy(true);
    try {
      await post({
        intent: "override",
        opportunityId: active.id,
        eventId: active.event.id,
        kind,
        priority: kind === "PRIORITY" ? 15 : undefined,
      });
      toast.success(`${kind} applied`);
      await run();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Override failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-[280px_1fr_320px]">
        <Skeleton className="h-[70vh]" />
        <Skeleton className="h-[70vh]" />
        <Skeleton className="h-[70vh]" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-orange-200/70">
            {page.title}
          </p>
          <h1 className="font-serif text-2xl tracking-tight">
            Deterministic business fit
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            No LLM. No content. Pure reproducible scoring from Knowledge Graph +
            Business Brain.
          </p>
        </div>
        <Button size="sm" disabled={busy} onClick={() => void run()}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Run matching
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="min-h-0 space-y-3 overflow-y-auto border-r border-white/5 p-3">
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg border border-white/5 p-2">
              <p className="font-serif text-lg">{counts.critical}</p>
              <p className="text-muted-foreground">Critical</p>
            </div>
            <div className="rounded-lg border border-white/5 p-2">
              <p className="font-serif text-lg">{counts.upcoming}</p>
              <p className="text-muted-foreground">Upcoming</p>
            </div>
          </div>
          <div className="space-y-1">
            {MATCH_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "w-full rounded-lg border px-2.5 py-2 text-left text-sm",
                  filter === f.key
                    ? "border-orange-400/40 bg-orange-400/10"
                    : "border-transparent hover:border-white/10",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-white/5 p-3 text-xs text-muted-foreground">
            <p>Conflicts · {counts.conflicts}</p>
            <p className="mt-1">Overrides · {counts.overrides}</p>
            <p className="mt-1">Low confidence · {counts.lowConfidence}</p>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-4">
          <ul className="space-y-2">
            {list.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(o.id)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition",
                    active?.id === o.id
                      ? "border-orange-400/40 bg-orange-400/10"
                      : "border-white/5 hover:border-white/15",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{o.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {o.whyMatched || o.summary}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {o.scoreLevel || "n/a"}
                        </Badge>
                        {o.pinned ? (
                          <Badge variant="secondary" className="text-[10px]">
                            pinned
                          </Badge>
                        ) : null}
                        {o.conflicts.length ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {o.conflicts.length} conflicts
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-2xl">
                        {Math.round(o.score?.overall ?? 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(o.eventDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {!list.length ? (
              <li className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                <Crosshair className="mx-auto mb-2 size-8 text-orange-300/70" />
                <p className="font-serif text-lg">No matches in this filter</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run matching to score events against this brand.
                </p>
              </li>
            ) : null}
          </ul>
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-white/5 p-4">
          {!active ? (
            <p className="text-sm text-muted-foreground">
              Select an opportunity to see explanation and overrides.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <Badge className="mb-2">{active.scoreLevel}</Badge>
                <h2 className="font-serif text-2xl leading-tight">
                  {active.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {active.whyMatched}
                </p>
              </div>

              <div className="rounded-xl border border-orange-400/20 bg-orange-400/5 p-3">
                <p className="text-xs uppercase tracking-wide text-orange-200/70">
                  Overall score
                </p>
                <p className="font-serif text-3xl">
                  {Math.round(active.score?.overall ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Confidence {Math.round(active.confidence ?? 0)}
                </p>
              </div>

              <div className="space-y-2">
                {[
                  ["Industry", active.score?.industryScore],
                  ["Audience", active.score?.audienceScore],
                  ["Product", active.score?.productScore],
                  ["Goal", active.score?.goalScore],
                  ["Season", active.score?.seasonScore],
                  ["Location", active.score?.locationScore],
                  ["Channel", active.score?.channelScore],
                  ["Preparation", active.score?.preparationScore],
                  ["Brand tone", active.score?.brandCompatibilityScore],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                      <span>{label as string}</span>
                      <span>{Math.round(Number(value || 0))}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-orange-400/80"
                        style={{
                          width: `${Math.min(100, Number(value || 0))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Evidence
                </p>
                <ul className="space-y-2">
                  {active.evidence.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-lg border border-white/5 px-2 py-1.5 text-xs"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{e.ruleKey}</span>
                        <span className="text-muted-foreground">
                          {e.passed ? "pass" : "fail"} · +
                          {e.contribution.toFixed(1)}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{e.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {active.missingInfo.length ? (
                <div className="text-xs text-muted-foreground">
                  Missing · {active.missingInfo.join(", ")}
                </div>
              ) : null}

              <div className="text-xs text-muted-foreground">
                <p>
                  Plan start ·{" "}
                  {active.planningStart
                    ? new Date(active.planningStart).toLocaleDateString()
                    : "—"}
                </p>
                <p>
                  Content deadline ·{" "}
                  {active.contentDeadline
                    ? new Date(active.contentDeadline).toLocaleDateString()
                    : "—"}
                </p>
                <p>
                  Publish window ·{" "}
                  {active.publishingStart
                    ? new Date(active.publishingStart).toLocaleDateString()
                    : "—"}
                </p>
              </div>

              {active.conflicts.length ? (
                <div>
                  <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <AlertTriangle className="size-3" /> Conflicts
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {active.conflicts.map((c) => (
                      <li key={c.id}>
                        {c.title} — {c.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void override("FORCE_MATCH")}
                >
                  Force match
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void override("PIN")}
                >
                  <Pin className="size-3.5" />
                  Pin
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void override("PRIORITY")}
                >
                  Boost priority
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void override("WHITELIST")}
                >
                  Whitelist
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void override("IGNORE_EVENT")}
                >
                  <ShieldOff className="size-3.5" />
                  Ignore
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void override("BLACKLIST")}
                >
                  Blacklist
                </Button>
              </div>

              <div className="text-[10px] text-muted-foreground">
                Levels:{" "}
                {SCORE_LEVELS.map((l) => `${l.label} ${l.min}-${l.max}`).join(
                  " · ",
                )}
              </div>

              {overrides.length ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Manual overrides
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {overrides.slice(0, 6).map((o) => (
                      <li key={o.id}>
                        {o.kind}
                        {o.note ? ` — ${o.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {conflicts.length ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Brand conflicts
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {conflicts.slice(0, 5).map((c) => (
                      <li key={c.id}>
                        {c.title}
                        {c.titleOpp ? ` (${c.titleOpp})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
