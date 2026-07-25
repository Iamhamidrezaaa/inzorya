"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Boxes,
  BrainCircuit,
  Play,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Adapter = { key: string; name: string; available: boolean };

export function AIPlatformAdmin({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug?: string | null;
}) {
  const [tab, setTab] = useState<"usage" | "catalog" | "playground" | "queue">(
    "usage",
  );
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<{
    dashboard: {
      totals: {
        requests: number;
        successes: number;
        failures: number;
        avgLatencyMs: number;
        totalCost: number;
        avgCost: number;
        byProvider: Record<string, number>;
        byTask: Record<string, number>;
      };
      daily: { day: string; requests: number; failures: number; cost: number }[];
      errors: { id: string; code: string; message: string; createdAt: string }[];
      recentExecutions: {
        id: string;
        status: string;
        modelKey: string | null;
        providerKey: string | null;
        latencyMs: number | null;
        task: { key: string; name: string };
        createdAt: string;
      }[];
    };
    adapters: Adapter[];
    config: { forceMock: boolean; enabled: boolean };
  } | null>(null);
  const [catalog, setCatalog] = useState<{
    providers: { key: string; name: string; status: string; priority: number }[];
    models: {
      key: string;
      displayName: string;
      status: string;
      contextLength: number;
      supportsVision: boolean;
      supportsJson: boolean;
      supportsStreaming: boolean;
      supportsTools: boolean;
      provider: { key: string; name: string };
    }[];
    tasks: { key: string; name: string; category: string; outputFormat: string }[];
    prompts: {
      id: string;
      key: string;
      name: string;
      currentVersion: number;
      versions: {
        id: string;
        version: number;
        systemPrompt: string;
        developerPrompt: string | null;
      }[];
    }[];
    adapters: Adapter[];
  } | null>(null);
  const [queue, setQueue] = useState<
    { id: string; status: string; task: { name: string }; createdAt: string }[]
  >([]);
  const [play, setPlay] = useState({
    taskKey: "platform.echo",
    text: "Hello AI platform",
    preference: "balanced" as "cost" | "latency" | "quality" | "balanced",
  });
  const [playResult, setPlayResult] = useState<unknown>(null);
  const [contextInspect, setContextInspect] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [promptEdit, setPromptEdit] = useState({
    promptId: "",
    systemPrompt: "",
    changelog: "",
  });

  const loadOverview = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ workspaceSlug });
    const res = await fetch(`/api/ai?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load AI platform.");
      return;
    }
    setOverview(await res.json());
  }, [workspaceSlug]);

  const loadCatalog = useCallback(async () => {
    const params = new URLSearchParams({ workspaceSlug, view: "catalog" });
    const res = await fetch(`/api/ai?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setCatalog(data);
    const echo = data.prompts?.find((p: { key: string }) => p.key === "platform.echo");
    if (echo?.versions?.[0]) {
      setPromptEdit({
        promptId: echo.id,
        systemPrompt: echo.versions[0].systemPrompt,
        changelog: "",
      });
    }
  }, [workspaceSlug]);

  const loadQueue = useCallback(async () => {
    const params = new URLSearchParams({ workspaceSlug, view: "queue" });
    const res = await fetch(`/api/ai?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setQueue(data.queue || []);
  }, [workspaceSlug]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === "catalog" || tab === "playground") void loadCatalog();
    if (tab === "queue") void loadQueue();
  }, [tab, loadCatalog, loadQueue]);

  async function runPlayground() {
    setBusy(true);
    setPlayResult(null);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "run_task",
        workspaceSlug,
        brandSlug: brandSlug || undefined,
        taskKey: play.taskKey,
        preference: play.preference,
        input: { text: play.text },
      }),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Run failed");
      setPlayResult(data);
      return;
    }
    setPlayResult(data.result);
    toast.success("Task completed via AI platform.");
    await loadOverview();
  }

  async function inspectContext() {
    if (!brandSlug) {
      toast.error("Select a brand context first.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "inspect_context",
        workspaceSlug,
        brandSlug,
      }),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Context inspect failed");
      return;
    }
    setContextInspect(data.composed);
  }

  async function savePromptVersion() {
    if (!promptEdit.promptId) return;
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "prompt_version",
        workspaceSlug,
        promptId: promptEdit.promptId,
        systemPrompt: promptEdit.systemPrompt,
        changelog: promptEdit.changelog || "Playground update",
      }),
    });
    if (!res.ok) {
      toast.error("Could not save prompt version.");
      return;
    }
    toast.success("Prompt version saved.");
    await loadCatalog();
  }

  async function rollback(version: number) {
    if (!promptEdit.promptId) return;
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "prompt_rollback",
        workspaceSlug,
        promptId: promptEdit.promptId,
        version,
      }),
    });
    if (!res.ok) {
      toast.error("Rollback failed.");
      return;
    }
    toast.success(`Rolled back to v${version}`);
    await loadCatalog();
  }

  const totals = overview?.dashboard.totals;

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Platform"
        description="Provider-agnostic intelligence infrastructure — mock execution only. No end-user AI features."
        actions={
          <Button size="sm" variant="outline" onClick={() => void loadOverview()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="muted">
          {overview?.config.enabled ? "Platform on" : "Platform off"}
        </Badge>
        <Badge variant="muted">
          {overview?.config.forceMock ? "Force mock" : "Live adapters allowed"}
        </Badge>
        {(overview?.adapters || []).map((a) => (
          <Badge key={a.key} variant={a.available ? "default" : "muted"}>
            {a.name}: {a.available ? "ready" : "unavailable"}
          </Badge>
        ))}
      </div>

      <div className="flex gap-1 rounded-lg border border-border/70 p-1">
        {(
          [
            ["usage", "Usage"],
            ["catalog", "Catalog"],
            ["playground", "Playground"],
            ["queue", "Queue"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              tab === id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/40",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !overview ? (
        <div className="grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : null}

      {tab === "usage" && totals ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<Activity className="h-4 w-4" />} label="Requests" value={String(totals.requests)} />
            <Stat
              icon={<BrainCircuit className="h-4 w-4" />}
              label="Avg latency"
              value={`${totals.avgLatencyMs} ms`}
            />
            <Stat
              icon={<Boxes className="h-4 w-4" />}
              label="Total cost (est.)"
              value={`$${totals.totalCost.toFixed(4)}`}
            />
            <Stat
              icon={<ScrollText className="h-4 w-4" />}
              label="Failures"
              value={String(totals.failures)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Daily usage">
              <ul className="space-y-1 text-xs">
                {(overview?.dashboard.daily || []).map((d) => (
                  <li
                    key={d.day}
                    className="flex justify-between rounded-md border border-border/50 px-2 py-1.5"
                  >
                    <span>{d.day}</span>
                    <span>
                      {d.requests} req · {d.failures} fail · ${d.cost.toFixed(4)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Provider distribution">
              <ul className="space-y-1 text-xs">
                {Object.entries(totals.byProvider).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
              <h3 className="mb-1 mt-4 text-xs font-medium text-muted-foreground">
                Most used tasks
              </h3>
              <ul className="space-y-1 text-xs">
                {Object.entries(totals.byTask)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span>{v}</span>
                    </li>
                  ))}
              </ul>
            </Panel>
          </div>

          <Panel title="Recent executions">
            <div className="space-y-1 text-xs">
              {(overview?.dashboard.recentExecutions || []).map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1.5"
                >
                  <span>
                    {e.task.name} · {e.providerKey}/{e.modelKey}
                  </span>
                  <span className="text-muted-foreground">
                    {e.status} · {e.latencyMs ?? "—"}ms
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Failure trends">
            {(overview?.dashboard.errors || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent AI errors.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {overview!.dashboard.errors.map((err) => (
                  <li
                    key={err.id}
                    className="rounded-md border border-rose-500/20 bg-rose-500/5 px-2 py-1.5"
                  >
                    <strong>{err.code}</strong> — {err.message}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === "catalog" && catalog ? (
        <div className="space-y-4">
          <Panel title="Providers">
            <div className="grid gap-2 md:grid-cols-3">
              {catalog.providers.map((p) => (
                <div key={p.key} className="rounded-lg border border-border/60 p-3 text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.key} · priority {p.priority} · {p.status}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Model registry">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2">Model</th>
                    <th>Provider</th>
                    <th>Context</th>
                    <th>Vision</th>
                    <th>JSON</th>
                    <th>Stream</th>
                    <th>Tools</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.models.map((m) => (
                    <tr key={m.key} className="border-t border-border/50">
                      <td className="py-2 font-medium">{m.displayName}</td>
                      <td>{m.provider.key}</td>
                      <td>{m.contextLength.toLocaleString()}</td>
                      <td>{m.supportsVision ? "yes" : "—"}</td>
                      <td>{m.supportsJson ? "yes" : "—"}</td>
                      <td>{m.supportsStreaming ? "yes" : "—"}</td>
                      <td>{m.supportsTools ? "yes" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Task contracts">
            <div className="grid gap-2 md:grid-cols-2">
              {catalog.tasks.map((t) => (
                <div key={t.key} className="rounded-lg border border-border/60 p-3 text-xs">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-muted-foreground">
                    {t.key} · {t.category} · {t.outputFormat}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === "playground" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Prompt playground (mock provider)">
            <div className="space-y-3">
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={play.taskKey}
                onChange={(e) => setPlay((p) => ({ ...p, taskKey: e.target.value }))}
              >
                <option value="platform.echo">platform.echo</option>
                <option value="platform.inspect_context">
                  platform.inspect_context
                </option>
              </select>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={play.preference}
                onChange={(e) =>
                  setPlay((p) => ({
                    ...p,
                    preference: e.target.value as typeof play.preference,
                  }))
                }
              >
                <option value="balanced">Route: balanced</option>
                <option value="cost">Route: cost</option>
                <option value="latency">Route: latency</option>
                <option value="quality">Route: quality</option>
              </select>
              <Textarea
                rows={4}
                value={play.text}
                onChange={(e) => setPlay((p) => ({ ...p, text: e.target.value }))}
                placeholder="Input text"
              />
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void runPlayground()}>
                  <Play className="h-4 w-4" />
                  Run task
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !brandSlug}
                  onClick={() => void inspectContext()}
                >
                  Inspect context
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Generated payload">
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px]">
              {playResult
                ? JSON.stringify(playResult, null, 2)
                : "Run a task to inspect output."}
            </pre>
            {contextInspect ? (
              <>
                <h3 className="mb-1 mt-3 text-xs font-medium text-muted-foreground">
                  Context snapshot
                </h3>
                <pre className="max-h-60 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px]">
                  {JSON.stringify(contextInspect, null, 2)}
                </pre>
              </>
            ) : null}
          </Panel>

          <Panel title="Compare / version prompts">
            <Textarea
              rows={6}
              value={promptEdit.systemPrompt}
              onChange={(e) =>
                setPromptEdit((p) => ({ ...p, systemPrompt: e.target.value }))
              }
            />
            <Input
              className="mt-2"
              placeholder="Changelog"
              value={promptEdit.changelog}
              onChange={(e) =>
                setPromptEdit((p) => ({ ...p, changelog: e.target.value }))
              }
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void savePromptVersion()}>
                Save new version
              </Button>
              {(catalog?.prompts.find((p) => p.id === promptEdit.promptId)?.versions || [])
                .slice(0, 5)
                .map((v) => (
                  <Button
                    key={v.id}
                    size="sm"
                    variant="outline"
                    onClick={() => void rollback(v.version)}
                  >
                    Rollback v{v.version}
                  </Button>
                ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === "queue" ? (
        <Panel title="Async queue foundation">
          <p className="mb-3 text-xs text-muted-foreground">
            Status model ready (Queued / Running / Completed / Failed / Cancelled).
            No worker process in this sprint.
          </p>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Queue empty.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {queue.map((q) => (
                <li
                  key={q.id}
                  className="flex justify-between rounded-md border border-border/50 px-2 py-1.5"
                >
                  <span>{q.task.name}</span>
                  <span>{q.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/40 p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
