"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Doc = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

export function KnowledgeWorkspace({
  workspaceSlug,
  brandSlug,
  initialDocId,
}: {
  workspaceSlug: string;
  brandSlug: string;
  initialDocId?: string;
}) {
  const page = usePageCopy("knowledge");
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialDocId ?? null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId],
  );

  const load = useCallback(
    async (query = q) => {
      setLoading(true);
      const params = new URLSearchParams({
        workspaceSlug,
        brandSlug,
        ...(query ? { q: query } : {}),
      });
      const res = await fetch(`/api/knowledge?${params}`);
      setLoading(false);
      if (!res.ok) {
        toast.error("Could not load documents.");
        return;
      }
      const data = (await res.json()) as { documents: Doc[] };
      setDocs(data.documents);
      if (data.documents.length === 0) {
        setSelectedId(null);
        setTitle("");
        setBody("");
        return;
      }
      const next =
        data.documents.find((d) => d.id === selectedId) ?? data.documents[0];
      setSelectedId(next.id);
      setTitle(next.title);
      setBody(next.body);
    },
    [workspaceSlug, brandSlug, q, selectedId],
  );

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, brandSlug]);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setBody(selected.body);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createDoc() {
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        title: "Untitled document",
        body: "",
      }),
    });
    if (!res.ok) {
      toast.error("Could not create document.");
      return;
    }
    const data = (await res.json()) as { document: Doc };
    setDocs((prev) => [data.document, ...prev]);
    setSelectedId(data.document.id);
    setTitle(data.document.title);
    setBody(data.document.body);
    toast.success("Document created.");
    router.refresh();
  }

  async function saveDoc(nextTitle = title, nextBody = body) {
    if (!selectedId) return;
    setSaving(true);
    const prev = docs;
    setDocs((list) =>
      list.map((d) =>
        d.id === selectedId
          ? { ...d, title: nextTitle, body: nextBody, updatedAt: new Date().toISOString() }
          : d,
      ),
    );
    const res = await fetch("/api/knowledge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        id: selectedId,
        title: nextTitle,
        body: nextBody,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setDocs(prev);
      toast.error("Save failed.");
      return;
    }
    toast.success("Saved.");
    router.refresh();
  }

  async function renameOptimistic(nextTitle: string) {
    setTitle(nextTitle);
  }

  async function removeDoc() {
    if (!selectedId) return;
    if (!confirm("Delete this document?")) return;
    const id = selectedId;
    const prev = docs;
    setDocs((list) => list.filter((d) => d.id !== id));
    setSelectedId(null);
    const res = await fetch("/api/knowledge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, id }),
    });
    if (!res.ok) {
      setDocs(prev);
      toast.error("Delete failed.");
      return;
    }
    toast.success("Document deleted.");
    await load(q);
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title={page.title}
        description={page.description}
        actions={
          <Button onClick={() => void createDoc()}>
            <Plus className="h-4 w-4" />
            New document
          </Button>
        }
      />

      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load(q);
                }}
              />
            </div>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : docs.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No documents yet.</p>
            ) : (
              docs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={cn(
                    "mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    selectedId === doc.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50",
                  )}
                >
                  <div className="truncate font-medium">{doc.title}</div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="rounded-xl border border-border bg-card p-4">
          {!selectedId ? (
            <EmptyState
              title="No knowledge yet"
              description="Create a document for positioning, FAQs, product facts, or claims."
              actionLabel="Create document"
              onAction={() => void createDoc()}
            />
          ) : (
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  value={title}
                  onChange={(e) => void renameOptimistic(e.target.value)}
                  onBlur={() => void saveDoc(title, body)}
                  className="text-lg font-semibold"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void removeDoc()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveDoc()}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[420px] flex-1 resize-y font-normal"
                placeholder="Write freely…"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
