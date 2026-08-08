"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Filter } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/shared/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { ContentDraftStatus } from "@prisma/client";

type DraftListItem = {
  id: string;
  topic: string;
  channel: string;
  format: string;
  objective: string | null;
  status: ContentDraftStatus;
  updatedAt: string;
  contentPayload?: {
    primaryHook?: string;
    caption?: string;
  };
};

const STATUS_FILTERS: { key: string; label: string; status?: string }[] = [
  { key: "all", label: "همه" },
  { key: "IN_REVIEW", label: "نیاز به بررسی", status: "IN_REVIEW" },
  { key: "CHANGES_REQUESTED", label: "اصلاح خواسته‌شده", status: "CHANGES_REQUESTED" },
  { key: "APPROVED", label: "تأییدشده", status: "APPROVED" },
  { key: "READY", label: "آماده", status: "READY" },
  { key: "DRAFT", label: "پیش‌نویس", status: "DRAFT" },
];

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

export function ContentWorkspaceList({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const { locale } = useI18n();
  const router = useRouter();
  const base = `/w/${workspaceSlug}/b/${brandSlug}/content-workspace`;
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("");
  const [format, setFormat] = useState("");
  const [objective, setObjective] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
    });
    const filter = STATUS_FILTERS.find((f) => f.key === status);
    if (filter?.status) params.set("status", filter.status);
    if (channel.trim()) params.set("channel", channel.trim());
    if (format.trim()) params.set("format", format.trim());
    if (objective.trim()) params.set("objective", objective.trim());
    if (q.trim()) params.set("q", q.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [
    workspaceSlug,
    brandSlug,
    status,
    channel,
    format,
    objective,
    q,
    from,
    to,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-drafts?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setDrafts(
        (data.drafts || []).map((d: DraftListItem & { updatedAt: string | Date }) => ({
          ...d,
          updatedAt:
            typeof d.updatedAt === "string"
              ? d.updatedAt
              : new Date(d.updatedAt).toISOString(),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6" dir={locale === "fa" ? "rtl" : "ltr"}>
      <PageHeader
        title="فضای کار محتوا"
        description="بازبینی، ویرایش و تأیید محتوای پیشنهادی هوش مصنوعی — بدون انتشار خودکار."
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={status === f.key ? "default" : "outline"}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-border/80 bg-card/40 p-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="md:col-span-2 lg:col-span-2">
          <Input
            placeholder="جستجو: موضوع، کپشن، هوک…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Input
          placeholder="کانال"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        />
        <Input
          placeholder="فرمت"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        />
        <Input
          placeholder="هدف"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
        <div className="flex gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : drafts.length === 0 ? (
        <EmptyState
          title="هنوز پیش‌نویسی نیست"
          description="خروجی Creator را از مسیر کنترل‌شده به این فضای کار اضافه کنید."
        />
      ) : (
        <ul className="space-y-2">
          {drafts.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => router.push(`${base}/${d.id}`)}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-xl border border-border/80 bg-card px-4 py-3 text-start",
                  "transition-colors hover:bg-accent/40",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <span className="font-medium tracking-tight">{d.topic}</span>
                  </div>
                  <Badge variant="secondary">{statusLabel(d.status)}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{d.channel}</span>
                  <span>·</span>
                  <span>{d.format}</span>
                  {d.objective ? (
                    <>
                      <span>·</span>
                      <span>{d.objective}</span>
                    </>
                  ) : null}
                </div>
                {d.contentPayload?.primaryHook ? (
                  <p className="line-clamp-2 text-sm text-foreground/90">
                    {d.contentPayload.primaryHook}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Filter className="size-3.5" />
        <Link href={`/w/${workspaceSlug}/b/${brandSlug}/content`} className="underline-offset-2 hover:underline">
          بازگشت به هاب محتوا
        </Link>
      </div>
    </div>
  );
}
