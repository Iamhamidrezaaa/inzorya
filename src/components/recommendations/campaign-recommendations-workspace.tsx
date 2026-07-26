"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Loader2,
  Map,
  RefreshCw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CAMPAIGN_REC_STATUSES,
  strategyLabel,
} from "@/lib/campaign-recommendations";

type Scenario = {
  id: string;
  kind: string;
  name: string;
  summary: string;
  priority: number;
  confidence: number;
  selected: boolean;
};

type Recommendation = {
  id: string;
  name: string;
  objective: string;
  strategy: string;
  targetAudience: string;
  primaryChannel: string;
  supportingChannels: string[];
  suggestedDurationDays: number;
  priority: number;
  confidence: number;
  status: string;
  suggestedOffer: string | null;
  suggestedTheme: string | null;
  suggestedVisualDirection: string | null;
  suggestedMessaging: string | null;
  suggestedCta: string | null;
  suggestedLandingPage: string | null;
  suggestedEmail: string | null;
  contentPlan: { items?: Array<Record<string, unknown>> } | null;
  whyThisCampaign: string;
  whyNow: string;
  tradeOffs: string | null;
  potentialRisks: string | null;
  complexity: string;
  requiredTeam: string[];
  estimatedHours: number | null;
  assetsNeeded: string[];
  riskLevel: string;
  explanation: string;
  opportunity: {
    id: string;
    title: string;
    eventDate: string;
    scoreLevel: string | null;
    event: { name: string };
  };
  scenarios: Scenario[];
  executionPlan: {
    preparation: string | null;
    design: string | null;
    approval: string | null;
    publishing: string | null;
    followUp: string | null;
    measurement: string | null;
  } | null;
  impactEstimate: {
    expectedReach: number;
    expectedEngagement: number;
    expectedLeads: number;
    expectedRevenueImpact: number;
    brandImpact: number;
    confidence: number;
    notes: string | null;
  } | null;
  campaign: { id: string; name: string; status: string } | null;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

type Filter = "pending" | "approved" | "sent" | "archived" | "all";

export function CampaignRecommendationsWorkspace({
  workspaceSlug,
  brandSlug,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [eligible, setEligible] = useState<
    Array<{ id: string; title: string; overall: number; scoreLevel: string | null }>
  >([]);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    archived: 0,
    sentToPlanner: 0,
    eligible: 0,
    total: 0,
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const list = useMemo(() => {
    if (filter === "pending")
      return recommendations.filter((r) => r.status === "PENDING");
    if (filter === "approved")
      return recommendations.filter((r) => r.status === "APPROVED");
    if (filter === "sent")
      return recommendations.filter((r) => r.status === "SENT_TO_PLANNER");
    if (filter === "archived")
      return recommendations.filter(
        (r) => r.status === "ARCHIVED" || r.status === "REJECTED",
      );
    return recommendations;
  }, [filter, recommendations]);

  const active = list.find((r) => r.id === activeId) || list[0] || null;

  const apply = (data: Record<string, unknown>) => {
    setRecommendations((data.recommendations as Recommendation[]) || []);
    setEligible(
      (data.eligibleOpportunities as typeof eligible) || [],
    );
    setCounts(
      (data.counts as typeof counts) || {
        pending: 0,
        approved: 0,
        archived: 0,
        sentToPlanner: 0,
        eligible: 0,
        total: 0,
      },
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recommendations?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      apply(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/recommendations", {
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
      const data = await post({ intent: "generate" });
      apply(data.dashboard || {});
      toast.success(
        `Generated ${data.dashboard?.meta?.generated ?? 0} proposals from ${data.dashboard?.meta?.eligible ?? 0} eligible opportunities`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: string) => {
    if (!active) return;
    setBusy(true);
    try {
      const data = await post({
        intent: "action",
        recommendationId: active.id,
        action,
        scenarioId: active.scenarios.find((s) => s.selected)?.id,
      });
      if (data.dashboard) apply(data.dashboard);
      toast.success(
        data.href ? `${action} done` : `${action} applied`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const pickScenario = async (scenarioId: string) => {
    if (!active) return;
    setBusy(true);
    try {
      const data = await post({
        intent: "select_scenario",
        recommendationId: active.id,
        scenarioId,
      });
      if (data.recommendation) {
        setRecommendations((prev) =>
          prev.map((r) =>
            r.id === active.id ? { ...r, ...data.recommendation } : r,
          ),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-[260px_1fr_340px]">
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
          <p className="text-xs uppercase tracking-[0.2em] text-teal-200/70">
            Campaign Recommendations
          </p>
          <h1 className="font-serif text-2xl tracking-tight">
            Opportunity → campaign blueprint
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Structured proposals for human approval. No auto-launch. No copy.
            No images.
          </p>
        </div>
        <Button size="sm" disabled={busy} onClick={() => void generate()}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Generate proposals
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)_360px]">
        <aside className="min-h-0 space-y-3 overflow-y-auto border-r border-white/5 p-3">
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg border border-white/5 p-2">
              <p className="font-serif text-lg">{counts.pending}</p>
              <p className="text-muted-foreground">Pending</p>
            </div>
            <div className="rounded-lg border border-white/5 p-2">
              <p className="font-serif text-lg">{counts.eligible}</p>
              <p className="text-muted-foreground">Eligible</p>
            </div>
          </div>
          {(
            [
              ["pending", "Pending approval", counts.pending],
              ["approved", "Approved", counts.approved],
              ["sent", "Sent to planner", counts.sentToPlanner],
              ["archived", "Archived / rejected", counts.archived],
              ["all", "All", counts.total],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-sm",
                filter === key
                  ? "border-teal-400/40 bg-teal-400/10"
                  : "border-transparent hover:border-white/10",
              )}
            >
              <span>{label}</span>
              <span className="text-muted-foreground">{n}</span>
            </button>
          ))}
          {eligible.length ? (
            <div className="rounded-xl border border-white/5 p-3 text-xs text-muted-foreground">
              <p className="mb-2 font-medium text-foreground">
                Eligible opportunities
              </p>
              <ul className="space-y-1">
                {eligible.slice(0, 6).map((o) => (
                  <li key={o.id} className="truncate">
                    {o.title} · {Math.round(o.overall)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        <section className="min-h-0 overflow-y-auto p-4">
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition",
                    active?.id === r.id
                      ? "border-teal-400/40 bg-teal-400/10"
                      : "border-white/5 hover:border-white/15",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {r.objective}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {strategyLabel(r.strategy)}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {r.status}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {r.primaryChannel}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-2xl">
                        {Math.round(r.priority)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        conf {Math.round(r.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {!list.length ? (
              <li className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                <Layers3 className="mx-auto mb-2 size-8 text-teal-300/70" />
                <p className="font-serif text-lg">No proposals yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run matching first, then generate campaign blueprints from
                  high-score opportunities.
                </p>
              </li>
            ) : null}
          </ul>
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-white/5 p-4">
          {!active ? (
            <p className="text-sm text-muted-foreground">
              Select a proposal to review explanation and one-click actions.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <Badge className="mb-2">{strategyLabel(active.strategy)}</Badge>
                <h2 className="font-serif text-2xl leading-tight">
                  {active.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  From · {active.opportunity.title} ·{" "}
                  {new Date(active.opportunity.eventDate).toLocaleDateString()}
                </p>
              </div>

              <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-teal-200/70">
                  Why this / why now
                </p>
                <p className="mt-1">{active.whyThisCampaign}</p>
                <p className="mt-2 text-muted-foreground">{active.whyNow}</p>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Scenarios
                </p>
                <div className="space-y-1">
                  {active.scenarios.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void pickScenario(s.id)}
                      className={cn(
                        "w-full rounded-lg border px-2.5 py-2 text-left text-xs",
                        s.selected
                          ? "border-teal-400/40 bg-teal-400/10"
                          : "border-white/5",
                      )}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">
                          {Math.round(s.priority)}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{s.summary}</p>
                    </button>
                  ))}
                </div>
              </div>

              {active.impactEstimate ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Business impact (estimate)
                  </p>
                  {(
                    [
                      ["Reach", active.impactEstimate.expectedReach],
                      ["Engagement", active.impactEstimate.expectedEngagement],
                      ["Leads", active.impactEstimate.expectedLeads],
                      ["Revenue", active.impactEstimate.expectedRevenueImpact],
                      ["Brand", active.impactEstimate.brandImpact],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                        <span>{label}</span>
                        <span>{Math.round(value)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-teal-400/80"
                          style={{ width: `${Math.min(100, value)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="text-xs text-muted-foreground">
                <p>
                  Audience · {active.targetAudience.slice(0, 120)}
                  {active.targetAudience.length > 120 ? "…" : ""}
                </p>
                <p className="mt-1">
                  Channels · {active.primaryChannel}
                  {active.supportingChannels.length
                    ? ` + ${active.supportingChannels.join(", ")}`
                    : ""}
                </p>
                <p className="mt-1">
                  Duration · {active.suggestedDurationDays}d · Complexity ·{" "}
                  {active.complexity} · Risk · {active.riskLevel}
                </p>
                {active.estimatedHours != null ? (
                  <p className="mt-1">Hours · ~{active.estimatedHours}</p>
                ) : null}
              </div>

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Components (directions only)
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {[
                    ["Offer", active.suggestedOffer],
                    ["Theme", active.suggestedTheme],
                    ["Visual", active.suggestedVisualDirection],
                    ["Messaging", active.suggestedMessaging],
                    ["CTA", active.suggestedCta],
                    ["Landing", active.suggestedLandingPage],
                    ["Email", active.suggestedEmail],
                  ].map(([label, value]) =>
                    value ? (
                      <li key={label as string}>
                        <span className="text-foreground">{label as string}</span>{" "}
                        — {value}
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>

              {active.contentPlan?.items?.length ? (
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <ClipboardList className="size-3" /> Content requirements
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {active.contentPlan.items.map((item, i) => (
                      <li key={i}>
                        {String(item.contentType)} × {String(item.quantity || 1)}{" "}
                        · day {String(item.publishOffsetDays ?? 0)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {active.executionPlan ? (
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Map className="size-3" /> Execution
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {(
                      [
                        ["Prep", active.executionPlan.preparation],
                        ["Design", active.executionPlan.design],
                        ["Approval", active.executionPlan.approval],
                        ["Publish", active.executionPlan.publishing],
                        ["Follow-up", active.executionPlan.followUp],
                        ["Measure", active.executionPlan.measurement],
                      ] as const
                    ).map(([label, value]) =>
                      value ? (
                        <li key={label}>
                          <span className="text-foreground">{label}</span> —{" "}
                          {value}
                        </li>
                      ) : null,
                    )}
                  </ul>
                </div>
              ) : null}

              {(active.tradeOffs || active.potentialRisks) && (
                <div className="text-xs text-muted-foreground">
                  {active.tradeOffs ? <p>Trade-offs · {active.tradeOffs}</p> : null}
                  {active.potentialRisks ? (
                    <p className="mt-1">Risks · {active.potentialRisks}</p>
                  ) : null}
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  disabled={busy || active.status === "APPROVED"}
                  onClick={() => void act("APPROVE")}
                >
                  <CheckCircle2 className="size-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act("SEND_TO_PLANNER")}
                >
                  <Send className="size-3.5" />
                  Planner
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act("CREATE_TASKS")}
                >
                  Tasks
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act("SCHEDULE_REVIEW")}
                >
                  Schedule review
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void act("ARCHIVE")}
                >
                  <Archive className="size-3.5" />
                  Archive
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Statuses:{" "}
                {CAMPAIGN_REC_STATUSES.map((s) => s.label).join(" · ")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Approve creates a PLANNING campaign only — never auto-launches.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
