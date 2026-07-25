"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Search, Trash2 } from "lucide-react";
import { ContentPlatform, ContentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Item = {
  id: string;
  title: string;
  body: string;
  status: ContentStatus;
  platform: ContentPlatform;
  createdAt: string;
};

const statuses = Object.values(ContentStatus);
const platforms = Object.values(ContentPlatform);

export function ContentLibrary({
  workspaceSlug,
  brandSlug,
  initialStatus,
}: {
  workspaceSlug: string;
  brandSlug: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus || "ALL");
  const [platform, setPlatform] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<{
    title: string;
    body: string;
    status: ContentStatus;
    platform: ContentPlatform;
  }>({
    title: "",
    body: "",
    status: ContentStatus.DRAFT,
    platform: ContentPlatform.OTHER,
  });
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      ...(q ? { q } : {}),
      status,
      platform,
    });
    const res = await fetch(`/api/content?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load content.");
      return;
    }
    const data = (await res.json()) as { items: Item[] };
    setItems(data.items);
  }, [workspaceSlug, brandSlug, q, status, platform]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      body: "",
      status: ContentStatus.DRAFT,
      platform: ContentPlatform.OTHER,
    });
    setOpen(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm({
      title: item.title,
      body: item.body,
      status: item.status,
      platform: item.platform,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setPending(true);
    const res = await fetch("/api/content", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        id: editing?.id,
        ...form,
      }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Could not save content.");
      return;
    }
    toast.success(editing ? "Content updated." : "Content created.");
    setOpen(false);
    await load();
    router.refresh();
  }

  async function remove(item: Item) {
    if (!confirm(`Delete “${item.title}”?`)) return;
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== item.id));
    const res = await fetch("/api/content", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        id: item.id,
      }),
    });
    if (!res.ok) {
      setItems(prev);
      toast.error("Delete failed.");
      return;
    }
    toast.success("Deleted.");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Content"
        description="Simple content library for drafts and published pieces."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New content
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search titles…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="ALL">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No content yet"
          description="Create your first piece — title, status, and platform are enough to start."
          actionLabel="Create content"
          onAction={openCreate}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{item.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant="muted">{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.platform}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(item.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void remove(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit content" : "New content"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as ContentStatus,
                    }))
                  }
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.platform}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      platform: e.target.value as ContentPlatform,
                    }))
                  }
                >
                  {platforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                rows={10}
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
              />
            </div>
            <Button disabled={pending} onClick={() => void save()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
