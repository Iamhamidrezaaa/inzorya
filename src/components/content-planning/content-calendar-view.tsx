"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type PlanRow = {
  id: string;
  contentDraftId: string;
  channel: string;
  plannedDate: string;
  plannedTime: string;
  timezone: string;
  status: "PLANNED" | "SCHEDULED" | "CANCELLED";
  planningSource: "AI" | "HUMAN";
  publishable: boolean;
  publishabilityReason: string | null;
  rationale: string | null;
  contentDraft?: {
    topic: string;
    format: string;
    channel: string;
    contentPayload?: { primaryHook?: string; caption?: string };
  };
  publicationStatus?: string | null;
  hasPerformance?: boolean;
};

type Conflict = {
  type: string;
  severity: string;
  items: string[];
  message: string;
};

type ViewMode = "week" | "month" | "list";

function statusLabel(s: string) {
  switch (s) {
    case "PLANNED":
      return "برنامه‌ریزی‌شده";
    case "SCHEDULED":
      return "تأیید زمان‌بندی";
    case "CANCELLED":
      return "لغو";
    default:
      return s;
  }
}

export function ContentCalendarView({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const { locale } = useI18n();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [proposeMsg, setProposeMsg] = useState(
    "برای هفته آینده برنامه زمانی داخلی پیشنهاد بده.",
  );
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 6 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 6 });
      return { from: start, to: end };
    }
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 6 });
      return { from: start, to: endOfWeek(cursor, { weekStartsOn: 6 }) };
    }
    const start = startOfMonth(cursor);
    return { from: start, to: endOfMonth(cursor) };
  }, [cursor, view]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      from: format(range.from, "yyyy-MM-dd"),
      to: format(range.to, "yyyy-MM-dd"),
    });
    const res = await fetch(`/api/content-plans?${params}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "خطا");
      return;
    }
    setPlans(
      (data.plans || []).map((p: PlanRow & { plannedDate: string | Date }) => ({
        ...p,
        plannedDate:
          typeof p.plannedDate === "string"
            ? p.plannedDate.slice(0, 10)
            : format(new Date(p.plannedDate), "yyyy-MM-dd"),
      })),
    );
    setConflicts(data.conflicts || []);

    try {
      const pubParams = new URLSearchParams({ workspaceSlug, brandSlug });
      const pubRes = await fetch(`/api/publishing?${pubParams}`);
      if (pubRes.ok) {
        const pubData = await pubRes.json();
        const bySchedule = new Map<
          string,
          { status: string; publicationId?: string }
        >();
        for (const pub of pubData.publications || []) {
          const cur = bySchedule.get(pub.contentScheduleId);
          if (pub.status === "PUBLISHED") {
            bySchedule.set(pub.contentScheduleId, {
              status: "PUBLISHED",
              publicationId: pub.id,
            });
          } else if (!cur && pub.status === "FAILED") {
            bySchedule.set(pub.contentScheduleId, { status: "FAILED" });
          } else if (!cur) {
            bySchedule.set(pub.contentScheduleId, { status: pub.status });
          }
        }

        let metricPubIds = new Set<string>();
        try {
          const analyticsRes = await fetch(
            `/api/social/analytics?${pubParams}&limit=100`,
          );
          if (analyticsRes.ok) {
            const analytics = await analyticsRes.json();
            metricPubIds = new Set(
              (analytics.items || [])
                .map((i: { socialPublicationId?: string | null }) =>
                  i.socialPublicationId,
                )
                .filter(Boolean),
            );
          }
        } catch {
          /* optional performance indicator */
        }

        setPlans((prev) =>
          prev.map((p) => {
            const row = bySchedule.get(p.id);
            return {
              ...p,
              publicationStatus: row?.status || null,
              hasPerformance: Boolean(
                row?.publicationId && metricPubIds.has(row.publicationId),
              ),
            };
          }),
        );
      }
    } catch {
      /* ignore */
    }
  }, [workspaceSlug, brandSlug, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = eachDayOfInterval({ start: range.from, end: range.to });

  function plansForDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    return plans.filter((p) => p.plannedDate === key && p.status !== "CANCELLED");
  }

  async function confirm(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/content-plans/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, brandSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Confirm failed");
      toast.success("زمان‌بندی تأیید شد (SCHEDULED). انتشار خارجی انجام نشد.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/content-plans/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, brandSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancel failed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function reschedule(id: string, plannedDate: string, plannedTime?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/content-plans/${id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          brandSlug,
          plannedDate,
          plannedTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reschedule failed");
      toast.success("جابه‌جایی دستی ثبت شد (HUMAN).");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function propose() {
    setBusy(true);
    try {
      const res = await fetch("/api/content-plans/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          brandSlug,
          message: proposeMsg,
          timezone: "Asia/Tehran",
          persist: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Propose failed");
      toast.success("پیشنهاد AI به‌عنوان PLANNED ذخیره شد — تأیید انسانی لازم است.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  const selectedPlans = selectedDay ? plansForDay(selectedDay) : [];

  return (
    <div className="space-y-6" dir={locale === "fa" ? "rtl" : "ltr"}>
      <PageHeader
        title="تقویم محتوا"
        description="برنامه‌ریزی و زمان‌بندی داخلی برای محتوای READY. انتشار روی شبکه‌های اجتماعی انجام نمی‌شود."
      />

      <div className="flex flex-wrap items-center gap-2">
        {(["week", "month", "list"] as ViewMode[]).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? "default" : "outline"}
            onClick={() => setView(v)}
          >
            {v === "week" ? "هفته" : v === "month" ? "ماه" : "لیست"}
          </Button>
        ))}
        <div className="ms-auto flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() =>
              setCursor((c) =>
                view === "month" ? addMonths(c, -1) : addDays(c, -7),
              )
            }
          >
            <ChevronRight className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            {format(cursor, view === "month" ? "MMMM yyyy" : "dd MMM yyyy")}
          </span>
          <Button
            size="icon"
            variant="outline"
            onClick={() =>
              setCursor((c) =>
                view === "month" ? addMonths(c, 1) : addDays(c, 7),
              )
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border/80 p-4 sm:flex-row">
        <Input
          value={proposeMsg}
          onChange={(e) => setProposeMsg(e.target.value)}
          placeholder="دستور برنامه‌ریزی…"
        />
        <Button disabled={busy} onClick={() => void propose()}>
          پیشنهاد AI
        </Button>
      </div>

      {conflicts.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="text-sm font-medium">تداخل‌ها</h3>
          {conflicts.map((c, i) => (
            <p key={`${c.type}-${i}`} className="text-sm text-muted-foreground">
              {c.message}
            </p>
          ))}
        </div>
      ) : null}

      {view === "list" ? (
        <ul className="space-y-2">
          {plans
            .filter((p) => p.status !== "CANCELLED")
            .map((p) => (
              <li key={p.id}>
                <PlanCard
                  plan={p}
                  busy={busy}
                  onConfirm={() => void confirm(p.id)}
                  onCancel={() => void cancel(p.id)}
                />
              </li>
            ))}
        </ul>
      ) : (
        <div
          className={cn(
            "grid gap-2",
            view === "week" ? "grid-cols-1 sm:grid-cols-7" : "grid-cols-7",
          )}
        >
          {days.map((day) => {
            const dayPlans = plansForDay(day);
            const inMonth = isSameMonth(day, cursor);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-28 rounded-lg border border-border/60 p-2",
                  !inMonth && view === "month" && "opacity-40",
                  selectedDay && isSameDay(selectedDay, day) && "ring-1 ring-primary",
                )}
                onClick={() => setSelectedDay(day)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragId) return;
                  void reschedule(dragId, format(day, "yyyy-MM-dd"));
                  setDragId(null);
                }}
              >
                <div className="mb-2 text-xs text-muted-foreground">
                  {format(day, "EEE d")}
                </div>
                <div className="space-y-1">
                  {dayPlans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      className="w-full rounded-md border border-border/50 bg-card px-1.5 py-1 text-start text-[11px] hover:bg-accent/40"
                    >
                      <div className="font-medium uppercase">
                        {p.contentDraft?.format || "CONTENT"}
                      </div>
                      <div className="line-clamp-2">
                        {p.contentDraft?.topic || p.contentDraftId}
                      </div>
                      <div className="text-muted-foreground">
                        {p.channel} · {p.plannedTime}
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {statusLabel(p.status)}
                      </Badge>
                      {p.publicationStatus === "PUBLISHED" ? (
                        <Badge variant="default" className="mt-1">
                          PUBLISHED
                          {p.hasPerformance ? " · metrics" : ""}
                        </Badge>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDay ? (
        <section className="space-y-3 rounded-xl border border-border/80 p-4">
          <h3 className="text-sm font-medium">
            جزئیات {format(selectedDay, "yyyy-MM-dd")}
          </h3>
          {selectedPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">موردی برای این روز نیست.</p>
          ) : (
            selectedPlans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                busy={busy}
                onConfirm={() => void confirm(p.id)}
                onCancel={() => void cancel(p.id)}
              />
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}

function PlanCard({
  plan,
  busy,
  onConfirm,
  onCancel,
}: {
  plan: PlanRow;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const preview =
    plan.contentDraft?.contentPayload?.primaryHook ||
    plan.contentDraft?.contentPayload?.caption ||
    plan.rationale ||
    "";

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            {plan.contentDraft?.format || "content"} · {plan.channel}
          </p>
          <h4 className="font-medium tracking-tight">
            {plan.contentDraft?.topic || plan.contentDraftId}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.plannedDate} · {plan.plannedTime} ({plan.timezone})
          </p>
          {preview ? (
            <p className="mt-2 line-clamp-2 text-sm">{preview}</p>
          ) : null}
        </div>
        <div className="space-y-1 text-end">
          <Badge variant="secondary">{statusLabel(plan.status)}</Badge>
          <p className="text-[11px] text-muted-foreground">
            {plan.planningSource === "AI" ? "پیشنهاد AI" : "ویرایش انسانی"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {plan.publishable
              ? "قابل انتشار"
              : `انتشار: ${plan.publishabilityReason || "UNAVAILABLE"}`}
          </p>
          {plan.publicationStatus ? (
            <p className="text-[11px] font-medium">
              {plan.publicationStatus === "PUBLISHED"
                ? "منتشرشده"
                : plan.publicationStatus}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {plan.status === "PLANNED" ? (
          <Button size="sm" disabled={busy} onClick={onConfirm}>
            تأیید زمان‌بندی
          </Button>
        ) : null}
        {plan.status !== "CANCELLED" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
            لغو
          </Button>
        ) : null}
      </div>
    </div>
  );
}
