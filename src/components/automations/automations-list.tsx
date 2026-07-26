"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Filter,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Workflow,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Author = { id: string; name: string | null; email: string };
type AutomationCard = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  tags: string[];
  version: number;
  nodeCount: number;
  executionCount: number;
  updatedAt: string;
  createdBy: Author | null;
  _count?: { nodes: number };
};

type Template = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-500/15 text-slate-300",
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  PAUSED: "bg-amber-500/15 text-amber-400",
  ARCHIVED: "bg-zinc-500/15 text-zinc-400",
};

export function AutomationsList({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const page = usePageCopy("automations");
  const router = useRouter();
  const base = `/w/${workspaceSlug}/b/${brandSlug}/automations`;
  const [list, setList] = useState<AutomationCard[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Engagement",
    status: "DRAFT" as AutomationCard["status"],
    tags: "",
    templateSlug: "",
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      ...(q ? { q } : {}),
      ...(status !== "ALL" ? { status } : {}),
      ...(category ? { category } : {}),
      ...(tag ? { tag } : {}),
    });
    const [res, tplRes] = await Promise.all([
      fetch(`/api/automations?${params}`),
      fetch(
        `/api/automations?${new URLSearchParams({ workspaceSlug, brandSlug, templates: "1" })}`,
      ),
    ]);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load automations.");
      return;
    }
    const data = (await res.json()) as { automations: AutomationCard[] };
    setList(data.automations);
    if (tplRes.ok) {
      const tplData = (await tplRes.json()) as { templates: Template[] };
      setTemplates(tplData.templates);
    }
  }, [workspaceSlug, brandSlug, q, status, category, tag]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 150);
    return () => clearTimeout(t);
  }, [load]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(list.map((a) => a.category).filter(Boolean) as string[]),
      ),
    [list],
  );
  const allTags = useMemo(
    () => Array.from(new Set(list.flatMap((a) => a.tags))),
    [list],
  );

  async function createAutomation() {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "create",
        workspaceSlug,
        brandSlug,
        name: form.name.trim(),
        description: form.description || null,
        category: form.category || null,
        status: form.status,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        templateSlug: form.templateSlug || undefined,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      toast.error("Could not create automation.");
      return;
    }
    const data = (await res.json()) as { automation: AutomationCard };
    toast.success("Automation created.");
    setOpenCreate(false);
    router.push(`${base}/${data.automation.id}`);
  }

  async function duplicate(id: string) {
    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "duplicate",
        workspaceSlug,
        brandSlug,
        id,
      }),
    });
    if (!res.ok) {
      toast.error("Duplicate failed.");
      return;
    }
    toast.success("Duplicated.");
    await load();
  }

  async function archive(id: string) {
    const res = await fetch("/api/automations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        id,
        archive: true,
      }),
    });
    if (!res.ok) {
      toast.error("Archive failed.");
      return;
    }
    toast.success("Archived.");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this automation permanently?")) return;
    const res = await fetch("/api/automations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, id }),
    });
    if (!res.ok) {
      toast.error("Delete failed.");
      return;
    }
    toast.success("Deleted.");
    await load();
  }

  async function importJson(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text) as {
        name?: string;
        snapshot?: unknown;
        nodes?: unknown;
        edges?: unknown;
      };
      const snapshot = json.snapshot || { nodes: json.nodes, edges: json.edges };
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "import",
          workspaceSlug,
          brandSlug,
          name: json.name,
          snapshot,
        }),
      });
      if (!res.ok) {
        toast.error("Import failed.");
        return;
      }
      toast.success("Imported.");
      await load();
    } catch {
      toast.error("Invalid JSON file.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={page.title}
        description={page.description}
        actions={
          <>
            <label className="inline-flex">
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importJson(f);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Download className="h-4 w-4" />
                  Import JSON
                </span>
              </Button>
            </label>
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4" />
              Create automation
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/30 p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search workflows or nodes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {templates.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Templates
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {templates.slice(0, 8).map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    name: t.name,
                    description: t.description || "",
                    category: t.category || "Engagement",
                    templateSlug: t.slug,
                    tags: (t.tags || []).join(", "),
                  }));
                  setOpenCreate(true);
                }}
                className="rounded-xl border border-border/70 bg-background/40 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="text-sm font-medium">{t.name}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          title="No automations yet"
          description="Create a workflow from scratch or start from a template."
          actionLabel="Create automation"
          onAction={() => setOpenCreate(true)}
          icon={<Workflow className="h-8 w-8" />}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => {
            const triggerHint =
              a.tags[0] || a.category || "Workflow";
            return (
              <div
                key={a.id}
                className="group flex flex-col rounded-xl border border-border/70 bg-card/40 p-4 transition hover:border-primary/30"
              >
                <Link href={`${base}/${a.id}`} className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium tracking-tight group-hover:text-primary">
                      {a.name}
                    </h3>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase",
                        STATUS_STYLE[a.status],
                      )}
                    >
                      {a.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {a.description || "No description"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="muted">{triggerHint}</Badge>
                    <span>{a.nodeCount || a._count?.nodes || 0} nodes</span>
                    <span>·</span>
                    <span>{a.executionCount} runs (mock)</span>
                    <span>·</span>
                    <span>v{a.version}</span>
                  </div>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    Edited{" "}
                    {formatDistanceToNow(new Date(a.updatedAt), {
                      addSuffix: true,
                    })}
                    {a.createdBy
                      ? ` · ${a.createdBy.name || a.createdBy.email}`
                      : ""}
                  </div>
                </Link>
                <div className="mt-3 flex gap-1 border-t border-border/60 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void duplicate(a.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void archive(a.id)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void remove(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" className="ml-auto" asChild>
                    <Link href={`${base}/${a.id}`}>Open builder</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create automation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Textarea
              placeholder="Description"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              />
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as AutomationCard["status"],
                  }))
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
              </select>
            </div>
            <Input
              placeholder="Tags (comma separated)"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            />
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={form.templateSlug}
              onChange={(e) =>
                setForm((f) => ({ ...f, templateSlug: e.target.value }))
              }
            >
              <option value="">Blank canvas</option>
              {templates.map((t) => (
                <option key={t.slug} value={t.slug}>
                  Template: {t.name}
                </option>
              ))}
            </select>
            <Button
              className="w-full"
              disabled={creating}
              onClick={() => void createAutomation()}
            >
              {creating ? "Creating…" : "Create & open builder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
