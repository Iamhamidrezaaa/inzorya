"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  History,
  Redo2,
  Save,
  Search,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ACTION_KINDS,
  ALL_NODE_KINDS,
  CONDITION_KINDS,
  STRUCTURAL_KINDS,
  TRIGGER_KINDS,
  findKind,
  validateFlow,
  type FlowSnapshot,
  type ValidationIssue,
  type NodeKindDef,
} from "@/lib/automation-catalog";
import {
  nodeTypes,
  type FlowNode,
  type FlowNodeData,
} from "@/components/automations/flow-nodes";

type Automation = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  tags: string[];
  version: number;
  updatedAt: string;
};

const SNAP = 16;

function toRf(snapshot: FlowSnapshot, invalidIds: Set<string>): {
  nodes: FlowNode[];
  edges: Edge[];
} {
  return {
    nodes: snapshot.nodes.map((n) => ({
      id: n.id,
      type: "automation",
      position: n.position,
      data: {
        kind: n.kind,
        label: n.label,
        description: n.description,
        config: n.config || {},
        nodeType: n.type as FlowNodeData["nodeType"],
        invalid: invalidIds.has(n.id),
      },
    })),
    edges: snapshot.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      label: e.label || undefined,
      animated: true,
      style: { stroke: "hsl(var(--primary) / 0.55)" },
    })),
  };
}

function fromRf(nodes: FlowNode[], edges: Edge[]): FlowSnapshot {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      kind: n.data.kind,
      label: n.data.label,
      description: n.data.description,
      config: n.data.config || {},
      position: n.position,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || null,
      targetHandle: e.targetHandle || null,
      label: typeof e.label === "string" ? e.label : null,
    })),
  };
}

export function AutomationBuilder({
  workspaceSlug,
  brandSlug,
  automationId,
}: {
  workspaceSlug: string;
  brandSlug: string;
  automationId: string;
}) {
  const base = `/w/${workspaceSlug}/b/${brandSlug}/automations`;
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">(
    "saved",
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [paletteQ, setPaletteQ] = useState("");
  const [history, setHistory] = useState<FlowSnapshot[]>([]);
  const [future, setFuture] = useState<FlowSnapshot[]>([]);
  const rfRef = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null);
  const skipHistory = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  const selected = nodes.find((n) => n.id === selectedId) || null;

  const pushHistory = useCallback(
    (snapshot: FlowSnapshot) => {
      if (skipHistory.current) return;
      setHistory((h) => [...h.slice(-39), snapshot]);
      setFuture([]);
    },
    [],
  );

  const applySnapshot = useCallback(
    (snapshot: FlowSnapshot, recordHistory = true) => {
      const validation = validateFlow(snapshot);
      const invalidIds = new Set(
        validation.filter((i) => i.nodeId).map((i) => i.nodeId!),
      );
      setIssues(validation);
      const rf = toRf(snapshot, invalidIds);
      skipHistory.current = true;
      setNodes(rf.nodes);
      setEdges(rf.edges);
      skipHistory.current = false;
      if (recordHistory) pushHistory(snapshot);
    },
    [pushHistory, setEdges, setNodes],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      id: automationId,
    });
    const res = await fetch(`/api/automations?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load automation.");
      return;
    }
    const data = (await res.json()) as {
      automation: Automation;
      snapshot: FlowSnapshot;
      validation: ValidationIssue[];
    };
    setAutomation(data.automation);
    applySnapshot(data.snapshot, false);
    setHistory([data.snapshot]);
    setFuture([]);
    setIssues(data.validation);
    hydrated.current = true;
    setSaveState("saved");
  }, [workspaceSlug, brandSlug, automationId, applySnapshot]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (opts?: { bumpVersion?: boolean; silent?: boolean }) => {
      if (!automation) return;
      const snapshot = fromRf(nodes, edges);
      setSaving(true);
      setSaveState("saving");
      const res = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          brandSlug,
          id: automation.id,
          name: automation.name,
          description: automation.description,
          category: automation.category,
          status: automation.status,
          tags: automation.tags,
          snapshot,
          bumpVersion: opts?.bumpVersion,
        }),
      });
      setSaving(false);
      if (!res.ok) {
        toast.error("Save failed.");
        setSaveState("dirty");
        return;
      }
      const data = (await res.json()) as {
        automation: Automation;
        validation: ValidationIssue[];
        snapshot: FlowSnapshot;
      };
      setAutomation(data.automation);
      setIssues(data.validation);
      if (opts?.bumpVersion) {
        applySnapshot(data.snapshot, false);
      }
      setSaveState("saved");
      if (!opts?.silent) toast.success("Saved.");
    },
    [automation, nodes, edges, workspaceSlug, brandSlug, applySnapshot],
  );

  // Mark dirty + autosave
  useEffect(() => {
    if (!hydrated.current) return;
    setSaveState((s) => (s === "saving" ? s : "dirty"));
    const snapshot = fromRf(nodes, edges);
    setIssues(validateFlow(snapshot));
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persist({ silent: true });
    }, 1600);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to graph edits
  }, [nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${Date.now()}`,
            animated: true,
            style: { stroke: "hsl(var(--primary) / 0.55)" },
          },
          eds,
        );
        pushHistory(fromRf(nodes, next));
        return next;
      });
    },
    [nodes, pushHistory, setEdges],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedId(params.nodes[0]?.id ?? null);
  }, []);

  function undo() {
    if (history.length < 2) return;
    const prev = history[history.length - 2]!;
    const current = history[history.length - 1]!;
    setFuture((f) => [current, ...f]);
    setHistory((h) => h.slice(0, -1));
    applySnapshot(prev, false);
  }

  function redo() {
    if (!future[0]) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, next]);
    applySnapshot(next, false);
  }

  function addNode(def: NodeKindDef, position?: { x: number; y: number }) {
    if (def.disabled) {
      toast.error("This node type is disabled.");
      return;
    }
    const id = `n-${Date.now()}`;
    const pos =
      position ||
      rfRef.current?.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }) || { x: 200, y: 200 };
    const snapped = {
      x: Math.round(pos.x / SNAP) * SNAP,
      y: Math.round(pos.y / SNAP) * SNAP,
    };
    const node: FlowNode = {
      id,
      type: "automation",
      position: snapped,
      data: {
        kind: def.kind,
        label: def.label,
        description: def.description,
        config: {},
        nodeType: def.type,
      },
    };
    setNodes((ns) => {
      const next = [...ns, node];
      pushHistory(fromRf(next, edges));
      return next;
    });
    setSelectedId(id);
  }

  function updateSelected(patch: Partial<FlowNodeData>) {
    if (!selectedId) return;
    setNodes((ns) => {
      const next = ns.map((n) =>
        n.id === selectedId
          ? { ...n, data: { ...n.data, ...patch } }
          : n,
      );
      pushHistory(fromRf(next, edges));
      return next;
    });
  }

  function deleteSelected() {
    if (!selectedId) return;
    setNodes((ns) => {
      const next = ns.filter((n) => n.id !== selectedId);
      setEdges((eds) => {
        const nextEdges = eds.filter(
          (e) => e.source !== selectedId && e.target !== selectedId,
        );
        pushHistory(fromRf(next, nextEdges));
        return nextEdges;
      });
      return next;
    });
    setSelectedId(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void persist({ bumpVersion: true });
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        redo();
      }
      if (!typing && (e.key === "Delete" || e.key === "Backspace")) {
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onDragStart(e: DragEvent, def: NodeKindDef) {
    e.dataTransfer.setData("application/inzorya-node", JSON.stringify(def));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/inzorya-node");
    if (!raw || !rfRef.current) return;
    const def = JSON.parse(raw) as NodeKindDef;
    const position = rfRef.current.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });
    addNode(def, position);
  }

  function exportJson() {
    const snapshot = fromRf(nodes, edges);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            name: automation?.name,
            snapshot,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${automation?.name || "automation"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function bumpVersion() {
    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "version",
        workspaceSlug,
        brandSlug,
        id: automationId,
        note: "Manual version",
      }),
    });
    if (!res.ok) {
      toast.error("Version failed.");
      return;
    }
    const data = (await res.json()) as { automation: Automation };
    setAutomation(data.automation);
    toast.success(`Version ${data.automation.version} saved.`);
  }

  const paletteGroups = useMemo(() => {
    const q = paletteQ.trim().toLowerCase();
    const filter = (items: NodeKindDef[]) =>
      items.filter(
        (i) =>
          !q ||
          i.label.toLowerCase().includes(q) ||
          i.kind.toLowerCase().includes(q),
      );
    return [
      { title: "Triggers", items: filter(TRIGGER_KINDS) },
      { title: "Conditions", items: filter(CONDITION_KINDS) },
      { title: "Actions & flow", items: filter([...ACTION_KINDS, ...STRUCTURAL_KINDS]) },
    ];
  }, [paletteQ]);

  const kindDef = selected ? findKind(selected.data.kind) : null;
  const errorCount = issues.filter((i) => i.severity === "error").length;

  if (loading || !automation) {
    return (
      <div className="space-y-3 p-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[70vh] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100svh-3.5rem)] flex-col md:-mx-8">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-2.5">
        <Button size="sm" variant="ghost" asChild>
          <Link href={base}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Input
          className="h-8 max-w-xs font-medium"
          value={automation.name}
          onChange={(e) =>
            setAutomation((a) => (a ? { ...a, name: e.target.value } : a))
          }
          onBlur={() => void persist({ silent: true })}
        />
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={automation.status}
          onChange={(e) => {
            setAutomation((a) =>
              a
                ? {
                    ...a,
                    status: e.target.value as Automation["status"],
                  }
                : a,
            );
            setTimeout(() => void persist({ silent: true }), 0);
          }}
        >
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <Badge variant="muted">v{automation.version}</Badge>
        <span className="text-[11px] text-muted-foreground">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "dirty"
              ? "Unsaved changes"
              : "Autosaved"}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={undo} disabled={history.length < 2}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={!future.length}>
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => void bumpVersion()}>
            <History className="h-4 w-4" />
            Version
          </Button>
          <Button size="sm" variant="outline" onClick={exportJson}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => void persist({ bumpVersion: true })}
          >
            {saveState === "saved" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* Palette */}
        <aside className="hidden min-h-0 flex-col border-r border-border/80 bg-background/40 lg:flex">
          <div className="border-b border-border/80 p-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-xs"
                placeholder="Search nodes…"
                value={paletteQ}
                onChange={(e) => setPaletteQ(e.target.value)}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            {paletteGroups.map((g) => (
              <div key={g.title}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.title}
                </div>
                <div className="space-y-1">
                  {g.items.map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      draggable={!item.disabled}
                      onDragStart={(e) => onDragStart(e, item)}
                      onClick={() => addNode(item)}
                      disabled={item.disabled}
                      className={cn(
                        "w-full rounded-lg border border-border/60 px-2.5 py-2 text-left text-xs transition hover:border-primary/40 hover:bg-primary/5",
                        item.disabled && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <div className="font-medium">{item.label}</div>
                      <div className="line-clamp-1 text-[10px] text-muted-foreground">
                        {item.disabled ? "Disabled" : item.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <div
          className="relative min-h-0 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.07),_transparent_50%)]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => {
              onNodesChange(changes);
            }}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onNodeDragStop={() => pushHistory(fromRf(nodes, edges))}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[SNAP, SNAP]}
            panOnScroll
            selectionOnDrag
            onInit={(instance) => {
              rfRef.current = instance;
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={SNAP}
              size={1}
              color="hsl(var(--muted-foreground) / 0.25)"
            />
            <Controls className="!bg-background !border-border !shadow-md" />
            <MiniMap
              className="!bg-background/90 !border-border"
              nodeColor={() => "hsl(var(--primary) / 0.7)"}
              maskColor="rgba(0,0,0,0.55)"
            />
          </ReactFlow>
          {errorCount > 0 ? (
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {errorCount} validation issue{errorCount === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-border/80 bg-background/40 lg:flex">
          <div className="border-b border-border/80 p-3">
            <h2 className="text-sm font-semibold">
              {selected ? "Node properties" : "Workflow"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {selected
                ? "Configure this step. Execution is mocked."
                : "Select a node or review validation."}
            </p>
          </div>

          {selected ? (
            <div className="space-y-3 p-3">
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Label
                </span>
                <Input
                  value={selected.data.label}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Description
                </span>
                <Textarea
                  rows={2}
                  value={selected.data.description || ""}
                  onChange={(e) =>
                    updateSelected({ description: e.target.value })
                  }
                />
              </label>
              <div className="rounded-lg border border-border/60 px-2.5 py-2 text-xs">
                <div className="text-muted-foreground">Type / kind</div>
                <div className="mt-0.5 font-medium">
                  {selected.data.nodeType} · {selected.data.kind}
                </div>
              </div>
              {kindDef?.fields?.map((field) => (
                <label key={field.key} className="block space-y-1">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    {field.label}
                  </span>
                  {field.type === "select" && field.options ? (
                    <select
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                      value={String(selected.data.config[field.key] || "")}
                      onChange={(e) =>
                        updateSelected({
                          config: {
                            ...selected.data.config,
                            [field.key]: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="">Select…</option>
                      {field.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={field.type === "number" ? "number" : "text"}
                      placeholder={field.placeholder}
                      value={String(selected.data.config[field.key] ?? "")}
                      onChange={(e) =>
                        updateSelected({
                          config: {
                            ...selected.data.config,
                            [field.key]:
                              field.type === "number"
                                ? Number(e.target.value)
                                : e.target.value,
                          },
                        })
                      }
                    />
                  )}
                </label>
              ))}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[11px] text-muted-foreground">
                Configuration is stored for future execution. No live runs yet.
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={deleteSelected}
              >
                Delete node
              </Button>
            </div>
          ) : (
            <div className="space-y-3 p-3">
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Description
                </span>
                <Textarea
                  rows={3}
                  value={automation.description || ""}
                  onChange={(e) =>
                    setAutomation((a) =>
                      a ? { ...a, description: e.target.value } : a,
                    )
                  }
                  onBlur={() => void persist({ silent: true })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Category
                </span>
                <Input
                  value={automation.category || ""}
                  onChange={(e) =>
                    setAutomation((a) =>
                      a ? { ...a, category: e.target.value } : a,
                    )
                  }
                  onBlur={() => void persist({ silent: true })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Tags
                </span>
                <Input
                  value={automation.tags.join(", ")}
                  onChange={(e) =>
                    setAutomation((a) =>
                      a
                        ? {
                            ...a,
                            tags: e.target.value
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean),
                          }
                        : a,
                    )
                  }
                  onBlur={() => void persist({ silent: true })}
                />
              </label>
            </div>
          )}

          <div className="mt-auto border-t border-border/80 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Validation
            </div>
            {issues.length === 0 ? (
              <p className="text-xs text-emerald-400">Flow looks valid.</p>
            ) : (
              <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                {issues.map((issue, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-[11px]",
                        issue.severity === "error"
                          ? "bg-rose-500/10 text-rose-300"
                          : "bg-amber-500/10 text-amber-200",
                      )}
                      onClick={() => {
                        if (issue.nodeId) {
                          setSelectedId(issue.nodeId);
                          const node = nodes.find((n) => n.id === issue.nodeId);
                          if (node && rfRef.current) {
                            rfRef.current.setCenter(
                              node.position.x + 90,
                              node.position.y + 40,
                              { zoom: 1.1, duration: 400 },
                            );
                          }
                        }
                      }}
                    >
                      {issue.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[10px] text-muted-foreground">
              Shortcuts: ⌘/Ctrl+S save · ⌘/Ctrl+Z undo · Del delete · drag nodes
              from palette
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Keep ALL_NODE_KINDS referenced for tree-shaking safety in some bundlers
void ALL_NODE_KINDS;
