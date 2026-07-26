"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  GitBranch,
  Link2,
  Loader2,
  Network,
  Plus,
  Search,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  NODE_KINDS,
  RELATION_STRENGTHS,
  kindLabel,
} from "@/lib/knowledge-graph";

type Node = {
  id: string;
  kind: string;
  key: string;
  name: string;
  description: string | null;
  parent?: { id: string; name: string; kind: string } | null;
  _count?: { fromRels: number; toRels: number; eventLinks: number };
};

type Relation = {
  id: string;
  strength: string;
  note: string | null;
  type: { key: string; name: string };
  fromNode?: Node;
  toNode?: Node;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

export function KnowledgeGraphWorkspace({ workspaceSlug, brandSlug }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [relationTypes, setRelationTypes] = useState<
    Array<{ key: string; name: string }>
  >([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    node: Node & {
      children: Node[];
      fromRels: Relation[];
      toRels: Relation[];
      eventLinks: Array<{
        strength: string;
        node: Node;
        event: { id: string; name: string; key: string };
        type: { name: string } | null;
      }>;
    };
  } | null>(null);
  const [connectToId, setConnectToId] = useState("");
  const [connectType, setConnectType] = useState("related_to");
  const [connectStrength, setConnectStrength] = useState("MEDIUM");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("CUSTOM");
  const [eventId, setEventId] = useState("");
  const [preview, setPreview] = useState<{
    event: {
      id: string;
      name: string;
      preparationDays: number | null;
      planningWindowDays: number | null;
      publishingWindowDays: number | null;
    } | null;
    links: Array<{ strength: string; node: Node; type: { name: string } | null }>;
    relations: Relation[];
  } | null>(null);
  const [prep, setPrep] = useState({
    preparationDays: "",
    planningWindowDays: "",
    publishingWindowDays: "",
    expirationDays: "",
    reminderOffsets: "14,7,3,1",
  });

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/knowledge-graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspaceSlug,
        brandSlug,
        view: "search",
      });
      if (q.trim()) params.set("q", q.trim());
      if (kind) params.set("kind", kind);
      const [searchRes, metaRes] = await Promise.all([
        fetch(`/api/knowledge-graph?${params}`),
        fetch(`/api/knowledge-graph?${qs}&view=meta`),
      ]);
      const searchData = await searchRes.json();
      const metaData = await metaRes.json();
      if (!searchRes.ok) throw new Error(searchData.error || "Search failed");
      setNodes(searchData.nodes || []);
      setCounts(metaData.counts || {});
      setRelationTypes(metaData.relationTypes || []);
      if (!activeId && searchData.nodes?.[0]?.id) {
        setActiveId(searchData.nodes[0].id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, brandSlug, q, kind, qs, activeId]);

  const loadDetail = useCallback(
    async (id: string) => {
      const res = await fetch(
        `/api/knowledge-graph?${qs}&view=detail&id=${id}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Detail failed");
      setDetail(data);
    },
    [qs],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, brandSlug, kind]);

  useEffect(() => {
    if (!activeId) return;
    void loadDetail(activeId).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Detail failed"),
    );
  }, [activeId, loadDetail]);

  const createNode = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const data = await post({
        intent: "upsert_node",
        kind: newKind,
        name: newName.trim(),
      });
      setNewName("");
      setActiveId(data.node.id);
      toast.success("Node created");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    if (!activeId || !connectToId) return;
    setBusy(true);
    try {
      await post({
        intent: "connect",
        fromNodeId: activeId,
        toNodeId: connectToId,
        typeKey: connectType,
        strength: connectStrength,
      });
      toast.success("Connected");
      await loadDetail(activeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (toNodeId: string, typeKey?: string) => {
    if (!activeId) return;
    setBusy(true);
    try {
      await post({
        intent: "disconnect",
        fromNodeId: activeId,
        toNodeId,
        typeKey,
      });
      toast.success("Disconnected");
      await loadDetail(activeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  const linkEvent = async () => {
    if (!activeId || !eventId.trim()) return;
    setBusy(true);
    try {
      await post({
        intent: "link_event",
        eventId: eventId.trim(),
        nodeId: activeId,
        typeKey: connectType,
        strength: connectStrength,
      });
      toast.success("Event linked");
      await loadDetail(activeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Link failed");
    } finally {
      setBusy(false);
    }
  };

  const loadPreview = async () => {
    if (!eventId.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/knowledge-graph?${qs}&view=preview&eventId=${eventId.trim()}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
      if (data.event) {
        setPrep({
          preparationDays: data.event.preparationDays?.toString() || "",
          planningWindowDays: data.event.planningWindowDays?.toString() || "",
          publishingWindowDays:
            data.event.publishingWindowDays?.toString() || "",
          expirationDays: data.event.expirationDays?.toString() || "",
          reminderOffsets: (data.event.reminderOffsets || [14, 7, 3, 1]).join(
            ",",
          ),
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const savePrep = async () => {
    if (!eventId.trim()) return;
    setBusy(true);
    try {
      await post({
        intent: "preparation",
        eventId: eventId.trim(),
        preparationDays: prep.preparationDays
          ? Number(prep.preparationDays)
          : null,
        planningWindowDays: prep.planningWindowDays
          ? Number(prep.planningWindowDays)
          : null,
        publishingWindowDays: prep.publishingWindowDays
          ? Number(prep.publishingWindowDays)
          : null,
        expirationDays: prep.expirationDays
          ? Number(prep.expirationDays)
          : null,
        reminderOffsets: prep.reminderOffsets
          .split(",")
          .map((n) => Number(n.trim()))
          .filter((n) => !Number.isNaN(n)),
      });
      toast.success("Preparation saved");
      await loadPreview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const mergeIntoActive = async (otherId: string) => {
    if (!activeId) return;
    setBusy(true);
    try {
      await post({
        intent: "merge",
        keepId: activeId,
        mergeIds: [otherId],
      });
      toast.success("Nodes merged");
      await load();
      await loadDetail(activeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  };

  const splitActive = async () => {
    if (!activeId || !newName.trim()) return;
    setBusy(true);
    try {
      const data = await post({
        intent: "split",
        nodeId: activeId,
        name: newName.trim(),
      });
      toast.success("Node split");
      setActiveId(data.node.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Split failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !nodes.length) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-[280px_1fr_320px]">
        <Skeleton className="h-[70vh]" />
        <Skeleton className="h-[70vh]" />
        <Skeleton className="h-[70vh]" />
      </div>
    );
  }

  const active = detail?.node;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">
            Knowledge Graph
          </p>
          <h1 className="font-serif text-2xl tracking-tight">
            Business meaning behind every event
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Structured relationships only — no AI, no recommendations.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void post({ intent: "ensure" }).then(() => {
              toast.success("Graph seeded");
              return load();
            })
          }
        >
          <Network className="size-4" />
          Ensure catalog
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="min-h-0 space-y-3 overflow-y-auto border-r border-white/5 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Find industries, CTAs…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
            />
          </div>
          <select
            className="h-9 w-full rounded-md border border-white/10 bg-transparent px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All kinds</option>
            {NODE_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
                {counts[k.key] != null ? ` (${counts[k.key]})` : ""}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" className="w-full" onClick={() => void load()}>
            Search
          </Button>

          <div className="space-y-2 rounded-xl border border-white/5 p-2">
            <Label>Create node</Label>
            <select
              className="h-9 w-full rounded-md border border-white/10 bg-transparent px-2 text-sm"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
            >
              {NODE_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Node name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex gap-1">
              <Button size="sm" disabled={busy} onClick={() => void createNode()}>
                <Plus className="size-3.5" />
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void splitActive()}
              >
                <GitBranch className="size-3.5" />
                Split
              </Button>
            </div>
          </div>

          <ul className="space-y-1">
            {nodes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(n.id)}
                  className={cn(
                    "w-full rounded-lg border px-2.5 py-2 text-left text-sm",
                    activeId === n.id
                      ? "border-cyan-400/40 bg-cyan-400/10"
                      : "border-transparent hover:border-white/10",
                  )}
                >
                  <p className="font-medium leading-snug">{n.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {kindLabel(n.kind)}
                    {n._count
                      ? ` · ${n._count.fromRels + n._count.toRels} links`
                      : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-h-0 overflow-y-auto p-5">
          {!active ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Network className="mb-3 size-8 text-cyan-300/70" />
              <p className="font-serif text-xl">Select a knowledge node</p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              <div>
                <Badge className="mb-2">{kindLabel(active.kind)}</Badge>
                <h2 className="font-serif text-3xl tracking-tight">
                  {active.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">{active.key}</p>
                {active.description ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {active.description}
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/5 p-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Connect nodes
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-9 min-w-[180px] rounded-md border border-white/10 bg-transparent px-2 text-sm"
                    value={connectToId}
                    onChange={(e) => setConnectToId(e.target.value)}
                  >
                    <option value="">Target node…</option>
                    {nodes
                      .filter((n) => n.id !== active.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} ({kindLabel(n.kind)})
                        </option>
                      ))}
                  </select>
                  <select
                    className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
                    value={connectType}
                    onChange={(e) => setConnectType(e.target.value)}
                  >
                    {relationTypes.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border border-white/10 bg-transparent px-2 text-sm"
                    value={connectStrength}
                    onChange={(e) => setConnectStrength(e.target.value)}
                  >
                    {RELATION_STRENGTHS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" disabled={busy} onClick={() => void connect()}>
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Link2 className="size-3.5" />
                    )}
                    Connect
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Outgoing
                </p>
                <ul className="space-y-2">
                  {(active.fromRels || []).map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/5 px-3 py-2 text-sm"
                    >
                      <span>
                        {r.type.name} → {r.toNode?.name}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({r.strength})
                        </span>
                      </span>
                      <div className="flex gap-1">
                        {r.toNode ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void mergeIntoActive(r.toNode!.id)}
                          >
                            Merge
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void disconnect(r.toNode!.id, r.type.key)
                          }
                        >
                          <Unlink className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                  {!active.fromRels?.length ? (
                    <li className="text-sm text-muted-foreground">
                      No outgoing relations
                    </li>
                  ) : null}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Incoming
                </p>
                <ul className="space-y-2">
                  {(active.toRels || []).map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-white/5 px-3 py-2 text-sm"
                    >
                      {r.fromNode?.name} → {r.type.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({r.strength})
                      </span>
                    </li>
                  ))}
                  {!active.toRels?.length ? (
                    <li className="text-sm text-muted-foreground">
                      No incoming relations
                    </li>
                  ) : null}
                </ul>
              </div>

              {active.children?.length ? (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Hierarchy
                  </p>
                  <ul className="space-y-1 text-sm">
                    {active.children.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => setActiveId(c.id)}
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside className="min-h-0 space-y-4 overflow-y-auto border-l border-white/5 p-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Event graph preview
            </p>
            <Input
              placeholder="MarketingEvent id"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void loadPreview()}>
                Preview
              </Button>
              <Button size="sm" disabled={busy || !activeId} onClick={() => void linkEvent()}>
                Link active node
              </Button>
            </div>
          </div>

          {preview?.event ? (
            <div className="space-y-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
              <p className="font-serif text-lg">{preview.event.name}</p>
              <p className="text-xs text-muted-foreground">
                {preview.links.length} knowledge links · {preview.relations.length}{" "}
                node relations
              </p>
              <ul className="space-y-1 text-sm">
                {preview.links.map((l, i) => (
                  <li key={`${l.node.id}-${i}`}>
                    {l.node.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({kindLabel(l.node.kind)} · {l.strength})
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Prep days</Label>
                  <Input
                    className="mt-1"
                    value={prep.preparationDays}
                    onChange={(e) =>
                      setPrep((p) => ({ ...p, preparationDays: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Plan window</Label>
                  <Input
                    className="mt-1"
                    value={prep.planningWindowDays}
                    onChange={(e) =>
                      setPrep((p) => ({
                        ...p,
                        planningWindowDays: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Publish window</Label>
                  <Input
                    className="mt-1"
                    value={prep.publishingWindowDays}
                    onChange={(e) =>
                      setPrep((p) => ({
                        ...p,
                        publishingWindowDays: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Expiration</Label>
                  <Input
                    className="mt-1"
                    value={prep.expirationDays}
                    onChange={(e) =>
                      setPrep((p) => ({ ...p, expirationDays: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Reminders (days before)</Label>
                <Input
                  className="mt-1"
                  value={prep.reminderOffsets}
                  onChange={(e) =>
                    setPrep((p) => ({ ...p, reminderOffsets: e.target.value }))
                  }
                />
              </div>
              <Button size="sm" disabled={busy} onClick={() => void savePrep()}>
                Save preparation
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Paste an event id to preview its knowledge neighborhood and set
              preparation windows.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
