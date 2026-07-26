"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  CalendarRange,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  Send,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  WORKFLOW_STATUSES,
  workflowStatusLabel,
} from "@/lib/pipeline";

type Workflow = {
  id: string;
  title: string;
  status: string;
  priority: number;
  anchorDate: string;
  planningStart: string | null;
  reviewAt: string | null;
  approvalAt: string | null;
  publishingStart: string | null;
  publishingEnd: string | null;
  contentPlanId: string | null;
  campaignId: string | null;
  projectId: string | null;
  recommendationId: string | null;
  reversible: boolean;
  context: Record<string, unknown>;
  timelines: Array<{
    id: string;
    kind: string;
    title: string;
    dueAt: string;
  }>;
  dependencies: Array<{
    id: string;
    kind: string;
    fromKey: string;
    toKey: string;
    note: string | null;
  }>;
  audits: Array<{
    id: string;
    action: string;
    message: string;
    createdAt: string;
    actor: { name: string | null; email: string } | null;
  }>;
  campaign: { id: string; name: string; status: string } | null;
  handoffs: Array<{ id: string; contentPlanId: string | null }>;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

type Filter = (typeof WORKFLOW_STATUSES)[number]["key"] | "ALL";

export function ExecutionPipelineWorkspace({
  workspaceSlug,
  brandSlug,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [anchorInput, setAnchorInput] = useState("");

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const list = useMemo(() => {
    if (filter === "ALL") return workflows;
    return workflows.filter((w) => w.status === filter);
  }, [filter, workflows]);

  const active = list.find((w) => w.id === activeId) || list[0] || null;

  const apply = (data: Record<string, unknown>) => {
    setWorkflows((data.workflows as Workflow[]) || []);
    setCounts((data.counts as Record<string, number>) || {});
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pipeline?${qs}`);
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

  useEffect(() => {
    if (active?.anchorDate) {
      setAnchorInput(active.anchorDate.slice(0, 10));
    }
  }, [active?.id, active?.anchorDate]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const refreshAfter = async (data: Record<string, unknown>) => {
    if (data.workflow) {
      setWorkflows((prev) => {
        const wf = data.workflow as Workflow;
        const idx = prev.findIndex((w) => w.id === wf.id);
        if (idx === -1) return [wf, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...wf };
        return next;
      });
    } else {
      await load();
    }
  };

  const run = async (intent: string, extra: Record<string, unknown> = {}) => {
    if (!active && intent !== "run") return;
    setBusy(true);
    try {
      const data = await post({
        intent,
        workflowId: active?.id,
        ...extra,
      });
      await refreshAfter(data);
      toast.success(`${intent} done`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-[240px_1fr_340px]">
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
          <p className="text-xs uppercase tracking-[0.2em] text-sky-200/70">
            Execution Pipeline
          </p>
          <h1 className="font-serif text-2xl tracking-tight">
            Calendar → Planner → Tasks → Publish
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Connect approved campaigns into planning and execution. No content
            generation. Context preserved. Work never duplicated.
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </header>

      <div className="border-b border-white/5 px-6 py-3">
        <div className="flex flex-wrap gap-1.5">
          {PIPELINE_STAGES.map((s, i) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              {i > 0 ? <span className="opacity-40">→</span> : null}
              <span className="rounded-md border border-white/10 px-1.5 py-0.5">
                {s.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)_360px]">
        <aside className="min-h-0 space-y-1 overflow-y-auto border-r border-white/5 p-3">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={cn(
              "flex w-full justify-between rounded-lg border px-2.5 py-2 text-left text-sm",
              filter === "ALL"
                ? "border-sky-400/40 bg-sky-400/10"
                : "border-transparent hover:border-white/10",
            )}
          >
            <span>All</span>
            <span className="text-muted-foreground">{counts.total || 0}</span>
          </button>
          {WORKFLOW_STATUSES.filter((s) => s.key !== "ARCHIVED").map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFilter(s.key)}
              className={cn(
                "flex w-full justify-between rounded-lg border px-2.5 py-2 text-left text-sm",
                filter === s.key
                  ? "border-sky-400/40 bg-sky-400/10"
                  : "border-transparent hover:border-white/10",
              )}
            >
              <span>{s.label}</span>
              <span className="text-muted-foreground">
                {workflows.filter((w) => w.status === s.key).length}
              </span>
            </button>
          ))}
        </aside>

        <section className="min-h-0 overflow-y-auto p-4">
          <ul className="space-y-2">
            {list.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(w.id)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition",
                    active?.id === w.id
                      ? "border-sky-400/40 bg-sky-400/10"
                      : "border-white/5 hover:border-white/15",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{w.title}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {workflowStatusLabel(w.status)}
                        </Badge>
                        {w.contentPlanId ? (
                          <Badge variant="secondary" className="text-[10px]">
                            plan
                          </Badge>
                        ) : null}
                        {w.projectId ? (
                          <Badge variant="secondary" className="text-[10px]">
                            tasks
                          </Badge>
                        ) : null}
                        {w.timelines.length ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {w.timelines.length} milestones
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p className="font-serif text-xl text-foreground">
                        {Math.round(w.priority)}
                      </p>
                      <p>{new Date(w.anchorDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {!list.length ? (
              <li className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                <GitBranch className="mx-auto mb-2 size-8 text-sky-300/70" />
                <p className="font-serif text-lg">No workflows yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Approve a campaign recommendation to open the execution
                  pipeline.
                </p>
              </li>
            ) : null}
          </ul>
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-white/5 p-4">
          {!active ? (
            <p className="text-sm text-muted-foreground">
              Select a workflow to hand off, sync calendar, or reschedule.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <Badge className="mb-2">
                  {workflowStatusLabel(active.status)}
                </Badge>
                <h2 className="font-serif text-2xl leading-tight">
                  {active.title}
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Reversible · context snapshot retained
                </p>
              </div>

              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void run("run")}
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  Run pipeline
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("handoff")}
                >
                  <Send className="size-3.5" />
                  Planner
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("create_tasks")}
                >
                  <ListTodo className="size-3.5" />
                  Tasks
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("calendar_sync")}
                >
                  <CalendarRange className="size-3.5" />
                  Sync calendar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void run("archive")}
                >
                  <Archive className="size-3.5" />
                  Archive
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <div className="flex flex-wrap gap-1">
                  {WORKFLOW_STATUSES.slice(0, 8).map((s) => (
                    <Button
                      key={s.key}
                      size="sm"
                      variant={active.status === s.key ? "default" : "outline"}
                      disabled={busy}
                      className="h-7 text-[10px]"
                      onClick={() =>
                        void run("status", { status: s.key })
                      }
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Reschedule anchor
                </p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={anchorInput}
                    onChange={(e) => setAnchorInput(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-white/10 bg-transparent px-2 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !anchorInput}
                    onClick={() =>
                      void run("reschedule", { anchorDate: anchorInput })
                    }
                  >
                    Apply
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>
                  Plan start ·{" "}
                  {active.planningStart
                    ? new Date(active.planningStart).toLocaleDateString()
                    : "—"}
                </p>
                <p>
                  Review ·{" "}
                  {active.reviewAt
                    ? new Date(active.reviewAt).toLocaleDateString()
                    : "—"}
                </p>
                <p>
                  Approval ·{" "}
                  {active.approvalAt
                    ? new Date(active.approvalAt).toLocaleDateString()
                    : "—"}
                </p>
                <p>
                  Publish ·{" "}
                  {active.publishingStart
                    ? new Date(active.publishingStart).toLocaleDateString()
                    : "—"}
                  {active.publishingEnd
                    ? ` → ${new Date(active.publishingEnd).toLocaleDateString()}`
                    : ""}
                </p>
              </div>

              {active.timelines.length ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Timeline
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {active.timelines.map((t) => (
                      <li key={t.id}>
                        {t.kind} · {t.title} ·{" "}
                        {new Date(t.dueAt).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {active.dependencies.length ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Dependencies
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {active.dependencies.map((d) => (
                      <li key={d.id}>
                        {d.kind}: {d.fromKey} → {d.toKey}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {active.audits.length ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Audit
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {active.audits.slice(0, 8).map((a) => (
                      <li key={a.id}>
                        {a.action} · {a.message}
                        {a.actor?.name ? ` · ${a.actor.name}` : ""}
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
