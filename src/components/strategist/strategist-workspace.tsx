"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileDown,
  Heart,
  History,
  Pin,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CONTEXT_SOURCE_OPTIONS,
  FOLLOW_UP_ACTIONS,
  RESPONSE_SECTIONS,
  STARTER_SUGGESTIONS,
  STRATEGY_CONVERSATION_TYPES,
  type StrategyConversationTypeKey,
} from "@/lib/strategist";

type ConversationListItem = {
  id: string;
  title: string;
  type: StrategyConversationTypeKey;
  pinned: boolean;
  confidence: number | null;
  contextSources: string[];
  lastMessageAt: string | null;
  updatedAt: string;
  _count: { messages: number };
};

type StructuredAdvice = {
  ok?: boolean;
  executiveSummary?: string;
  findings?: string[];
  reasoning?: string;
  recommendations?: Array<{
    title?: string;
    body?: string;
    priority?: string;
    difficulty?: string;
    expectedImpact?: string;
    estimatedTime?: string;
    dependencies?: string[];
  }>;
  risks?: string[];
  expectedImpact?: string;
  actionItems?: string[];
  confidence?: number;
};

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  structured?: StructuredAdvice | null;
  contextUsed: string[];
  confidence: number | null;
  followUpKind: string | null;
  createdAt: string;
};

type Recommendation = {
  id: string;
  title: string;
  body: string;
  priority: string;
  difficulty: string;
  expectedImpact: string | null;
  estimatedTime: string | null;
  dependencies: string[];
  status: string;
  actions: { id: string; title: string; done: boolean }[];
};

type DocumentItem = {
  id: string;
  title: string;
  type: string;
  favorited: boolean;
  sharedInternally: boolean;
  conversationId: string | null;
  contentMd?: string;
  updatedAt: string;
};

type TemplateItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  conversationType: StrategyConversationTypeKey;
  starterPrompt: string;
};

type DecisionItem = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
};

type Meta = {
  conversationTypes: typeof STRATEGY_CONVERSATION_TYPES;
  contextSources: typeof CONTEXT_SOURCE_OPTIONS;
  starters: typeof STARTER_SUGGESTIONS;
  followUps: typeof FOLLOW_UP_ACTIONS;
};

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExpandSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-left text-sm font-medium tracking-tight text-foreground/90"
      >
        <span>{title}</span>
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </button>
      {open ? <div className="pb-4 text-sm leading-relaxed text-muted-foreground">{children}</div> : null}
    </div>
  );
}

function AdviceCard({
  message,
  recommendations,
  busy,
  onFollowUp,
  onRegenerate,
  onSave,
  onDecide,
}: {
  message: Message;
  recommendations: Recommendation[];
  busy: boolean;
  onFollowUp: (kind: string) => void;
  onRegenerate: () => void;
  onSave: () => void;
  onDecide: (id: string, status: "ACCEPTED" | "REJECTED") => void;
}) {
  const structured = message.structured || {};
  const recsForMessage = recommendations.filter((r) => true);

  return (
    <article className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.04] to-transparent px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-md font-normal">
          Strategist
        </Badge>
        {typeof message.confidence === "number" ? (
          <span className="text-xs text-muted-foreground">
            Confidence {Math.round(message.confidence * 100)}%
          </span>
        ) : null}
      </div>

      {RESPONSE_SECTIONS.map((section) => {
        const value = structured[section.key as keyof StructuredAdvice];
        if (!value) return null;
        if (section.key === "recommendations") {
          return (
            <ExpandSection key={section.key} title={section.label}>
              <div className="space-y-3">
                {(Array.isArray(value) ? value : []).map((raw, idx) => {
                  const r = raw as NonNullable<StructuredAdvice["recommendations"]>[number];
                  const persisted = recsForMessage[idx];
                  return (
                    <div
                      key={persisted?.id || idx}
                      className="rounded-xl border border-white/6 bg-black/20 p-3"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{r.title}</p>
                        {r.priority ? (
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            {r.priority}
                          </Badge>
                        ) : null}
                        {r.difficulty ? (
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            {r.difficulty}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{r.body}</p>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground/90 sm:grid-cols-2">
                        <span>Impact: {r.expectedImpact || "—"}</span>
                        <span>Time: {r.estimatedTime || "—"}</span>
                        <span className="sm:col-span-2">
                          Dependencies: {(r.dependencies || []).join(", ") || "—"}
                        </span>
                      </div>
                      {persisted && persisted.status === "PENDING" ? (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => onDecide(persisted.id, "ACCEPTED")}
                          >
                            <Check className="size-3.5" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => onDecide(persisted.id, "REJECTED")}
                          >
                            <X className="size-3.5" />
                            Reject
                          </Button>
                        </div>
                      ) : persisted ? (
                        <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                          {persisted.status}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </ExpandSection>
          );
        }
        if (Array.isArray(value)) {
          return (
            <ExpandSection key={section.key} title={section.label}>
              <ul className="list-disc space-y-1 pl-5">
                {value.map((item, i) => (
                  <li key={i}>{String(item)}</li>
                ))}
              </ul>
            </ExpandSection>
          );
        }
        return (
          <ExpandSection key={section.key} title={section.label}>
            <p className="whitespace-pre-wrap text-foreground/85">{String(value)}</p>
          </ExpandSection>
        );
      })}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigator.clipboard.writeText(message.content)}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            downloadText(`strategy-${message.id}.md`, message.content, "text/markdown")
          }
        >
          <FileDown className="size-3.5" />
          Export MD
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const w = window.open("", "_blank");
            if (!w) return;
            w.document.write(
              `<html><head><title>Strategy</title><style>body{font-family:Georgia,serif;padding:40px;line-height:1.6;max-width:720px;margin:auto} h1,h2,h3{font-weight:600}</style></head><body><pre style="white-space:pre-wrap;font-family:inherit">${message.content
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")}</pre><script>window.print()<\/script></body></html>`,
            );
            w.document.close();
          }}
        >
          <FileDown className="size-3.5" />
          Export PDF
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onSave}>
          <Heart className="size-3.5" />
          Save
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onRegenerate}>
          <RefreshCw className="size-3.5" />
          Regenerate
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FOLLOW_UP_ACTIONS.map((f) => (
          <button
            key={f.key}
            type="button"
            disabled={busy}
            onClick={() => onFollowUp(f.key)}
            className="rounded-full border border-white/8 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-white/20 hover:text-foreground disabled:opacity-50"
          >
            {f.label}
          </button>
        ))}
      </div>
    </article>
  );
}

export function StrategistWorkspace({ workspaceSlug, brandSlug }: Props) {
  const page = usePageCopy("strategist");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [contextSources, setContextSources] = useState<string[]>([]);
  const [contextPayload, setContextPayload] = useState<Record<string, unknown> | null>(
    null,
  );
  const [confidence, setConfidence] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [leftTab, setLeftTab] = useState<"recent" | "library" | "decisions">("recent");

  const qs = useMemo(
    () =>
      new URLSearchParams({
        workspaceSlug,
        brandSlug,
      }).toString(),
    [workspaceSlug, brandSlug],
  );

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/strategist?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setConversations(data.conversations || []);
      setDocuments(data.documents || []);
      setDecisions(data.decisions || []);
      setTemplates(data.templates || []);
      setMeta(data.meta || null);
      setContextSources(data.defaultContextSources || []);
      if (!activeId && data.conversations?.[0]?.id) {
        setActiveId(data.conversations[0].id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load strategist");
    } finally {
      setLoading(false);
    }
  }, [qs, activeId]);

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(
          `/api/strategist?${qs}&view=conversation&conversationId=${id}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        const c = data.conversation;
        setMessages(c.messages || []);
        setRecommendations(c.recommendations || []);
        setContextSources(c.contextSources || []);
        setConfidence(c.confidence);
        const ctxRes = await fetch(
          `/api/strategist?${qs}&view=context&conversationId=${id}`,
        );
        const ctxData = await ctxRes.json();
        if (ctxRes.ok) setContextPayload(ctxData.context?.payload || null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Unable to open conversation");
      }
    },
    [qs],
  );

  useEffect(() => {
    void loadBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    if (activeId) void loadConversation(activeId);
  }, [activeId, loadConversation]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/strategist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const startConversation = async (opts?: {
    type?: StrategyConversationTypeKey;
    question?: string;
    title?: string;
  }) => {
    setBusy(true);
    try {
      const data = await post({
        intent: "create_conversation",
        type: opts?.type || "MARKETING_STRATEGY",
        title: opts?.title,
        contextSources,
      });
      setActiveId(data.conversation.id);
      await loadBootstrap();
      if (opts?.question) {
        setDraft(opts.question);
        const sent = await post({
          intent: "send_message",
          conversationId: data.conversation.id,
          question: opts.question,
        });
        setMessages(sent.conversation.messages || []);
        setRecommendations(sent.conversation.recommendations || []);
        setConfidence(sent.conversation.confidence);
        setDraft("");
        await loadBootstrap();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(false);
    }
  };

  const send = async (question: string, followUpKind?: string) => {
    if (!activeId) {
      await startConversation({ question });
      return;
    }
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    try {
      const data = await post({
        intent: "send_message",
        conversationId: activeId,
        question: q,
        followUpKind: followUpKind || null,
      });
      setMessages(data.conversation.messages || []);
      setRecommendations(data.conversation.recommendations || []);
      setConfidence(data.conversation.confidence);
      setDraft("");
      await loadBootstrap();
      const ctxRes = await fetch(
        `/api/strategist?${qs}&view=context&conversationId=${activeId}`,
      );
      const ctxData = await ctxRes.json();
      if (ctxRes.ok) setContextPayload(ctxData.context?.payload || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  };

  const toggleSource = async (key: string) => {
    const next = contextSources.includes(key)
      ? contextSources.filter((k) => k !== key)
      : [...contextSources, key];
    setContextSources(next);
    if (!activeId) return;
    try {
      await post({
        intent: "update_conversation",
        conversationId: activeId,
        contextSources: next,
      });
      const ctxRes = await fetch(
        `/api/strategist?${qs}&view=context&conversationId=${activeId}`,
      );
      const ctxData = await ctxRes.json();
      if (ctxRes.ok) setContextPayload(ctxData.context?.payload || null);
    } catch {
      toast.error("Could not update context sources");
    }
  };

  const pinned = conversations.filter((c) => c.pinned);
  const recent = conversations.filter((c) => !c.pinned);
  const active = conversations.find((c) => c.id === activeId);

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="hidden h-full rounded-2xl lg:block" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/8 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.08),_transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">{page.title}</h1>
            <p className="text-xs text-muted-foreground">
              Senior marketing counsel grounded in your business context
            </p>
          </div>
        </div>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void startConversation()}
        >
          <Plus className="size-3.5" />
          New
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        {/* LEFT */}
        <aside className="hidden min-h-0 flex-col border-r border-white/6 lg:flex">
          <div className="flex gap-1 border-b border-white/6 p-2">
            {(
              [
                ["recent", "Workspace"],
                ["library", "Library"],
                ["decisions", "Decisions"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLeftTab(key)}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium",
                  leftTab === key
                    ? "bg-white/8 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {leftTab === "recent" ? (
              <div className="space-y-4">
                {pinned.length ? (
                  <div>
                    <p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Pinned
                    </p>
                    {pinned.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveId(c.id)}
                        className={cn(
                          "mb-0.5 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm",
                          activeId === c.id ? "bg-white/8" : "hover:bg-white/4",
                        )}
                      >
                        <Pin className="mt-0.5 size-3 shrink-0 text-teal-400" />
                        <span className="line-clamp-2">{c.title}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div>
                  <p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Recent
                  </p>
                  {recent.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={cn(
                        "mb-0.5 w-full rounded-lg px-2 py-2 text-left text-sm",
                        activeId === c.id ? "bg-white/8" : "hover:bg-white/4",
                      )}
                    >
                      <span className="line-clamp-2">{c.title}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {STRATEGY_CONVERSATION_TYPES.find((t) => t.key === c.type)?.label}
                      </span>
                    </button>
                  ))}
                  {!recent.length && !pinned.length ? (
                    <p className="px-2 text-xs text-muted-foreground">No conversations yet.</p>
                  ) : null}
                </div>
                <div>
                  <p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Templates
                  </p>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void startConversation({
                          type: t.conversationType,
                          question: t.starterPrompt,
                          title: t.name,
                        })
                      }
                      className="mb-0.5 w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/4"
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {t.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {leftTab === "library" ? (
              <div className="space-y-1">
                <p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Saved Strategies
                </p>
                {documents.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-lg px-2 py-2 hover:bg-white/4"
                  >
                    <p className="text-sm font-medium">{d.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          void post({
                            intent: "update_document",
                            documentId: d.id,
                            favorited: !d.favorited,
                          }).then(() => loadBootstrap())
                        }
                      >
                        <Heart
                          className={cn(
                            "size-3",
                            d.favorited && "fill-current text-teal-400",
                          )}
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          void post({
                            intent: "update_document",
                            documentId: d.id,
                            duplicate: true,
                          }).then(() => {
                            toast.success("Duplicated");
                            return loadBootstrap();
                          })
                        }
                      >
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          void post({
                            intent: "update_document",
                            documentId: d.id,
                            sharedInternally: !d.sharedInternally,
                          }).then(() => {
                            toast.success(
                              d.sharedInternally ? "Unshared" : "Shared internally",
                            );
                            return loadBootstrap();
                          })
                        }
                      >
                        <Share2 className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          void post({
                            intent: "update_document",
                            documentId: d.id,
                            archived: true,
                          }).then(() => loadBootstrap())
                        }
                      >
                        <Archive className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!documents.length ? (
                  <p className="px-2 text-xs text-muted-foreground">
                    Save advice from a conversation to build your library.
                  </p>
                ) : null}
              </div>
            ) : null}

            {leftTab === "decisions" ? (
              <div className="space-y-1">
                <p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Decision Log
                </p>
                {decisions.map((d) => (
                  <div key={d.id} className="rounded-lg px-2 py-2 text-sm hover:bg-white/4">
                    <p className="font-medium">{d.title}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {d.status}
                    </p>
                  </div>
                ))}
                {!decisions.length ? (
                  <p className="px-2 text-xs text-muted-foreground">
                    Accept or reject recommendations to build memory.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>

        {/* CENTER */}
        <section className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-white/6 px-4 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {active?.title || "Ask your strategist"}
              </p>
              {active ? (
                <p className="text-[11px] text-muted-foreground">
                  {STRATEGY_CONVERSATION_TYPES.find((t) => t.key === active.type)?.label}
                </p>
              ) : null}
            </div>
            {activeId ? (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void post({
                      intent: "update_conversation",
                      conversationId: activeId,
                      pinned: !active?.pinned,
                    }).then(() => loadBootstrap())
                  }
                >
                  <Pin className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void post({
                      intent: "update_conversation",
                      conversationId: activeId,
                      archived: true,
                    }).then(() => {
                      setActiveId(null);
                      setMessages([]);
                      return loadBootstrap();
                    })
                  }
                >
                  <Archive className="size-3.5" />
                </Button>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!messages.length ? (
              <div className="mx-auto max-w-xl space-y-6 py-10 text-center">
                <div>
                  <h2 className="font-serif text-2xl tracking-tight text-foreground">
                    What should we decide next?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Skip prompt engineering. Ask in plain language — context is already loaded.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {(meta?.starters || STARTER_SUGGESTIONS).map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void startConversation({ type: s.type, question: s.label })
                      }
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-teal-500/40 hover:text-foreground"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {STRATEGY_CONVERSATION_TYPES.slice(0, 6).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      disabled={busy}
                      onClick={() => void startConversation({ type: t.key })}
                      className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === "USER" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-teal-500/15 px-4 py-2.5 text-sm text-foreground">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <AdviceCard
                    key={m.id}
                    message={m}
                    recommendations={recommendations}
                    busy={busy}
                    onFollowUp={(kind) => {
                      const label =
                        FOLLOW_UP_ACTIONS.find((f) => f.key === kind)?.label || kind;
                      void send(`${label} the previous advice.`, kind);
                    }}
                    onRegenerate={() => {
                      const lastUser = [...messages]
                        .reverse()
                        .find((x) => x.role === "USER");
                      if (lastUser) void send(lastUser.content);
                    }}
                    onSave={() =>
                      void post({
                        intent: "save_document",
                        conversationId: activeId,
                        messageId: m.id,
                      }).then(() => {
                        toast.success("Saved to strategy library");
                        return loadBootstrap();
                      })
                    }
                    onDecide={(id, status) =>
                      void post({
                        intent: "decide_recommendation",
                        recommendationId: id,
                        status,
                      }).then(() => {
                        toast.success(
                          status === "ACCEPTED"
                            ? "Accepted into business memory"
                            : "Rejected and logged",
                        );
                        if (activeId) return loadConversation(activeId);
                        return loadBootstrap();
                      })
                    }
                  />
                ),
              )
            )}
          </div>

          <div className="border-t border-white/6 p-3">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask your strategist…"
                className="min-h-[72px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[10px] text-muted-foreground">
                  ⌘/Ctrl + Enter to send
                </span>
                <Button
                  size="sm"
                  disabled={busy || !draft.trim()}
                  onClick={() => void send(draft)}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT */}
        <aside className="hidden min-h-0 flex-col border-l border-white/6 lg:flex">
          <div className="border-b border-white/6 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Business Context
            </p>
            {typeof confidence === "number" ? (
              <p className="mt-1 text-sm text-foreground">
                Confidence {Math.round(confidence * 100)}%
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Awaiting advice</p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Context Used
            </p>
            <div className="space-y-1.5">
              {(meta?.contextSources || CONTEXT_SOURCE_OPTIONS).map((s) => {
                const enabled = contextSources.includes(s.key);
                const preview = contextPayload?.[s.key];
                return (
                  <label
                    key={s.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-xl border px-2.5 py-2",
                      enabled ? "border-teal-500/30 bg-teal-500/5" : "border-white/6 opacity-70",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={enabled}
                      onChange={() => void toggleSource(s.key)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {s.description}
                      </span>
                      {enabled && preview != null ? (
                        <span className="mt-1 block truncate text-[10px] text-muted-foreground/80">
                          {typeof preview === "object"
                            ? JSON.stringify(preview).slice(0, 80)
                            : String(preview)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl border border-white/6 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <History className="size-3" />
                Knowledge Sources
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Advice uses only toggled sources. System prompts and model details stay hidden.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
