"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import type { ContentDraftStatus } from "@prisma/client";
import type { ContentDraftPayload } from "@/server/content-workspace/types";

type EvidenceItem = { type: string; reference?: string; summary: string };

type DraftDetail = {
  id: string;
  topic: string;
  channel: string;
  format: string;
  status: ContentDraftStatus;
  objective: string | null;
  audience: string | null;
  pillar: string | null;
  angle: string | null;
  whyNow: string | null;
  evidence: EvidenceItem[] | null;
  blueprintReference: {
    summary?: string;
    strategySummary?: string;
    primaryObjective?: string;
    planItemId?: string;
  } | null;
  contentPayload: ContentDraftPayload;
  currentVersion: number;
};

type VersionRow = {
  id: string;
  version: number;
  source: string;
  changeSummary: string | null;
  component: string | null;
  createdAt: string;
};

type ReviewRow = {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
};

function statusLabel(status: ContentDraftStatus) {
  switch (status) {
    case "DRAFT":
      return "پیش‌نویس";
    case "IN_REVIEW":
      return "در بررسی";
    case "CHANGES_REQUESTED":
      return "اصلاح خواسته‌شده";
    case "APPROVED":
      return "تأییدشده";
    case "READY":
      return "آماده";
    default:
      return status;
  }
}

const REGEN_COMPONENTS = [
  { key: "hook", label: "هوک" },
  { key: "script", label: "اسکریپت" },
  { key: "caption", label: "کپشن" },
  { key: "cta", label: "CTA" },
  { key: "cover", label: "کاور" },
  { key: "visual_direction", label: "جهت بصری" },
] as const;

export function ContentWorkspaceDetail({
  workspaceSlug,
  brandSlug,
  draftId,
}: {
  workspaceSlug: string;
  brandSlug: string;
  draftId: string;
}) {
  const { locale } = useI18n();
  const router = useRouter();
  const listHref = `/w/${workspaceSlug}/b/${brandSlug}/content-workspace`;
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [pubStatus, setPubStatus] = useState<{
    status: string;
    publication?: {
      id: string;
      status: string;
      externalPostId?: string | null;
      failureMessageSafe?: string | null;
    } | null;
  } | null>(null);
  const [performance, setPerformance] = useState<{
    available: boolean;
    reason?: string;
    lastUpdatedAt?: string | null;
    metrics?: {
      impressions: number | null;
      likes: number | null;
      comments: number | null;
      reach: number | null;
      engagements: number | null;
    } | null;
  } | null>(null);
  const [publishPreview, setPublishPreview] = useState<{
    ok: boolean;
    preview?: {
      platform: string;
      accountName: string | null;
      caption: string;
      scheduledAt: string | null;
      publishingCapability: boolean;
      draftStatus: string;
      scheduleStatus: string;
    };
    errors?: Array<{ code: string; message: string }>;
    contentScheduleId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    primaryHook: "",
    caption: "",
    cta: "",
    visualDirection: "",
    productionNotes: "",
    coverText: "",
  });
  const [regenInstruction, setRegenInstruction] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ workspaceSlug, brandSlug });
      const res = await fetch(`/api/content-drafts/${draftId}?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const d = data.draft as DraftDetail;
      setDraft(d);
      setVersions(data.versions || []);
      setReviews(data.reviews || []);
      setEditForm({
        primaryHook: d.contentPayload.primaryHook || "",
        caption: d.contentPayload.caption || "",
        cta: d.contentPayload.cta || "",
        visualDirection: d.contentPayload.visualDirection || "",
        productionNotes: (d.contentPayload.productionNotes || []).join("\n"),
        coverText: d.contentPayload.cover?.text || "",
      });

      // Publishing status (derived from SocialPublication — separate from draft status)
      try {
        const pubRes = await fetch(
          `/api/publishing?${params}&draftId=${draftId}`,
        );
        // fallback: list and filter
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          const pubs = (pubData.publications || []).filter(
            (p: { contentDraftId: string }) => p.contentDraftId === draftId,
          );
          if (pubs.some((p: { status: string }) => p.status === "PUBLISHED")) {
            const published = pubs.find(
              (p: { status: string }) => p.status === "PUBLISHED",
            );
            setPubStatus({
              status: "PUBLISHED",
              publication: published,
            });
            if (published?.id) {
              try {
                const perfRes = await fetch(
                  `/api/social/analytics/${published.id}?${params}`,
                );
                if (perfRes.ok) {
                  const perf = await perfRes.json();
                  setPerformance({
                    available: Boolean(perf.available),
                    reason: perf.reason,
                    lastUpdatedAt: perf.lastUpdatedAt ?? null,
                    metrics: perf.metrics ?? null,
                  });
                } else {
                  setPerformance({
                    available: false,
                    reason: "Analytics unavailable",
                  });
                }
              } catch {
                setPerformance({
                  available: false,
                  reason: "Analytics unavailable",
                });
              }
            }
          } else if (pubs[0]) {
            setPerformance(null);
            setPubStatus({
              status: pubs[0].status === "FAILED" ? "FAILED" : pubs[0].status,
              publication: pubs[0],
            });
          } else {
            setPerformance(null);
            setPubStatus({ status: "NOT_PUBLISHED", publication: null });
          }
        }
      } catch {
        setPubStatus({ status: "NOT_PUBLISHED", publication: null });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, brandSlug, draftId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runReview(action: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-drafts/${draftId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          brandSlug,
          action,
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Review failed");
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          brandSlug,
          edit: {
            primaryHook: editForm.primaryHook,
            caption: editForm.caption,
            cta: editForm.cta,
            visualDirection: editForm.visualDirection,
            productionNotes: editForm.productionNotes
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            cover: {
              ...(draft?.contentPayload.cover || {}),
              text: editForm.coverText,
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Edit failed");
      setEditMode(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(component: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-drafts/${draftId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          brandSlug,
          component,
          instruction: regenInstruction || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regenerate failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function loadPublishPreview() {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        workspaceSlug,
        brandSlug,
        status: "SCHEDULED",
      });
      const plansRes = await fetch(`/api/content-plans?${params}`);
      const plansData = await plansRes.json();
      if (!plansRes.ok) throw new Error(plansData.error || "Failed");
      const plan = (plansData.plans || []).find(
        (p: { contentDraftId: string; status: string }) =>
          p.contentDraftId === draftId && p.status === "SCHEDULED",
      );
      if (!plan) {
        setPublishPreview({
          ok: false,
          errors: [
            {
              code: "INVALID_STATUS",
              message: "No SCHEDULED plan found for this content.",
            },
          ],
        });
        return;
      }
      const res = await fetch("/api/publishing/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          brandSlug,
          contentScheduleId: plan.id,
          socialAccountId: plan.socialAccountId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Validate failed");
      setPublishPreview({ ...data, contentScheduleId: plan.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  async function publishNow() {
    if (!publishPreview?.contentScheduleId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/publishing/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          brandSlug,
          contentScheduleId: publishPreview.contentScheduleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      if (data.publication?.status === "PUBLISHED") {
        setPubStatus({ status: "PUBLISHED", publication: data.publication });
      } else if (data.error || data.publication?.status === "FAILED") {
        setPubStatus({
          status: "FAILED",
          publication: data.publication,
        });
        setError(
          data.error?.message ||
            data.publication?.failureMessageSafe ||
            "Publishing failed.",
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>;
  }
  if (!draft) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error || "یافت نشد"}</p>
        <Button variant="outline" onClick={() => router.push(listHref)}>
          بازگشت
        </Button>
      </div>
    );
  }

  const p = draft.contentPayload;
  const status = draft.status;

  return (
    <div className="space-y-8" dir={locale === "fa" ? "rtl" : "ltr"}>
      <PageHeader
        breadcrumb={
          <Link href={listHref} className="hover:underline">
            فضای کار محتوا
          </Link>
        }
        title={draft.topic}
        description={`${draft.channel} · ${draft.format}`}
        actions={<Badge variant="secondary">{statusLabel(status)}</Badge>}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(status === "DRAFT" || status === "CHANGES_REQUESTED") && (
          <Button disabled={busy} onClick={() => void runReview("send_for_review")}>
            ارسال برای بررسی
          </Button>
        )}
        {status === "IN_REVIEW" && (
          <>
            <Button disabled={busy} onClick={() => void runReview("approve")}>
              تأیید
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => void runReview("request_changes")}
            >
              درخواست اصلاح
            </Button>
          </>
        )}
        {status === "APPROVED" && (
          <Button disabled={busy} onClick={() => void runReview("mark_ready")}>
            علامت‌گذاری آماده
          </Button>
        )}
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => setEditMode((v) => !v)}
        >
          {editMode ? "لغو ویرایش" : "ویرایش"}
        </Button>
      </div>

      <section className="space-y-3 rounded-xl border border-border/80 bg-card p-5">
        <h2 className="text-sm font-medium text-muted-foreground">استراتژی</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">هدف</dt>
            <dd>{draft.objective || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">مخاطب</dt>
            <dd>{draft.audience || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ستون</dt>
            <dd>{draft.pillar || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">زاویه</dt>
            <dd>{draft.angle || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">چرا الان</dt>
            <dd>{draft.whyNow || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-primary/20 bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">محتوا</h2>
          <span className="text-xs text-muted-foreground">
            نسخه {draft.currentVersion}
          </span>
        </div>

        {editMode ? (
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">هوک</span>
              <Input
                value={editForm.primaryHook}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, primaryHook: e.target.value }))
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">کپشن</span>
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={editForm.caption}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, caption: e.target.value }))
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">CTA</span>
              <Input
                value={editForm.cta}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, cta: e.target.value }))
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">متن کاور</span>
              <Input
                value={editForm.coverText}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, coverText: e.target.value }))
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">جهت بصری</span>
              <Input
                value={editForm.visualDirection}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    visualDirection: e.target.value,
                  }))
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">یادداشت تولید (هر خط یک مورد)</span>
              <textarea
                className="min-h-20 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                value={editForm.productionNotes}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    productionNotes: e.target.value,
                  }))
                }
              />
            </label>
            <Button disabled={busy} onClick={() => void saveEdit()}>
              ذخیره نسخه جدید
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">هوک</p>
              <p className="mt-1 text-base font-medium leading-relaxed">
                {p.primaryHook || "—"}
              </p>
            </div>
            {p.script?.scenes?.length ? (
              <div>
                <p className="text-muted-foreground">اسکریپت</p>
                <ol className="mt-2 list-decimal space-y-2 ps-5">
                  {p.script.scenes.map((s) => (
                    <li key={s.order}>
                      {s.voiceover || s.onScreenText || s.visual || "—"}
                    </li>
                  ))}
                </ol>
                {p.script.ending ? (
                  <p className="mt-2 text-muted-foreground">پایان: {p.script.ending}</p>
                ) : null}
              </div>
            ) : null}
            {p.carousel?.slides?.length ? (
              <div>
                <p className="text-muted-foreground">اسلایدها</p>
                <ol className="mt-2 list-decimal space-y-2 ps-5">
                  {p.carousel.slides.map((s) => (
                    <li key={s.order}>{s.copy || s.purpose || "—"}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            <div>
              <p className="text-muted-foreground">کپشن</p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                {p.caption || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">CTA</p>
              <p className="mt-1">{p.cta || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">کاور</p>
              <p className="mt-1">
                {p.cover?.text || p.cover?.concept || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">جهت بصری</p>
              <p className="mt-1">{p.visualDirection || "—"}</p>
            </div>
            {p.productionNotes?.length ? (
              <div>
                <p className="text-muted-foreground">یادداشت تولید</p>
                <ul className="mt-1 list-disc ps-5">
                  {p.productionNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {(status === "DRAFT" || status === "CHANGES_REQUESTED") && (
        <section className="space-y-3 rounded-xl border border-border/80 p-5">
          <h2 className="text-sm font-medium">بازتولید بخشی</h2>
          <Input
            placeholder="دستور اختیاری (مثلاً رسمی‌تر و کوتاه‌تر)"
            value={regenInstruction}
            onChange={(e) => setRegenInstruction(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {REGEN_COMPONENTS.map((c) => (
              <Button
                key={c.key}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void regenerate(c.key)}
              >
                بازتولید {c.label}
              </Button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border/80 p-5">
        <h2 className="text-sm font-medium text-muted-foreground">انتشار</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>وضعیت انتشار:</span>
          <Badge variant="secondary">
            {pubStatus?.status === "PUBLISHED"
              ? "منتشرشده"
              : pubStatus?.status === "FAILED"
                ? "ناموفق"
                : pubStatus?.status === "PUBLISHING"
                  ? "در حال انتشار"
                  : pubStatus?.status === "SCHEDULED"
                    ? "زمان‌بندی‌شده"
                    : "منتشرنشده"}
          </Badge>
          {pubStatus?.publication?.externalPostId ? (
            <span className="text-xs text-muted-foreground">
              Post ID: {pubStatus.publication.externalPostId}
            </span>
          ) : null}
        </div>
        {pubStatus?.status === "PUBLISHED" ? (
          <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1">
            <p className="text-xs font-medium text-muted-foreground">عملکرد</p>
            {performance?.available && performance.metrics ? (
              <>
                <p>
                  {[
                    performance.metrics.impressions != null
                      ? `${performance.metrics.impressions.toLocaleString()} impressions`
                      : null,
                    performance.metrics.likes != null
                      ? `${performance.metrics.likes.toLocaleString()} likes`
                      : null,
                    performance.metrics.comments != null
                      ? `${performance.metrics.comments.toLocaleString()} comments`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Metrics collected (partial)"}
                </p>
                {performance.lastUpdatedAt ? (
                  <p className="text-xs text-muted-foreground">
                    آخرین به‌روزرسانی:{" "}
                    {new Date(performance.lastUpdatedAt).toLocaleString()}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">Analytics unavailable</p>
            )}
          </div>
        ) : null}
        {pubStatus?.publication?.failureMessageSafe ? (
          <p className="text-sm text-destructive">
            {pubStatus.publication.failureMessageSafe}
          </p>
        ) : null}
        {status === "READY" ? (
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void loadPublishPreview()}
            >
              پیش‌نمایش انتشار
            </Button>
            {publishPreview ? (
              <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1">
                <p>
                  پلتفرم: {publishPreview.preview?.platform || "—"} · حساب:{" "}
                  {publishPreview.preview?.accountName || "—"}
                </p>
                <p className="line-clamp-3 text-muted-foreground">
                  {publishPreview.preview?.caption || "—"}
                </p>
                <p>
                  زمان: {publishPreview.preview?.scheduledAt || "—"} · قابلیت
                  انتشار:{" "}
                  {publishPreview.preview?.publishingCapability
                    ? "فعال"
                    : "غیرفعال"}
                </p>
                {!publishPreview.ok ? (
                  <ul className="text-destructive text-xs">
                    {(publishPreview.errors || []).map((e) => (
                      <li key={e.code}>{e.message}</li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  size="sm"
                  disabled={
                    busy ||
                    !publishPreview.ok ||
                    !publishPreview.preview?.publishingCapability ||
                    !publishPreview.contentScheduleId
                  }
                  onClick={() => void publishNow()}
                >
                  انتشار
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">شواهد</h2>
        {draft.evidence?.length ? (
          <ul className="space-y-2">
            {draft.evidence.map((e, i) => (
              <li
                key={`${e.type}-${i}`}
                className="rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <span className="font-medium">{e.type}</span>
                <span className="text-muted-foreground"> — {e.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">شواهد ساختاری ثبت نشده.</p>
        )}
        {draft.blueprintReference ? (
          <div className="rounded-lg border border-border/60 px-3 py-2 text-sm">
            <p className="font-medium">Blueprint</p>
            <p className="text-muted-foreground">
              {draft.blueprintReference.summary ||
                draft.blueprintReference.strategySummary ||
                draft.blueprintReference.planItemId ||
                "—"}
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">بررسی و یادداشت</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="یادداشت بازبین…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={busy || !note.trim()}
            onClick={() => void runReview("note")}
          >
            ثبت یادداشت
          </Button>
        </div>
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <div className="flex justify-between gap-2">
                <Badge variant="outline">{r.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              {r.note ? <p className="mt-1">{r.note}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">تاریخچه نسخه‌ها</h2>
        <ul className="space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span>
                v{v.version} · {v.source}
                {v.component ? ` · ${v.component}` : ""}
                {v.changeSummary ? ` — ${v.changeSummary}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(v.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
