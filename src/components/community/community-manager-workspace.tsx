"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Headphones,
  Loader2,
  MessageSquareWarning,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  COMMUNITY_TONES,
  INTENT_TYPES,
  QUALITY_DIMENSIONS,
  RESPONSE_MODES,
} from "@/lib/community";

type SuggestedReply = {
  id: string;
  kind: string;
  status: string;
  body: string;
  confidence: number;
  qualityScore: number | null;
  qualityBreakdown: Record<string, number> | null;
  explanation: string | null;
};

type QueueItem = {
  id: string;
  subject: string | null;
  status: string;
  lastMessageAt: string;
  contact: { id: string; name: string | null; tags: string[] };
  assignee: { id: string; name: string | null; email: string } | null;
  intent: {
    type: string;
    confidence: number;
    explanation: string | null;
  } | null;
  priority: {
    score: number;
    rankReason: string;
    vip: boolean;
    urgent: boolean;
    negativeSentiment?: boolean;
  } | null;
  sentiment: {
    label: string;
    score: number;
    buyingIntent: number;
    urgency: number;
    salesOpportunity: number;
    retentionRisk: number;
    explanation: string | null;
  } | null;
  suggestedReplies: SuggestedReply[];
  messages: Array<{ id: string; body: string; direction: string; createdAt: string }>;
};

type Member = { id: string; name: string | null; email: string };

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

export function CommunityManagerWorkspace({
  workspaceSlug,
  brandSlug,
}: Props) {
  const page = usePageCopy("community");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [dashboard, setDashboard] = useState({
    inboxHealth: 0,
    averageResponseMinutes: null as number | null,
    pendingReplies: 0,
    vipQueue: 0,
    negativeSentiment: 0,
    resolvedToday: 0,
    leadOpportunities: 0,
    unanswered: 0,
  });
  const [responseMode, setResponseMode] = useState("APPROVAL_REQUIRED");
  const [tone, setTone] = useState("FRIENDLY");
  const [autoCategories, setAutoCategories] = useState<string[]>([
    "QUESTION",
    "COMPLIMENT",
  ]);
  const [autoRules, setAutoRules] = useState<
    Array<{ id: string; name: string; intentType: string; enabled: boolean; autoSend: boolean }>
  >([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | "vip" | "negative" | "leads">("all");

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const apply = (data: Record<string, unknown>) => {
    setQueue((data.queue as QueueItem[]) || []);
    setDashboard((data.dashboard as typeof dashboard) || dashboard);
    setMembers((data.members as Member[]) || []);
    setAutoRules((data.autoRules as typeof autoRules) || []);
    const rule = data.rule as {
      responseMode?: string;
      tone?: string;
      autoCategories?: string[];
    } | null;
    if (rule?.responseMode) setResponseMode(rule.responseMode);
    if (rule?.tone) setTone(rule.tone);
    if (rule?.autoCategories) setAutoCategories(rule.autoCategories);
    if (!activeId && (data.queue as QueueItem[])?.[0]?.id) {
      setActiveId((data.queue as QueueItem[])[0].id);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/community?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      apply(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const scan = async () => {
    setBusy(true);
    try {
      const data = await post({ intent: "scan" });
      apply(data.dashboard);
      toast.success("Inbox intelligence updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    try {
      await post({
        intent: "settings",
        responseMode,
        tone,
        autoCategories,
      });
      toast.success("Community settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const active = queue.find((q) => q.id === activeId) || null;
  const primaryReply = active?.suggestedReplies?.[0] || null;

  useEffect(() => {
    if (primaryReply) setEditBody(primaryReply.body);
  }, [primaryReply?.id]);

  const filtered = queue.filter((q) => {
    if (filter === "vip") return q.priority?.vip || q.intent?.type === "VIP";
    if (filter === "negative")
      return q.sentiment?.label === "negative" || q.priority?.negativeSentiment;
    if (filter === "leads") return q.intent?.type === "SALES_LEAD";
    return true;
  });

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="hidden h-full rounded-2xl lg:block" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/8 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.08),_transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
            <Headphones className="size-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              {page.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              Prioritize, draft, and assist — never a blind auto-reply bot
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/w/${workspaceSlug}/b/${brandSlug}/inbox`}>Open Inbox</Link>
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void scan()}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Scan inbox
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* LEFT — health + settings */}
        <aside className="hidden min-h-0 flex-col border-r border-white/6 lg:flex">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Inbox health", dashboard.inboxHealth],
                ["Pending", dashboard.pendingReplies],
                ["VIP queue", dashboard.vipQueue],
                ["Negative", dashboard.negativeSentiment],
                ["Leads", dashboard.leadOpportunities],
                ["Resolved today", dashboard.resolvedToday],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-xl border border-white/8 bg-black/20 px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="font-serif text-xl tracking-tight">{value as number}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg response:{" "}
              {dashboard.averageResponseMinutes != null
                ? `${dashboard.averageResponseMinutes} min`
                : "—"}{" "}
              · Unanswered: {dashboard.unanswered}
            </p>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Response mode
              </p>
              {RESPONSE_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setResponseMode(m.key)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left",
                    responseMode === m.key
                      ? "border-teal-500/40 bg-teal-500/10"
                      : "border-white/8 hover:bg-white/4",
                  )}
                >
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-[11px] text-muted-foreground">{m.description}</p>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Tone engine</Label>
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                {COMMUNITY_TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Semi-auto categories</Label>
              <div className="flex flex-wrap gap-1">
                {INTENT_TYPES.filter((i) => i.key !== "OTHER").map((i) => {
                  const on = autoCategories.includes(i.key);
                  return (
                    <button
                      key={i.key}
                      type="button"
                      onClick={() =>
                        setAutoCategories((prev) =>
                          on ? prev.filter((x) => x !== i.key) : [...prev, i.key],
                        )
                      }
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px]",
                        on
                          ? "border-teal-500/40 bg-teal-500/10"
                          : "border-white/10 text-muted-foreground",
                      )}
                    >
                      {i.label}
                    </button>
                  );
                })}
              </div>
              <Button size="sm" className="w-full" onClick={() => void saveSettings()}>
                Save settings
              </Button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Auto-reply rules
              </p>
              <p className="text-[11px] text-muted-foreground">
                Auto-send stays off unless you explicitly enable it — never outside approved rules.
              </p>
              {autoRules.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-white/8 px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        void post({
                          intent: "auto_rule",
                          ruleId: r.id,
                          enabled: !r.enabled,
                        }).then(() => load())
                      }
                    >
                      {r.enabled ? "On" : "Off"}
                    </button>
                  </div>
                  <p className="text-muted-foreground">{r.intentType}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER — priority queue */}
        <section className="flex min-h-0 flex-col">
          <div className="flex gap-1 border-b border-white/6 px-3 py-2">
            {(
              [
                ["all", "Priority queue"],
                ["vip", "VIP"],
                ["negative", "Negative"],
                ["leads", "Leads"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs",
                  filter === key
                    ? "bg-white/8 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {!filtered.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <Users className="size-8 text-muted-foreground" />
                <div>
                  <h2 className="font-serif text-2xl tracking-tight">
                    Scan to prioritize conversations
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    AI classifies intent, ranks urgency, and drafts brand-safe suggestions
                    grounded in Business Brain and Knowledge Base.
                  </p>
                </div>
                <Button disabled={busy} onClick={() => void scan()}>
                  <Sparkles className="size-3.5" />
                  Run first scan
                </Button>
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left",
                    activeId === c.id
                      ? "border-teal-500/40 bg-teal-500/10"
                      : "border-white/8 bg-black/15 hover:bg-white/[0.03]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        {c.intent ? (
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            {c.intent.type.replaceAll("_", " ")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            Unscanned
                          </Badge>
                        )}
                        {c.priority?.vip ? (
                          <Badge variant="secondary" className="rounded-md text-[10px]">
                            VIP
                          </Badge>
                        ) : null}
                        {c.priority?.urgent ? (
                          <Badge
                            variant="secondary"
                            className="rounded-md bg-amber-500/20 text-[10px]"
                          >
                            Urgent
                          </Badge>
                        ) : null}
                        {c.sentiment?.label === "negative" ? (
                          <MessageSquareWarning className="size-3.5 text-amber-400" />
                        ) : null}
                      </div>
                      <p className="truncate text-sm font-medium">
                        {c.contact.name || "Unknown"} · {c.subject || "Conversation"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {c.priority?.rankReason ||
                          c.messages[0]?.body ||
                          "Awaiting intelligence scan"}
                      </p>
                    </div>
                    <p className="font-serif text-xl tracking-tight">
                      {Math.round(c.priority?.score || 0)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* RIGHT — detail + suggestions */}
        <aside className="hidden min-h-0 flex-col border-l border-white/6 lg:flex">
          <div className="border-b border-white/6 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Assist panel
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            {!active ? (
              <p className="text-xs text-muted-foreground">
                Select a conversation to review insights and reply drafts.
              </p>
            ) : (
              <>
                <div>
                  <h2 className="font-serif text-xl tracking-tight">
                    {active.contact.name || "Customer"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {active.subject || "Conversation"} · {active.status}
                  </p>
                </div>

                {active.intent ? (
                  <div className="rounded-xl border border-white/8 px-3 py-2 text-xs">
                    <p className="font-medium">
                      Intent · {active.intent.type.replaceAll("_", " ")} (
                      {Math.round(active.intent.confidence * 100)}% confidence)
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {active.intent.explanation}
                    </p>
                  </div>
                ) : null}

                {active.sentiment ? (
                  <div className="space-y-1 text-xs">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Conversation insights
                    </p>
                    <p>Sentiment: {active.sentiment.label}</p>
                    <p>Buying intent: {Math.round(active.sentiment.buyingIntent)}</p>
                    <p>Sales opportunity: {Math.round(active.sentiment.salesOpportunity)}</p>
                    <p>Retention risk: {Math.round(active.sentiment.retentionRisk)}</p>
                    <p className="text-muted-foreground">{active.sentiment.explanation}</p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Recent messages
                  </p>
                  {[...active.messages].reverse().map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs",
                        m.direction === "INBOUND"
                          ? "bg-white/5"
                          : "border border-teal-500/20 bg-teal-500/5",
                      )}
                    >
                      <span className="text-[10px] text-muted-foreground">
                        {m.direction}
                      </span>
                      <p>{m.body}</p>
                    </div>
                  ))}
                </div>

                {primaryReply ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Suggested {primaryReply.kind.replaceAll("_", " ")}
                      </p>
                      <Badge variant="outline" className="rounded-md text-[10px]">
                        {Math.round(primaryReply.confidence * 100)}% conf · score{" "}
                        {Math.round(primaryReply.qualityScore || 0)}
                      </Badge>
                    </div>
                    {primaryReply.explanation ? (
                      <p className="text-[11px] text-muted-foreground">
                        {primaryReply.explanation}
                      </p>
                    ) : null}
                    {primaryReply.qualityBreakdown ? (
                      <div className="space-y-1">
                        {QUALITY_DIMENSIONS.map((d) => {
                          const v = Number(
                            primaryReply.qualityBreakdown?.[d.key] ?? 0,
                          );
                          return (
                            <div key={d.key}>
                              <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                                <span>{d.label}</span>
                                <span>{Math.round(v)}</span>
                              </div>
                              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                                <div
                                  className="h-full rounded-full bg-teal-400/80"
                                  style={{ width: `${Math.min(100, v)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <Textarea
                      className="min-h-[120px]"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void post({
                            intent: "review_reply",
                            replyId: primaryReply.id,
                            action:
                              editBody.trim() !== primaryReply.body
                                ? "edit_send"
                                : "approve",
                            editedBody: editBody,
                          }).then(() => {
                            toast.success("Reply sent to conversation");
                            return load();
                          })
                        }
                      >
                        <Check className="size-3.5" />
                        Approve & send
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void post({
                            intent: "review_reply",
                            replyId: primaryReply.id,
                            action: "reject",
                          }).then(() => {
                            toast.success("Rejected — learning updated");
                            return load();
                          })
                        }
                      >
                        <X className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                    {active.suggestedReplies.length > 1 ? (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">More suggestions</p>
                        {active.suggestedReplies.slice(1).map((s) => (
                          <p
                            key={s.id}
                            className="rounded-lg border border-white/8 px-2 py-1.5 text-[11px] text-muted-foreground"
                          >
                            <span className="font-medium text-foreground/80">
                              {s.kind}:{" "}
                            </span>
                            {s.body}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-muted-foreground">
                    <AlertTriangle className="mx-auto mb-2 size-4" />
                    No drafts yet — run Scan inbox.
                  </div>
                )}

                <div className="space-y-2 border-t border-white/6 pt-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Team collaboration
                  </p>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                    value={active.assignee?.id || ""}
                    onChange={(e) =>
                      void post({
                        intent: "collaborate",
                        conversationId: active.id,
                        assigneeId: e.target.value || null,
                      }).then(() => load())
                    }
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    {(["OPEN", "WAITING", "RESOLVED"] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="ghost"
                        className="text-[11px]"
                        onClick={() =>
                          void post({
                            intent: "collaborate",
                            conversationId: active.id,
                            status: s,
                          }).then(() => load())
                        }
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Internal note / @mention…"
                    className="min-h-[64px]"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!note.trim()}
                    onClick={() =>
                      void post({
                        intent: "collaborate",
                        conversationId: active.id,
                        note,
                      }).then(() => {
                        setNote("");
                        toast.success("Note added");
                        return load();
                      })
                    }
                  >
                    Add note
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
