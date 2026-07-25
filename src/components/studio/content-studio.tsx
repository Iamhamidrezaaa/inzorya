"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import {
  CalendarDays,
  Columns3,
  FolderKanban,
  ImageIcon,
  LayoutTemplate,
  Plus,
  Search,
  Shapes,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader, EmptyState } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  CONTENT_FORMATS,
  CONTENT_PRIORITIES,
  PIPELINE_COLUMNS,
  formatLabel,
  statusLabel,
} from "@/lib/content-studio";
import type { ContentStatus } from "@prisma/client";

type StudioItem = {
  id: string;
  title: string;
  description: string | null;
  objective: string | null;
  targetAudience: string | null;
  notes: string | null;
  status: ContentStatus;
  platform: string;
  format: string;
  priority: string;
  campaignId: string | null;
  pillarId: string | null;
  dueDate: string | null;
  scheduledAt: string | null;
  sortOrder: number;
  campaign: { id: string; name: string; color: string | null } | null;
  pillar: { id: string; name: string; color: string | null } | null;
  assignee: { id: string; name: string | null; email: string } | null;
  brief?: {
    goal: string | null;
    hook: string | null;
    problem: string | null;
    solution: string | null;
    cta: string | null;
    targetAudience: string | null;
    references: string | null;
    keywords: string[];
    hashtags: string[];
    competitors: string | null;
  } | null;
  checklist?: { id: string; label: string; done: boolean }[];
  comments?: {
    id: string;
    body: string;
    createdAt: string;
    user: { name: string | null; email: string };
  }[];
  _count?: { comments: number };
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  platforms: string[];
  status: string;
  color: string | null;
  budget: string | null;
  startDate: string | null;
  endDate: string | null;
  _count?: { contents: number };
};

type Pillar = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  archivedAt: string | null;
};

type Template = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};

type MediaItem = {
  id: string;
  originalName: string;
  url: string;
  mimeType: string;
  folder: string | null;
  tags: string[];
  kind: string;
};

type Tab = "pipeline" | "calendar" | "campaigns" | "media" | "templates" | "pillars";

export function ContentStudio({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab | null) || "pipeline";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StudioItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudioItem | null>(null);
  const [filters, setFilters] = useState({
    q: "",
    campaignId: "ALL",
    platform: "ALL",
    priority: "ALL",
    pillarId: "ALL",
  });
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "week" | "agenda" | "list">("month");
  const [dragId, setDragId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newPillarName, setNewPillarName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      ...(filters.campaignId !== "ALL" ? { campaignId: filters.campaignId } : {}),
      ...(filters.platform !== "ALL" ? { platform: filters.platform } : {}),
      ...(filters.priority !== "ALL" ? { priority: filters.priority } : {}),
      ...(filters.pillarId !== "ALL" ? { pillarId: filters.pillarId } : {}),
      ...(filters.q ? { q: filters.q } : {}),
    });
    const [studioRes, mediaRes] = await Promise.all([
      fetch(`/api/studio/content?${params}`),
      fetch(
        `/api/media?workspaceSlug=${encodeURIComponent(workspaceSlug)}&brandSlug=${encodeURIComponent(brandSlug)}`,
      ),
    ]);
    setLoading(false);
    if (!studioRes.ok) {
      toast.error("Could not load studio.");
      return;
    }
    const data = await studioRes.json();
    setItems(data.items ?? []);
    setCampaigns(data.campaigns ?? []);
    setPillars(data.pillars ?? []);
    setTemplates(data.templates ?? []);
    if (mediaRes.ok) {
      const m = await mediaRes.json();
      setMedia(m.assets ?? []);
    }
  }, [workspaceSlug, brandSlug, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void (async () => {
      const params = new URLSearchParams({
        workspaceSlug,
        brandSlug,
        id: selectedId,
      });
      const res = await fetch(`/api/studio/content?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setDetail(data.item);
    })();
  }, [selectedId, workspaceSlug, brandSlug]);

  async function createIdea(templateId?: string) {
    const res = await fetch("/api/studio/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        title: "Untitled idea",
        templateId,
      }),
    });
    if (!res.ok) {
      toast.error("Could not create.");
      return;
    }
    const data = await res.json();
    toast.success("Created");
    await load();
    setSelectedId(data.item.id);
    setTab("pipeline");
  }

  async function moveItem(id: string, status: ContentStatus) {
    setItems((list) =>
      list.map((i) => (i.id === id ? { ...i, status } : i)),
    );
    const res = await fetch("/api/studio/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, id, status }),
    });
    if (!res.ok) {
      toast.error("Move failed.");
      await load();
    }
  }

  async function saveDetail(patch: Record<string, unknown>) {
    if (!detail) return;
    const res = await fetch("/api/studio/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        id: detail.id,
        ...patch,
      }),
    });
    if (!res.ok) {
      toast.error("Save failed.");
      return;
    }
    const data = await res.json();
    setDetail(data.item);
    setItems((list) =>
      list.map((i) => (i.id === data.item.id ? { ...data.item, _count: i._count } : i)),
    );
    toast.success("Saved");
  }

  const columns = useMemo(() => {
    const map = Object.fromEntries(
      PIPELINE_COLUMNS.map((c) => [c.status, [] as StudioItem[]]),
    ) as Record<ContentStatus, StudioItem[]>;
    for (const item of items) {
      if (map[item.status]) map[item.status].push(item);
    }
    return map;
  }, [items]);

  const tabs: { id: Tab; label: string; icon: typeof Columns3 }[] = [
    { id: "pipeline", label: "Pipeline", icon: Columns3 },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "campaigns", label: "Campaigns", icon: FolderKanban },
    { id: "media", label: "Media", icon: ImageIcon },
    { id: "templates", label: "Templates", icon: LayoutTemplate },
    { id: "pillars", label: "Pillars", icon: Shapes },
  ];

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonth)),
    end: endOfWeek(endOfMonth(calendarMonth)),
  });

  if (loading && items.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[480px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Studio"
        description="Ideas to published — the production floor for every future AI agent."
        actions={
          <Button onClick={() => void createIdea()}>
            <Plus className="h-4 w-4" />
            New idea
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-card/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              tab === t.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pipeline" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Filter content…"
                value={filters.q}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, q: e.target.value }))
                }
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters.campaignId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, campaignId: e.target.value }))
              }
            >
              <option value="ALL">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters.platform}
              onChange={(e) =>
                setFilters((f) => ({ ...f, platform: e.target.value }))
              }
            >
              <option value="ALL">All platforms</option>
              {[...new Set(CONTENT_FORMATS.map((f) => f.platform))].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters.priority}
              onChange={(e) =>
                setFilters((f) => ({ ...f, priority: e.target.value }))
              }
            >
              <option value="ALL">All priorities</option>
              {CONTENT_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters.pillarId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, pillarId: e.target.value }))
              }
            >
              <option value="ALL">All pillars</option>
              {pillars.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="No content yet"
              description="Capture an idea. Move it through research, brief, draft, review, and publish — without AI for now."
              actionLabel="New idea"
              onAction={() => void createIdea()}
            />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {PIPELINE_COLUMNS.map((col) => (
                <div
                  key={col.status}
                  className="flex w-72 shrink-0 flex-col rounded-xl border border-border/70 bg-card/40"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) void moveItem(dragId, col.status);
                    setDragId(null);
                  }}
                >
                  <div className="flex items-center justify-between border-b border-border/60 px-3 py-3">
                    <span className="text-sm font-medium tracking-tight">
                      {col.label}
                    </span>
                    <Badge variant="muted">
                      {columns[col.status]?.length ?? 0}
                    </Badge>
                  </div>
                  <ScrollArea className="h-[560px] px-2 py-2">
                    <div className="space-y-2">
                      {(columns[col.status] ?? []).map((item) => (
                        <motion.button
                          key={item.id}
                          type="button"
                          layout
                          draggable
                          onDragStart={() => setDragId(item.id)}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => setSelectedId(item.id)}
                          className={cn(
                            "w-full rounded-xl border border-border/70 bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/30",
                            dragId === item.id && "opacity-60",
                          )}
                        >
                          <div className="text-sm font-medium tracking-tight">
                            {item.title}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {formatLabel(item.format as never)}
                            </Badge>
                            <Badge variant="muted" className="text-[10px]">
                              {item.platform}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {item.priority}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            {item.campaign ? (
                              <span>{item.campaign.name}</span>
                            ) : null}
                            {item.pillar ? <span>{item.pillar.name}</span> : null}
                            {item.dueDate ? (
                              <span>
                                Due {format(new Date(item.dueDate), "MMM d")}
                              </span>
                            ) : null}
                            {item.assignee ? (
                              <span>
                                {item.assignee.name || item.assignee.email}
                              </span>
                            ) : null}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "calendar" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["month", "week", "agenda", "list"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={calendarView === v ? "default" : "outline"}
                onClick={() => setCalendarView(v)}
                className="capitalize"
              >
                {v}
              </Button>
            ))}
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCalendarMonth((d) => subMonths(d, 1))}
              >
                Prev
              </Button>
              <div className="flex h-8 items-center px-2 text-sm font-medium">
                {format(calendarMonth, "MMMM yyyy")}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCalendarMonth((d) => addMonths(d, 1))}
              >
                Next
              </Button>
            </div>
          </div>

          {calendarView === "list" || calendarView === "agenda" ? (
            <ul className="space-y-2">
              {items
                .filter((i) => i.dueDate || i.scheduledAt)
                .sort(
                  (a, b) =>
                    new Date(a.scheduledAt || a.dueDate || 0).getTime() -
                    new Date(b.scheduledAt || b.dueDate || 0).getTime(),
                )
                .map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3 text-left text-sm"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(
                          new Date(item.scheduledAt || item.dueDate!),
                          "MMM d · HH:mm",
                        )}{" "}
                        · {statusLabel(item.status)}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="grid grid-cols-7 gap-1 rounded-xl border border-border/70 p-2">
              {monthDays.map((day) => {
                const dayItems = items.filter((i) => {
                  const d = i.scheduledAt || i.dueDate;
                  return d && isSameDay(new Date(d), day);
                });
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-24 rounded-lg border border-border/40 p-1.5",
                      day.getMonth() !== calendarMonth.getMonth() &&
                        "opacity-40",
                    )}
                  >
                    <div className="text-[11px] text-muted-foreground">
                      {format(day, "d")}
                    </div>
                    <div className="mt-1 space-y-1">
                      {dayItems.slice(0, 3).map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => setSelectedId(i.id)}
                          className="block w-full truncate rounded bg-primary/15 px-1 py-0.5 text-left text-[10px]"
                        >
                          {i.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "campaigns" ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New campaign name"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!newCampaignName.trim()) return;
                const res = await fetch("/api/studio/campaigns", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    workspaceSlug,
                    brandSlug,
                    name: newCampaignName.trim(),
                  }),
                });
                if (!res.ok) toast.error("Failed");
                else {
                  setNewCampaignName("");
                  toast.success("Campaign created");
                  await load();
                }
              }}
            >
              Add
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-border/70 bg-card p-4 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: c.color || "#14b8a6" }}
                  />
                  <h3 className="font-medium tracking-tight">{c.name}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {c.objective || c.description || "No objective yet"}
                </p>
                <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="muted">{c.status}</Badge>
                  <span>{c._count?.contents ?? 0} content</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "media" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Images, videos, documents, and audio for production. Upload from Media
            or attach inside a content card later.
          </p>
          {media.length === 0 ? (
            <EmptyState
              className="min-h-0 py-16"
              title="Media library is empty"
              description="Upload assets to reuse across drafts and briefs."
              actionLabel="Open Media"
              actionHref={`/w/${workspaceSlug}/b/${brandSlug}/media`}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {media.map((m) => (
                <a
                  key={m.id}
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-xl border border-border/70 bg-card"
                >
                  {m.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt={m.originalName}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-xs text-muted-foreground">
                      {m.kind || m.mimeType}
                    </div>
                  )}
                  <div className="truncate px-2 py-2 text-xs">{m.originalName}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "templates" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-border/70 bg-card p-4 shadow-xs"
            >
              <h3 className="font-medium tracking-tight">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.category || t.description || "Reusable production template"}
              </p>
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                onClick={() => void createIdea(t.id)}
              >
                Use template
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "pillars" ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New pillar"
              value={newPillarName}
              onChange={(e) => setNewPillarName(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!newPillarName.trim()) return;
                await fetch("/api/studio/pillars", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    workspaceSlug,
                    brandSlug,
                    name: newPillarName.trim(),
                  }),
                });
                setNewPillarName("");
                await load();
              }}
            >
              Add
            </Button>
          </div>
          <ul className="space-y-2">
            {pillars.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: p.color || "#14b8a6" }}
                  />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.description || "From Business Brain / Strategy"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="h-8 w-12 cursor-pointer p-1"
                    value={p.color || "#14b8a6"}
                    onChange={async (e) => {
                      await fetch("/api/studio/pillars", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          workspaceSlug,
                          brandSlug,
                          id: p.id,
                          color: e.target.value,
                        }),
                      });
                      await load();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await fetch("/api/studio/pillars", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          workspaceSlug,
                          brandSlug,
                          id: p.id,
                          archive: true,
                        }),
                      });
                      await load();
                    }}
                  >
                    Archive
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl"
        >
          {detail ? (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8">
                  <Input
                    className="h-auto border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                    value={detail.title}
                    onChange={(e) =>
                      setDetail({ ...detail, title: e.target.value })
                    }
                    onBlur={() => void saveDetail({ title: detail.title })}
                  />
                </SheetTitle>
                <SheetDescription>
                  {statusLabel(detail.status)} ·{" "}
                  {formatLabel(detail.format as never)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={detail.status}
                      onChange={(e) =>
                        void saveDetail({
                          status: e.target.value as ContentStatus,
                        })
                      }
                    >
                      {PIPELINE_COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={detail.priority}
                      onChange={(e) =>
                        void saveDetail({ priority: e.target.value })
                      }
                    >
                      {CONTENT_PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Format</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={detail.format}
                      onChange={(e) => {
                        const fmt = CONTENT_FORMATS.find(
                          (f) => f.value === e.target.value,
                        );
                        void saveDetail({
                          format: e.target.value,
                          platform: fmt?.platform,
                        });
                      }}
                    >
                      {CONTENT_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Campaign</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={detail.campaignId ?? ""}
                      onChange={(e) =>
                        void saveDetail({
                          campaignId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">None</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pillar</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={detail.pillarId ?? ""}
                      onChange={(e) =>
                        void saveDetail({
                          pillarId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">None</option>
                      {pillars.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due date</Label>
                    <Input
                      type="date"
                      value={
                        detail.dueDate
                          ? format(new Date(detail.dueDate), "yyyy-MM-dd")
                          : ""
                      }
                      onChange={(e) =>
                        void saveDetail({
                          dueDate: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={3}
                    value={detail.description ?? ""}
                    onChange={(e) =>
                      setDetail({ ...detail, description: e.target.value })
                    }
                    onBlur={() =>
                      void saveDetail({ description: detail.description })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Objective</Label>
                  <Textarea
                    rows={2}
                    value={detail.objective ?? ""}
                    onChange={(e) =>
                      setDetail({ ...detail, objective: e.target.value })
                    }
                    onBlur={() =>
                      void saveDetail({ objective: detail.objective })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target audience</Label>
                  <Textarea
                    rows={2}
                    value={detail.targetAudience ?? ""}
                    onChange={(e) =>
                      setDetail({ ...detail, targetAudience: e.target.value })
                    }
                    onBlur={() =>
                      void saveDetail({
                        targetAudience: detail.targetAudience,
                      })
                    }
                  />
                </div>

                <div className="rounded-xl border border-border/70 p-4">
                  <h3 className="text-sm font-medium">Content brief</h3>
                  <div className="mt-3 grid gap-3">
                    {(
                      [
                        ["goal", "Goal"],
                        ["hook", "Hook"],
                        ["problem", "Problem"],
                        ["solution", "Solution"],
                        ["cta", "CTA"],
                        ["references", "References"],
                        ["competitors", "Competitors"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <Label>{label}</Label>
                        <Textarea
                          rows={2}
                          value={detail.brief?.[key] ?? ""}
                          onChange={(e) =>
                            setDetail({
                              ...detail,
                              brief: {
                                goal: detail.brief?.goal ?? null,
                                hook: detail.brief?.hook ?? null,
                                problem: detail.brief?.problem ?? null,
                                solution: detail.brief?.solution ?? null,
                                cta: detail.brief?.cta ?? null,
                                targetAudience:
                                  detail.brief?.targetAudience ?? null,
                                references: detail.brief?.references ?? null,
                                keywords: detail.brief?.keywords ?? [],
                                hashtags: detail.brief?.hashtags ?? [],
                                competitors: detail.brief?.competitors ?? null,
                                [key]: e.target.value,
                              },
                            })
                          }
                          onBlur={() =>
                            void saveDetail({
                              brief: {
                                [key]: detail.brief?.[key] ?? null,
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <Label>Keywords (comma)</Label>
                      <Input
                        value={(detail.brief?.keywords ?? []).join(", ")}
                        onBlur={(e) =>
                          void saveDetail({
                            brief: {
                              keywords: e.target.value
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        defaultValue={(detail.brief?.keywords ?? []).join(", ")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Hashtags (comma)</Label>
                      <Input
                        defaultValue={(detail.brief?.hashtags ?? []).join(", ")}
                        onBlur={(e) =>
                          void saveDetail({
                            brief: {
                              hashtags: e.target.value
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Checklist</h3>
                  <ul className="mt-3 space-y-2">
                    {(detail.checklist ?? []).map((c, idx) => (
                      <li key={c.id || idx} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={c.done}
                          onChange={() => {
                            const next = (detail.checklist ?? []).map((x, i) =>
                              i === idx ? { ...x, done: !x.done } : x,
                            );
                            setDetail({ ...detail, checklist: next });
                            void saveDetail({ checklist: next });
                          }}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            c.done && "text-muted-foreground line-through",
                          )}
                        >
                          {c.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    value={detail.notes ?? ""}
                    onChange={(e) =>
                      setDetail({ ...detail, notes: e.target.value })
                    }
                    onBlur={() => void saveDetail({ notes: detail.notes })}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium">Comments</h3>
                  <ul className="mt-3 space-y-3">
                    {(detail.comments ?? []).map((c) => (
                      <li
                        key={c.id}
                        className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                      >
                        <div className="text-xs text-muted-foreground">
                          {c.user.name || c.user.email} ·{" "}
                          {format(new Date(c.createdAt), "MMM d, HH:mm")}
                        </div>
                        <p className="mt-1">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Comment… use @name to mention"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <Button
                      onClick={async () => {
                        if (!comment.trim()) return;
                        await saveDetail({ comment: comment.trim() });
                        setComment("");
                      }}
                    >
                      Post
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium">History</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Status moves and edits are tracked in Activity. Publishing
                    APIs come later — this studio stops at production workflow.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
