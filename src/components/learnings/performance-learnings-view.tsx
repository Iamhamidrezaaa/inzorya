"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageCopy } from "@/i18n/use-page-copy";
import { cn } from "@/lib/utils";

type Learning = {
  id: string;
  platform: string | null;
  dimension: string;
  type: string;
  statement: string;
  rationale: string;
  confidence: string;
  sampleSize: number;
  metric: string;
  periodFrom: string | null;
  periodTo: string | null;
  lastObservedAt: string;
  status: string;
  outlierPresent: boolean;
  limitations: string[];
  evidenceCount?: number;
  usefulFeedback: boolean | null;
};

type Evidence = {
  id: string;
  summary: string;
  metric: string;
  value: number | null;
  period: string | null;
};

export function PerformanceLearningsView({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const copy = usePageCopy("learnings");
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [selected, setSelected] = useState<Learning | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<string | null>(null);

  const qs = new URLSearchParams({ workspaceSlug, brandSlug });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/learning?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLearnings(data.learnings || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, brandSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAnalyze() {
    setBusy(true);
    setAnalyzeStatus(null);
    try {
      const res = await fetch("/api/learning/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, brandSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analyze failed");
      setAnalyzeStatus(data.status);
      if (data.status === "READY") {
        toast.success(`${data.learnings?.length || 0} یافته به‌روز شد`);
      } else {
        toast.message(data.status, {
          description: (data.limitations || []).slice(0, 2).join(" · "),
        });
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(row: Learning) {
    setSelected(row);
    try {
      const res = await fetch(`/api/learning/${row.id}/evidence?${qs}`);
      const data = await res.json();
      if (res.ok) setEvidence(data.evidence || []);
      else setEvidence([]);
    } catch {
      setEvidence([]);
    }
  }

  async function archive(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/learning/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, brandSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Archive failed");
      toast.success("آرشیو شد");
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function feedback(id: string, useful: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/learning/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, brandSlug, useful }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Feedback failed");
      setSelected(data.learning);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <Button size="sm" disabled={busy} onClick={() => void runAnalyze()}>
            تحلیل
          </Button>
        }
      />

      {analyzeStatus ? (
        <p className="text-sm text-muted-foreground">
          آخرین وضعیت تحلیل: {analyzeStatus}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : learnings.length === 0 ? (
        <div className="rounded-xl border border-border/80 p-8 text-center">
          <h2 className="text-base font-medium">{copy.emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.emptyDescription}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            {learnings.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => void openDetail(l)}
                className={cn(
                  "w-full rounded-xl border border-border/80 p-4 text-start transition hover:bg-accent/30",
                  selected?.id === l.id && "border-foreground/30 bg-accent/20",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{l.dimension}</Badge>
                  <Badge variant="secondary">{l.type}</Badge>
                  <Badge>{l.confidence}</Badge>
                  <Badge variant="outline">{l.status}</Badge>
                  {l.platform ? (
                    <span className="text-xs text-muted-foreground">
                      {l.platform}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium">{l.statement}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sample: {l.sampleSize} · Metric: {l.metric}
                  {l.periodFrom
                    ? ` · Period: ${l.periodFrom.slice(0, 10)} → ${l.periodTo?.slice(0, 10) || "—"}`
                    : ""}
                </p>
              </button>
            ))}
          </div>

          <section className="rounded-xl border border-border/80 p-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                یک یافته را برای جزئیات و شواهد انتخاب کنید.
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                <h3 className="font-medium">{selected.statement}</h3>
                <p className="text-muted-foreground">{selected.rationale}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Sample: {selected.sampleSize}</div>
                  <div>Metric: {selected.metric}</div>
                  <div>Confidence: {selected.confidence}</div>
                  <div>Status: {selected.status}</div>
                  <div>
                    Last observed:{" "}
                    {new Date(selected.lastObservedAt).toLocaleString()}
                  </div>
                  <div>
                    Outlier: {selected.outlierPresent ? "yes" : "no"}
                  </div>
                </div>
                {selected.limitations.length > 0 ? (
                  <ul className="list-disc ps-4 text-xs text-muted-foreground">
                    {selected.limitations.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : null}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Evidence
                  </p>
                  <ul className="space-y-1 text-xs">
                    {evidence.map((e) => (
                      <li key={e.id} className="rounded-md border border-border/50 px-2 py-1">
                        {e.summary}
                        {e.value != null ? ` · ${e.value}` : ""}
                        {e.period ? ` · ${e.period}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void feedback(selected.id, true)}
                  >
                    Useful
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void feedback(selected.id, false)}
                  >
                    Not useful
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || selected.status === "ARCHIVED"}
                    onClick={() => void archive(selected.id)}
                  >
                    Archive
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
