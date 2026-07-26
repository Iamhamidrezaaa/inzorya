"use client";

import { useT } from "@/i18n/use-t";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  Plus,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  KANBAN_COLUMNS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  WORK_VIEWS,
  taskStatusLabel,
  taskTypeLabel,
} from "@/lib/work";

type Member = { id: string; name: string | null; email: string };

type Task = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
  platform: string | null;
  source: string;
  nextAction: string | null;
  blockedReason: string | null;
  owner: Member | null;
  project: { id: string; title: string; health: string } | null;
  campaign: { id: string; name: string } | null;
  subtasks: Array<{
    id: string;
    title: string;
    status: string;
    type: string;
    estimatedMinutes: number | null;
  }>;
  blockedBy: Array<{ fromTask: { id: string; title: string; status: string } }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: Member | null;
  }>;
  activities: Array<{
    id: string;
    kind: string;
    message: string;
    createdAt: string;
  }>;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

type ViewKey = (typeof WORK_VIEWS)[number]["key"];

export function WorkEngineWorkspace({ workspaceSlug, brandSlug }: Props) {
  const page = usePageCopy("work");
  const t = useT();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [dashboard, setDashboard] = useState<{
    myTasks: Task[];
    todayPriorities: Task[];
    blocked: Task[];
    upcomingDeadlines: Task[];
    completedThisWeek: number;
    campaignProgress: Array<{
      id: string;
      title: string;
      health: string;
      taskCount: number;
    }>;
    workload: Array<{
      userId: string;
      name: string;
      estimatedMinutes: number;
      overloaded: boolean;
      free: boolean;
    }>;
  } | null>(null);
  const [counts, setCounts] = useState({
    open: 0,
    blocked: 0,
    mine: 0,
    projects: 0,
  });
  const [activeId, setActiveId] = useState<string | null>(
    searchParams.get("task"),
  );
  const [draftTitle, setDraftTitle] = useState("");
  const [comment, setComment] = useState("");

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const apply = (data: Record<string, unknown>) => {
    setTasks((data.tasks as Task[]) || []);
    setMembers((data.members as Member[]) || []);
    setDashboard((data.dashboard as typeof dashboard) || null);
    setCounts(
      (data.counts as typeof counts) || {
        open: 0,
        blocked: 0,
        mine: 0,
        projects: 0,
      },
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/work?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      apply(data);
      const fromUrl = searchParams.get("task");
      if (fromUrl) setActiveId(fromUrl);
      else if (!activeId && data.tasks?.[0]?.id) setActiveId(data.tasks[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, [qs, activeId, searchParams]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const active = tasks.find((t) => t.id === activeId) || null;

  const createQuick = async () => {
    if (!draftTitle.trim()) return;
    setBusy(true);
    try {
      const data = await post({
        intent: "create_task",
        title: draftTitle.trim(),
        source: "MANUAL",
        type: "CUSTOM",
        priority: "MEDIUM",
      });
      setDraftTitle("");
      toast.success(data.duplicate ? "Already exists" : "Task created");
      setActiveId(data.task?.id || null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!active) return;
    setBusy(true);
    try {
      await post({ intent: "update_task", taskId: active.id, status });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const assign = async (ownerId: string) => {
    if (!active) return;
    setBusy(true);
    try {
      await post({ intent: "update_task", taskId: active.id, ownerId });
      toast.success("Assigned");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  };

  const assist = async (mode: string) => {
    if (!active && mode !== "workload") return;
    setBusy(true);
    try {
      const data = await post({
        intent: "assist",
        mode,
        taskIds: active ? [active.id] : undefined,
      });
      if (data.bootstrap) apply(data.bootstrap);
      toast.success("AI assist applied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assist failed");
    } finally {
      setBusy(false);
    }
  };

  const sendComment = async () => {
    if (!active || !comment.trim()) return;
    setBusy(true);
    try {
      await post({
        intent: "comment",
        taskId: active.id,
        body: comment.trim(),
      });
      setComment("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-[240px_1fr_320px]">
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
            {page.title}
          </p>
          <h1 className="text-2xl tracking-tight">
            {t("From idea to done", "از ایده تا انجام")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {t(
              "Execution layer — not another Kanban toy. One click from AI to work.",
              "لایه اجرا — نه یک کانبان اسباب‌بازی. یک کلیک از هوش مصنوعی تا کار.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
              {WORK_VIEWS.map((v) => (
            <Button
              key={v.key}
              size="sm"
              variant={view === v.key ? "default" : "outline"}
              onClick={() => setView(v.key)}
            >
              {t(
                v.label,
                (
                  {
                    Dashboard: "داشبورد",
                    List: "فهرست",
                    Kanban: "کانبان",
                    Table: "جدول",
                  } as Record<string, string>
                )[v.label] ?? v.label,
              )}
            </Button>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
        <aside className="min-h-0 space-y-4 overflow-y-auto border-r border-white/5 p-3">
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg border border-white/5 p-2">
              <p className="text-lg">{counts.open}</p>
              <p className="text-muted-foreground">{t("Open", "باز")}</p>
            </div>
            <div className="rounded-lg border border-white/5 p-2">
              <p className="text-lg">{counts.blocked}</p>
              <p className="text-muted-foreground">{t("Blocked", "مسدود")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("Quick task…", "کار سریع…")}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createQuick();
              }}
            />
            <Button size="icon" disabled={busy} onClick={() => void createQuick()}>
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <p className="px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Queue
            </p>
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={cn(
                  "w-full rounded-lg border px-2.5 py-2 text-left text-sm transition",
                  active?.id === t.id
                    ? "border-sky-400/40 bg-sky-400/10"
                    : "border-transparent hover:border-white/10",
                )}
              >
                <p className="line-clamp-2 font-medium leading-snug">{t.title}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {taskStatusLabel(t.status)} · {t.priority}
                </p>
              </button>
            ))}
            {!tasks.length ? (
              <p className="px-1 text-xs text-muted-foreground">
                {t(
                  "No work yet — create a task or convert an AI recommendation.",
                  "هنوز کاری نیست — یک کار بسازید یا پیشنهاد هوش مصنوعی را تبدیل کنید.",
                )}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-5">
          {view === "dashboard" && dashboard ? (
            <div className="mx-auto grid max-w-4xl gap-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <DashCard
                  title={t("Today's priorities", "اولویت‌های امروز")}
                  items={dashboard.todayPriorities}
                  onSelect={setActiveId}
                  emptyLabel={t("Nothing here", "اینجا چیزی نیست")}
                />
                <DashCard
                  title={t("My tasks", "کارهای من")}
                  items={dashboard.myTasks}
                  onSelect={setActiveId}
                  emptyLabel={t("Nothing here", "اینجا چیزی نیست")}
                />
                <DashCard
                  title={t("Blocked", "مسدود")}
                  items={dashboard.blocked}
                  onSelect={setActiveId}
                  emptyLabel={t("Nothing here", "اینجا چیزی نیست")}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("Upcoming deadlines", "مهلت‌های پیش‌رو")}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {dashboard.upcomingDeadlines.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className="text-left text-sm hover:underline"
                          onClick={() => setActiveId(t.id)}
                        >
                          {t.title}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {t.dueDate
                              ? new Date(t.dueDate).toLocaleDateString()
                              : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                    {!dashboard.upcomingDeadlines.length ? (
                      <li className="text-sm text-muted-foreground">{t("Clear week", "هفته خالی")}</li>
                    ) : null}
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("Campaign / project health", "سلامت کمپین / پروژه")}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {dashboard.campaignProgress.map((p) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <span>{p.title}</span>
                        <Badge variant="secondary">{p.health}</Badge>
                      </li>
                    ))}
                    {!dashboard.campaignProgress.length ? (
                      <li className="text-muted-foreground">{t("No projects yet", "هنوز پروژه‌ای نیست")}</li>
                    ) : null}
                  </ul>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Completed this week · {dashboard.completedThisWeek}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("AI workload", "بار کاری هوش مصنوعی")}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void assist("workload")}
                  >
                    <Sparkles className="size-3.5" />
                    {t("Refresh", "بازخوانی")}
                  </Button>
                </div>
                <ul className="space-y-2 text-sm">
                  {dashboard.workload.map((w) => (
                    <li key={w.userId} className="flex justify-between gap-2">
                      <span>{w.name}</span>
                      <span className="text-muted-foreground">
                        {w.estimatedMinutes}m
                        {w.overloaded ? " · overloaded" : w.free ? " · free" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {view === "list" ? (
            <div className="mx-auto max-w-3xl space-y-2">
              {tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left",
                    active?.id === t.id
                      ? "border-sky-400/40 bg-sky-400/10"
                      : "border-white/5",
                  )}
                >
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {taskTypeLabel(t.type)} · {t.source}
                    </p>
                  </div>
                  <Badge variant="secondary">{taskStatusLabel(t.status)}</Badge>
                </button>
              ))}
            </div>
          ) : null}

          {view === "kanban" ? (
            <div className="flex min-h-full gap-3 overflow-x-auto pb-4">
              {KANBAN_COLUMNS.map((col) => (
                <div
                  key={col}
                  className="w-64 shrink-0 rounded-xl border border-white/5 bg-white/[0.02] p-2"
                >
                  <p className="mb-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {taskStatusLabel(col)}
                  </p>
                  <div className="space-y-2">
                    {tasks
                      .filter((t) => t.status === col)
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveId(t.id)}
                          className="w-full rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-left text-sm"
                        >
                          {t.title}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {view === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Priority</th>
                    <th className="px-2 py-2">Owner</th>
                    <th className="px-2 py-2">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr
                      key={t.id}
                      className={cn(
                        "cursor-pointer border-t border-white/5",
                        active?.id === t.id && "bg-sky-400/10",
                      )}
                      onClick={() => setActiveId(t.id)}
                    >
                      <td className="px-2 py-2 font-medium">{t.title}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {taskTypeLabel(t.type)}
                      </td>
                      <td className="px-2 py-2">{taskStatusLabel(t.status)}</td>
                      <td className="px-2 py-2">{t.priority}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {t.owner?.name || t.owner?.email || "—"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {t.dueDate
                          ? new Date(t.dueDate).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-white/5 p-4">
          {!active ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Workflow className="mb-3 size-8 text-sky-300/70" />
              <p className="text-xl">{t("Pick work to execute", "کاری برای اجرا انتخاب کنید")}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Or convert a Decision Center recommendation with Create Task.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <Badge className="mb-2">{taskTypeLabel(active.type)}</Badge>
                <h2 className="text-2xl leading-tight">{active.title}</h2>
                {active.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {active.description}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Source · {active.source}
                  {active.project ? ` · ${active.project.title}` : ""}
                </p>
              </div>

              {active.nextAction ? (
                <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-sky-200/70">
                    Next action
                  </p>
                  <p className="mt-1 text-sm">{active.nextAction}</p>
                </div>
              ) : null}

              {active.blockedReason ? (
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-sm">
                  Blocked · {active.blockedReason}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {TASK_STATUSES.filter((s) => s.key !== "ARCHIVED").map((s) => (
                  <Button
                    key={s.key}
                    size="sm"
                    variant={active.status === s.key ? "default" : "outline"}
                    disabled={busy}
                    onClick={() => void setStatus(s.key)}
                  >
                    {s.key === "DONE" ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <CircleDashed className="size-3.5" />
                    )}
                    {s.label}
                  </Button>
                ))}
              </div>

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Assign
                </p>
                <div className="flex flex-wrap gap-1">
                  {members.map((m) => (
                    <Button
                      key={m.id}
                      size="sm"
                      variant={active.owner?.id === m.id ? "default" : "outline"}
                      disabled={busy}
                      onClick={() => void assign(m.id)}
                    >
                      {m.name || m.email}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  AI assist
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ["breakdown", "Break down"],
                    ["estimate", "Estimate"],
                    ["next_action", "Next action"],
                    ["blockers", "Blockers"],
                    ["order", "Order"],
                  ].map(([mode, label]) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void assist(mode)}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {active.subtasks.length ? (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Pipeline
                  </p>
                  <ol className="space-y-1 text-sm">
                    {active.subtasks.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <span>{s.title}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {taskStatusLabel(s.status)}
                        </Badge>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {active.blockedBy.length ? (
                <div className="text-sm text-muted-foreground">
                  Depends on{" "}
                  {active.blockedBy.map((d) => d.fromTask.title).join(", ")}
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Comments
                </p>
                <div className="space-y-2">
                  {active.comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-white/5 px-2 py-1.5 text-sm"
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {c.author?.name || c.author?.email || "Someone"}
                      </p>
                      <p>{c.body}</p>
                    </div>
                  ))}
                </div>
                <Textarea
                  className="mt-2"
                  rows={2}
                  placeholder="Comment or @mention…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button
                  className="mt-2"
                  size="sm"
                  disabled={busy}
                  onClick={() => void sendComment()}
                >
                  Comment
                </Button>
              </div>

              {active.activities.length ? (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Activity
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {active.activities.map((a) => (
                      <li key={a.id}>
                        {a.message}
                        <span className="ml-2 opacity-60">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                {TASK_PRIORITIES.map((p) => (
                  <span key={p.key}>
                    {p.key === active.priority ? `● ${p.label}` : p.label}
                  </span>
                ))}
                {" · "}
                {TASK_TYPES.find((t) => t.key === active.type)?.label}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function DashCard({
  title,
  items,
  onSelect,
  emptyLabel = "Nothing here",
}: {
  title: string;
  items: Task[];
  onSelect: (id: string) => void;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.slice(0, 5).map((task) => (
          <li key={task.id}>
            <button
              type="button"
              className="text-start text-sm hover:underline"
              onClick={() => onSelect(task.id)}
            >
              {task.title}
            </button>
          </li>
        ))}
        {!items.length ? (
          <li className="text-sm text-muted-foreground">
            {emptyLabel}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
