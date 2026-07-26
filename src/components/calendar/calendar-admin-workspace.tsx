"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Copy,
  Download,
  Globe2,
  Loader2,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TIME_FILTERS, IMPORT_FORMATS, VERIFICATION_STATUSES } from "@/lib/calendar";

type Category = { id: string; key: string; name: string };
type Country = { id: string; code: string; name: string };
type Season = { id: string; key: string; name: string; kind: string };

type CalendarEvent = {
  id: string;
  key: string;
  name: string;
  title: string | null;
  description: string | null;
  source: string;
  month: number | null;
  day: number | null;
  recurrence: string;
  importance: string;
  status: string;
  verificationStatus?: string;
  version?: number;
  countries: string[];
  industries: string[];
  tags: string[];
  language: string;
  timezone: string;
  nextDate?: string;
  season?: string | null;
  marketingCategory: Category | null;
  translations: Array<{
    language: string;
    title: string;
    description: string | null;
    keywords: string[];
  }>;
  history?: Array<{ id: string; action: string; message: string; createdAt: string }>;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

const emptyForm = {
  name: "",
  description: "",
  categoryKey: "company_custom",
  countryCodes: "GLOBAL",
  month: "",
  day: "",
  recurrence: "ANNUAL",
  importance: "MEDIUM",
  status: "ACTIVE",
  verificationStatus: "DRAFT",
  tags: "",
  industries: "",
  language: "en",
  localizedTitle: "",
  localizedDescription: "",
  localizedKeywords: "",
};

const SAVED_VIEWS_KEY = "inzorya.calendar.savedViews";

export function CalendarAdminWorkspace({ workspaceSlug, brandSlug }: Props) {
  const page = usePageCopy("calendar");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [timeFilter, setTimeFilter] = useState("upcoming");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [verification, setVerification] = useState("");
  const [seasonKey, setSeasonKey] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importText, setImportText] = useState("");
  const [importFormat, setImportFormat] = useState("JSON");
  const [importUrl, setImportUrl] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [savedViews, setSavedViews] = useState<
    Array<{ name: string; q: string; category: string; country: string; timeFilter: string }>
  >([]);
  const [viewName, setViewName] = useState("");

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const active = events.find((e) => e.id === activeId) || null;

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/calendar?${qs}&view=meta`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Meta failed");
    setCategories(data.categories || []);
    setCountries(data.countries || []);
    setSeasons(data.seasons || []);
  }, [qs]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspaceSlug,
        brandSlug,
        view: "search",
        timeFilter,
      });
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (country) params.set("country", country);
      if (verification) params.set("verificationStatus", verification);
      if (seasonKey) params.set("seasonKey", seasonKey);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/calendar?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setEvents(data.events || []);
      setTotal(data.total || 0);
      if (!activeId && data.events?.[0]?.id) setActiveId(data.events[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, [
    workspaceSlug,
    brandSlug,
    q,
    timeFilter,
    category,
    country,
    verification,
    seasonKey,
    statusFilter,
    activeId,
  ]);

  useEffect(() => {
    void loadMeta();
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);
      if (raw) setSavedViews(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [loadMeta]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspaceSlug,
    brandSlug,
    timeFilter,
    category,
    country,
    verification,
    seasonKey,
    statusFilter,
  ]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (e: CalendarEvent) => {
    setEditingId(e.id);
    const tr = e.translations.find((t) => t.language !== "en") || e.translations[0];
    setForm({
      name: e.name,
      description: e.description || "",
      categoryKey: e.marketingCategory?.key || "custom_events",
      countryCodes: e.countries.join(",") || "GLOBAL",
      month: e.month != null ? String(e.month) : "",
      day: e.day != null ? String(e.day) : "",
      recurrence: e.recurrence,
      importance: e.importance,
      status: e.status,
      verificationStatus: e.verificationStatus || "DRAFT",
      tags: e.tags.join(", "),
      industries: e.industries.join(", "),
      language: tr?.language || "en",
      localizedTitle: tr?.title || e.title || e.name,
      localizedDescription: tr?.description || "",
      localizedKeywords: (tr?.keywords || []).join(", "),
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    try {
      const data = await post({
        intent: "upsert",
        event: {
          id: editingId || undefined,
          name: form.name.trim(),
          title: form.name.trim(),
          description: form.description.trim() || undefined,
          categoryKey: form.categoryKey,
          countryCodes: form.countryCodes
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          month: form.month ? Number(form.month) : null,
          day: form.day ? Number(form.day) : null,
          recurrence: form.recurrence,
          importance: form.importance,
          status: form.status,
          verificationStatus: form.verificationStatus,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          industries: form.industries
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          language: "en",
          source: "CUSTOM",
          sourceKey: "custom",
          translations: form.localizedTitle
            ? [
                {
                  language: form.language || "en",
                  title: form.localizedTitle,
                  description: form.localizedDescription || undefined,
                  keywords: form.localizedKeywords
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                },
              ]
            : [],
        },
      });
      toast.success(editingId ? "Event updated" : "Event created");
      setEditingId(data.event?.id || null);
      setActiveId(data.event?.id || null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    setBusy(true);
    try {
      await post({ intent: "archive", id });
      toast.success("Archived");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (id: string) => {
    setBusy(true);
    try {
      const data = await post({ intent: "duplicate", id });
      toast.success("Duplicated");
      setActiveId(data.event?.id || null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        workspaceSlug,
        brandSlug,
        view: "export",
      });
      const res = await fetch(`/api/calendar?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      const blob = new Blob([JSON.stringify(data.events, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "calendar-events.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const data = await post({
        intent: "import",
        format: importFormat,
        payload: importText,
        sourceUrl: importUrl || undefined,
        fileName: `import.${importFormat.toLowerCase()}`,
      });
      toast.success(`Imported ${data.success || data.created || 0} events`);
      setShowImport(false);
      setImportText("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const bulk = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!selected.length) {
      toast.error("Select events first");
      return;
    }
    setBusy(true);
    try {
      const data = await post({
        intent: "bulk",
        action,
        ids: selected,
        ...extra,
      });
      toast.success(`Updated ${data.affected} events`);
      setSelected([]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk failed");
    } finally {
      setBusy(false);
    }
  };

  const mergeSelected = async () => {
    if (selected.length < 2) {
      toast.error("Select at least 2 events to merge");
      return;
    }
    setBusy(true);
    try {
      await post({
        intent: "merge",
        keepId: selected[0],
        mergeIds: selected.slice(1),
      });
      toast.success("Merged duplicates");
      setSelected([]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  };

  const saveView = () => {
    if (!viewName.trim()) return;
    const next = [
      ...savedViews.filter((v) => v.name !== viewName.trim()),
      {
        name: viewName.trim(),
        q,
        category,
        country,
        timeFilter,
      },
    ];
    setSavedViews(next);
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next));
    setViewName("");
    toast.success("View saved");
  };

  if (loading && !events.length) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-[70vh]" />
        <Skeleton className="h-[70vh]" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">
            {page.title}
          </p>
          <h1 className="font-serif text-2xl tracking-tight">
            Global marketing calendar
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Worldwide marketing event database — sources, localization, seasons,
            imports. Still no AI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void doExport()}>
            <Download className="size-4" />
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowImport((v) => !v)}
          >
            <Upload className="size-4" />
            Import
          </Button>
          <Button size="sm" onClick={startCreate}>
            <Plus className="size-4" />
            Add event
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-h-0 overflow-y-auto p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search keyword, tag…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load();
                }}
              />
            </div>
            <select
              className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              {TIME_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
              value={verification}
              onChange={(e) => setVerification(e.target.value)}
            >
              <option value="">All verification</option>
              {VERIFICATION_STATUSES.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
              value={seasonKey}
              onChange={(e) => setSeasonKey(e.target.value)}
            >
              <option value="">All seasons</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Active + Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Search
            </Button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input
              className="max-w-[160px]"
              placeholder="Save view name"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={saveView}>
              Save view
            </Button>
            {savedViews.map((v) => (
              <Button
                key={v.name}
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQ(v.q);
                  setCategory(v.category);
                  setCountry(v.country);
                  setTimeFilter(v.timeFilter);
                }}
              >
                {v.name}
              </Button>
            ))}
          </div>

          {selected.length ? (
            <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-white/10 p-2">
              <span className="px-2 text-xs text-muted-foreground">
                {selected.length} selected
              </span>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulk("archive")}>
                Archive
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulk("restore")}>
                Restore
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void bulk("tag", { tags: ["catalog"] })}
              >
                Tag
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void mergeSelected()}>
                Merge duplicates
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void bulk("delete")}
              >
                Delete
              </Button>
            </div>
          ) : null}

          <p className="mb-3 text-xs text-muted-foreground">
            {total} events · global marketing database
          </p>

          {showImport ? (
            <div className="mb-4 rounded-xl border border-white/10 p-3">
              <div className="mb-2 flex flex-wrap gap-2">
                <select
                  className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
                  value={importFormat}
                  onChange={(e) => setImportFormat(e.target.value)}
                >
                  {IMPORT_FORMATS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {importFormat === "REST" ? (
                  <Input
                    className="min-w-[240px] flex-1"
                    placeholder="https://…/events.json"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                ) : null}
              </div>
              <Label>Payload (JSON / CSV / ICS)</Label>
              <Textarea
                className="mt-2 font-mono text-xs"
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='[{"name":"World Burger Day","month":5,"day":28,"categoryKey":"food_days"}]'
              />
              <Button
                className="mt-2"
                size="sm"
                disabled={busy}
                onClick={() => void doImport()}
              >
                Run import
              </Button>
            </div>
          ) : null}

          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-4"
                  checked={selected.includes(e.id)}
                  onChange={(ev) => {
                    setSelected((ids) =>
                      ev.target.checked
                        ? [...ids, e.id]
                        : ids.filter((id) => id !== e.id),
                    );
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(e.id);
                    startEdit(e);
                  }}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition",
                    active?.id === e.id
                      ? "border-emerald-400/40 bg-emerald-400/10"
                      : "border-white/5 hover:border-white/15",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{e.title || e.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {e.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {e.marketingCategory ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {e.marketingCategory.name}
                          </Badge>
                        ) : null}
                        <Badge variant="secondary" className="text-[10px]">
                          {e.recurrence}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {e.verificationStatus || "DRAFT"}
                        </Badge>
                        {e.version ? (
                          <Badge variant="secondary" className="text-[10px]">
                            v{e.version}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{e.nextDate || "—"}</p>
                      <p className="mt-1">{e.countries.slice(0, 3).join(", ")}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {!events.length ? (
              <li className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                <Globe2 className="mx-auto mb-2 size-8 text-emerald-300/70" />
                <p className="font-serif text-lg">No events in this filter</p>
              </li>
            ) : null}
          </ul>
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-white/5 p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            {editingId ? "Edit event" : "Add event"} · Preview
          </p>

          <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
            <p className="font-serif text-lg">
              {form.name || active?.name || "Untitled event"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {form.month && form.day
                ? `Recurs ${form.recurrence.toLowerCase()} on ${form.month}/${form.day}`
                : form.recurrence}
              {" · "}
              {form.importance}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {form.description || "No description yet."}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Category</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-white/10 bg-transparent px-2 text-sm"
                  value={form.categoryKey}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoryKey: e.target.value }))
                  }
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Importance</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-white/10 bg-transparent px-2 text-sm"
                  value={form.importance}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, importance: e.target.value }))
                  }
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Verification</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-white/10 bg-transparent px-2 text-sm"
                  value={form.verificationStatus}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      verificationStatus: e.target.value,
                    }))
                  }
                >
                  {VERIFICATION_STATUSES.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Month</Label>
                <Input
                  className="mt-1"
                  value={form.month}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, month: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Day</Label>
                <Input
                  className="mt-1"
                  value={form.day}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, day: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Recurrence</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-white/10 bg-transparent px-2 text-sm"
                  value={form.recurrence}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, recurrence: e.target.value }))
                  }
                >
                  {["ONE_TIME", "ANNUAL", "MONTHLY", "WEEKLY", "CUSTOM"].map(
                    (k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <div>
              <Label>Countries (comma codes)</Label>
              <Input
                className="mt-1"
                value={form.countryCodes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, countryCodes: e.target.value }))
                }
                placeholder="GLOBAL,US,IR"
              />
            </div>
            <div>
              <Label>Tags</Label>
              <Input
                className="mt-1"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </div>
            <div>
              <Label>Industries</Label>
              <Input
                className="mt-1"
                value={form.industries}
                onChange={(e) =>
                  setForm((f) => ({ ...f, industries: e.target.value }))
                }
              />
            </div>
            <div className="rounded-lg border border-white/5 p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                Localization
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Language</Label>
                  <Input
                    className="mt-1"
                    value={form.language}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, language: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Localized title</Label>
                  <Input
                    className="mt-1"
                    value={form.localizedTitle}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, localizedTitle: e.target.value }))
                    }
                  />
                </div>
              </div>
              <Label className="mt-2 block">Localized description</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={form.localizedDescription}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    localizedDescription: e.target.value,
                  }))
                }
              />
              <Label className="mt-2 block">Localized keywords</Label>
              <Input
                className="mt-1"
                value={form.localizedKeywords}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    localizedKeywords: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {editingId ? "Save changes" : "Create event"}
              </Button>
              {editingId ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void duplicate(editingId)}
                  >
                    <Copy className="size-4" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await post({ intent: "restore", id: editingId });
                        toast.success("Restored");
                        await load();
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Restore failed",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => void archive(editingId)}
                  >
                    <Archive className="size-4" />
                    Archive
                  </Button>
                </>
              ) : null}
            </div>

            {active?.history?.length ? (
              <div className="pt-2">
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Version history
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {active.history.slice(0, 8).map((h) => (
                    <li key={h.id}>
                      {h.action} · {h.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
