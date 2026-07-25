"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { toast } from "sonner";
import {
  Archive,
  Briefcase,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  FileText,
  Globe2,
  Inbox,
  MessageCircle,
  Mic,
  Music2,
  Paperclip,
  Plus,
  Radio,
  Search,
  Send,
  Share2,
  Smile,
  Star,
  StickyNote,
  Tag,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Agent = { id: string; name: string | null; email: string; image?: string | null };
type InboxTag = { id: string; name: string; color: string | null };
type SavedReply = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  shortcut: string | null;
};
type Attachment = {
  id: string;
  url: string;
  filename: string | null;
  mimeType: string | null;
  kind: string;
};
type Contact = {
  id: string;
  name: string | null;
  instagramUsername: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  language: string | null;
  leadStatus: string | null;
  lifetimeValue: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
  tags: string[];
  notes: string | null;
};
type Message = {
  id: string;
  body: string;
  direction: "INBOUND" | "OUTBOUND" | "SYSTEM";
  kind: string;
  deliveryStatus: string;
  isInternal: boolean;
  createdAt: string;
  attachments: Attachment[];
  author?: Agent | null;
};
type EventItem = {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  user?: Agent | null;
};
type Note = {
  id: string;
  body: string;
  createdAt: string;
  user: Agent;
};
type Conversation = {
  id: string;
  subject: string | null;
  status: "OPEN" | "WAITING" | "RESOLVED" | "CLOSED" | "ARCHIVED";
  isUnread: boolean;
  unreadCount: number;
  isStarred: boolean;
  lastMessageAt: string;
  contact: Contact;
  channel: {
    socialChannel: { platform: string; name: string };
    status: string;
    accountHandle?: string | null;
  } | null;
  assignee: Agent | null;
  messages: Message[];
  events?: EventItem[];
  tagLinks?: { tag: InboxTag }[];
  internalNotes?: Note[];
};

type PrevConvo = {
  id: string;
  subject: string | null;
  status: string;
  lastMessageAt: string;
  channel: { socialChannel: { name: string; platform: string } } | null;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "open", label: "Open" },
  { id: "assigned", label: "Assigned" },
  { id: "waiting", label: "Waiting" },
  { id: "closed", label: "Closed" },
  { id: "archived", label: "Archived" },
  { id: "starred", label: "Starred" },
] as const;

const STATUS_OPTIONS = ["OPEN", "WAITING", "RESOLVED", "CLOSED", "ARCHIVED"] as const;

const EMOJIS = ["👍", "🙏", "😊", "🔥", "✅", "❤️", "🎉", "👋"];

const PLATFORM_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  INSTAGRAM: Share2,
  FACEBOOK: Globe2,
  WHATSAPP: MessageCircle,
  TELEGRAM: Send,
  LINKEDIN: Briefcase,
  X: Radio,
  YOUTUBE: Video,
  TIKTOK: Music2,
};

const MOCK_ORDERS = [
  { id: "#4821", total: "$128", status: "Processing" },
  { id: "#4710", total: "$64", status: "Delivered" },
];

function displayName(contact: Contact) {
  return (
    contact.name ||
    (contact.instagramUsername ? `@${contact.instagramUsername}` : null) ||
    contact.email ||
    "Unknown contact"
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PlatformIcon({ platform }: { platform?: string }) {
  const Icon = PLATFORM_ICONS[platform || ""] || MessageCircle;
  return <Icon className="h-3.5 w-3.5" />;
}

export function InboxView({
  workspaceSlug,
  brandSlug,
  currentUserId: _currentUserId,
}: {
  workspaceSlug: string;
  brandSlug: string;
  currentUserId: string;
}) {
  void _currentUserId;
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [list, setList] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [previous, setPrevious] = useState<PrevConvo[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replySearch, setReplySearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [tags, setTags] = useState<InboxTag[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [replyForm, setReplyForm] = useState({
    title: "",
    body: "",
    category: "",
    shortcut: "",
  });
  const [rightTab, setRightTab] = useState<
    "profile" | "timeline" | "notes" | "activity"
  >("profile");
  const [mobilePane, setMobilePane] = useState<"list" | "thread" | "customer">(
    "list",
  );

  const loadMeta = useCallback(async () => {
    const params = new URLSearchParams({ workspaceSlug, brandSlug });
    const res = await fetch(`/api/inbox?${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      tags: InboxTag[];
      savedReplies: SavedReply[];
      agents: Agent[];
    };
    setTags(data.tags);
    setSavedReplies(data.savedReplies);
    setAgents(data.agents);
  }, [workspaceSlug, brandSlug]);

  const loadList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      filter,
      ...(q ? { q } : {}),
      ...(channelFilter ? { channel: channelFilter } : {}),
      ...(tagFilter ? { tag: tagFilter } : {}),
      ...(agentFilter ? { agent: agentFilter } : {}),
    });
    const res = await fetch(`/api/conversations?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load inbox.");
      return;
    }
    const data = (await res.json()) as { conversations: Conversation[] };
    setList(data.conversations);
    setSelectedId((prev) => {
      if (prev && data.conversations.some((c) => c.id === prev)) return prev;
      return data.conversations[0]?.id ?? null;
    });
  }, [workspaceSlug, brandSlug, filter, q, channelFilter, tagFilter, agentFilter]);

  const loadOne = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      const params = new URLSearchParams({ workspaceSlug, brandSlug, id });
      const res = await fetch(`/api/conversations?${params}`);
      setDetailLoading(false);
      if (!res.ok) return;
      const data = (await res.json()) as {
        conversation: Conversation;
        previousConversations: PrevConvo[];
      };
      setSelected(data.conversation);
      setPrevious(data.previousConversations || []);
      setTyping(Math.random() > 0.7 && data.conversation.isUnread);
      if (data.conversation.isUnread) {
        void fetch("/api/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceSlug,
            brandSlug,
            id,
            isUnread: false,
          }),
        }).then(() => {
          setList((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, isUnread: false, unreadCount: 0 } : c,
            ),
          );
        });
      }
    },
    [workspaceSlug, brandSlug],
  );

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    const t = setTimeout(() => void loadList(), 180);
    return () => clearTimeout(t);
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadOne(selectedId);
  }, [selectedId, loadOne]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typingInField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        setShowEmoji(false);
        setShowReplies(false);
        if (!typingInField) {
          setSelectedId(null);
          setSelected(null);
          setMobilePane("list");
        }
        return;
      }
      if (typingInField) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!list.length) return;
        const idx = list.findIndex((c) => c.id === selectedId);
        const next =
          e.key === "ArrowDown"
            ? Math.min(list.length - 1, Math.max(0, idx) + 1)
            : Math.max(0, (idx < 0 ? 0 : idx) - 1);
        setSelectedId(list[next]!.id);
        setMobilePane("thread");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, selectedId]);

  const filteredReplies = useMemo(() => {
    const s = replySearch.trim().toLowerCase();
    if (!s) return savedReplies;
    return savedReplies.filter(
      (r) =>
        r.title.toLowerCase().includes(s) ||
        r.body.toLowerCase().includes(s) ||
        (r.shortcut || "").toLowerCase().includes(s) ||
        (r.category || "").toLowerCase().includes(s),
    );
  }, [savedReplies, replySearch]);

  const timeline = useMemo(() => {
    if (!selected) return [] as Array<
      | { kind: "message"; at: string; data: Message }
      | { kind: "event"; at: string; data: EventItem }
    >;
    const items = [
      ...(selected.messages || []).map((m) => ({
        kind: "message" as const,
        at: m.createdAt,
        data: m,
      })),
      ...(selected.events || []).map((ev) => ({
        kind: "event" as const,
        at: ev.createdAt,
        data: ev,
      })),
    ];
    return items.sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  }, [selected]);

  async function patchConversation(
    patch: Record<string, unknown>,
    optimistic?: Partial<Conversation>,
  ) {
    if (!selected) return;
    if (optimistic) {
      setSelected({ ...selected, ...optimistic });
      setList((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, ...optimistic } : c)),
      );
    }
    const res = await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        id: selected.id,
        ...patch,
      }),
    });
    if (!res.ok) {
      toast.error("Update failed.");
      await loadOne(selected.id);
      return;
    }
    const data = (await res.json()) as { conversation: Conversation };
    setSelected(data.conversation);
    await loadList();
    router.refresh();
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const optimisticBody = reply.trim();
    const optimisticMsg: Message = {
      id: `tmp-${Date.now()}`,
      body: optimisticBody,
      direction: isInternal ? "SYSTEM" : "OUTBOUND",
      kind: "TEXT",
      deliveryStatus: "SENDING",
      isInternal,
      createdAt: new Date().toISOString(),
      attachments: [],
    };
    setSelected({
      ...selected,
      messages: [...selected.messages, optimisticMsg],
    });
    setReply("");
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "message",
        workspaceSlug,
        brandSlug,
        conversationId: selected.id,
        body: optimisticBody,
        isInternal,
      }),
    });
    setSending(false);
    if (!res.ok) {
      toast.error("Could not send.");
      await loadOne(selected.id);
      return;
    }
    const data = (await res.json()) as { conversation: Conversation };
    setSelected(data.conversation);
    setTyping(false);
    toast.success(isInternal ? "Internal note posted." : "Reply sent.");
    await loadList();
  }

  async function addInternalNote() {
    if (!selected || !noteDraft.trim()) return;
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "note",
        workspaceSlug,
        brandSlug,
        conversationId: selected.id,
        body: noteDraft.trim(),
      }),
    });
    if (!res.ok) {
      toast.error("Could not save note.");
      return;
    }
    const data = (await res.json()) as { conversation: Conversation };
    setSelected(data.conversation);
    setNoteDraft("");
    toast.success("Note saved.");
  }

  async function toggleTag(tag: InboxTag) {
    if (!selected) return;
    const current = (selected.tagLinks || []).map((t) => t.tag.name);
    const next = current.includes(tag.name)
      ? current.filter((n) => n !== tag.name)
      : [...current, tag.name];
    await patchConversation({ tagNames: next });
  }

  async function createTag() {
    if (!tagInput.trim()) return;
    const res = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "tag",
        workspaceSlug,
        brandSlug,
        name: tagInput.trim(),
      }),
    });
    if (!res.ok) {
      toast.error("Could not create tag.");
      return;
    }
    const data = (await res.json()) as { tag: InboxTag };
    setTags((prev) =>
      prev.some((t) => t.id === data.tag.id) ? prev : [...prev, data.tag],
    );
    setTagInput("");
    if (selected) {
      const names = [
        ...new Set([
          ...(selected.tagLinks || []).map((t) => t.tag.name),
          data.tag.name,
        ]),
      ];
      await patchConversation({ tagNames: names });
    }
  }

  async function saveReplyTemplate() {
    if (!replyForm.title.trim() || !replyForm.body.trim()) return;
    const res = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "savedReply",
        workspaceSlug,
        brandSlug,
        ...replyForm,
        category: replyForm.category || null,
        shortcut: replyForm.shortcut || null,
      }),
    });
    if (!res.ok) {
      toast.error("Could not save reply.");
      return;
    }
    setReplyForm({ title: "", body: "", category: "", shortcut: "" });
    await loadMeta();
    toast.success("Saved reply created.");
  }

  async function deleteReply(id: string) {
    const res = await fetch("/api/inbox", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "savedReply",
        workspaceSlug,
        brandSlug,
        id,
      }),
    });
    if (!res.ok) {
      toast.error("Could not delete.");
      return;
    }
    await loadMeta();
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendReply();
    }
  }

  const conversationTags = selected?.tagLinks?.map((t) => t.tag) || [];

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100svh-3.5rem)] flex-col bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.08),_transparent_55%)] md:-mx-8">
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 md:px-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
          <p className="text-xs text-muted-foreground">
            Unified social workspace — conversations first.
          </p>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          {(["list", "thread", "customer"] as const).map((pane) => (
            <Button
              key={pane}
              size="sm"
              variant={mobilePane === pane ? "default" : "outline"}
              onClick={() => setMobilePane(pane)}
            >
              {pane === "list" ? "List" : pane === "thread" ? "Chat" : "CRM"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        {/* LEFT */}
        <aside
          className={cn(
            "min-h-0 flex-col border-r border-border/80 bg-background/40 backdrop-blur",
            mobilePane === "list" ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="space-y-2 border-b border-border/80 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                className="pl-8"
                placeholder="Search conversations, customers, messages…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                    filter === f.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1">
              <select
                className="h-8 rounded-md border border-border bg-background px-1 text-[11px]"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
              >
                <option value="">Channel</option>
                {Object.keys(PLATFORM_ICONS).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border border-border bg-background px-1 text-[11px]"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="">Tag</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                className="h-8 rounded-md border border-border bg-background px-1 text-[11px]"
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
              >
                <option value="">Agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No conversations"
                  description={
                    q
                      ? "No results for this search. Try another keyword or clear filters."
                      : "Connect channels or wait for customers — your inbox is ready."
                  }
                  icon={<Inbox className="h-8 w-8" />}
                />
              </div>
            ) : (
              list.map((c) => {
                const name = displayName(c.contact);
                const preview =
                  c.messages[0]?.body || c.subject || "No messages yet";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setMobilePane("thread");
                    }}
                    className={cn(
                      "w-full border-b border-border/60 px-3 py-3 text-left transition-all",
                      selectedId === c.id
                        ? "bg-primary/10"
                        : "hover:bg-accent/40",
                    )}
                  >
                    <div className="flex gap-3">
                      <Avatar className="h-10 w-10">
                        {c.contact.avatarUrl ? (
                          <AvatarImage src={c.contact.avatarUrl} />
                        ) : null}
                        <AvatarFallback>{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "truncate text-sm",
                              c.isUnread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {name}
                          </span>
                          <PlatformIcon
                            platform={c.channel?.socialChannel?.platform}
                          />
                          {c.isStarred ? (
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          ) : null}
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.lastMessageAt), {
                              addSuffix: false,
                            })}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {preview}
                          </span>
                          {c.unreadCount > 0 ? (
                            <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                              {c.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <Badge variant="muted" className="text-[10px]">
                            {c.status}
                          </Badge>
                          {c.assignee ? (
                            <span className="text-[10px] text-muted-foreground">
                              {c.assignee.name || c.assignee.email}
                            </span>
                          ) : null}
                          {(c.tagLinks || []).slice(0, 2).map((t) => (
                            <span
                              key={t.tag.id}
                              className="rounded px-1 text-[10px]"
                              style={{
                                background: `${t.tag.color || "#14b8a6"}22`,
                                color: t.tag.color || "#14b8a6",
                              }}
                            >
                              {t.tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* CENTER */}
        <section
          className={cn(
            "min-h-0 flex-col border-r border-border/80",
            mobilePane === "thread" ? "flex" : "hidden lg:flex",
          )}
        >
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                title="No customer selected"
                description="Pick a conversation from the left to open the timeline."
                icon={<MessageCircle className="h-8 w-8" />}
              />
            </div>
          ) : detailLoading && !selected.messages?.length ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-2/3" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {displayName(selected.contact)}
                    </span>
                    <PlatformIcon
                      platform={selected.channel?.socialChannel?.platform}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selected.channel?.socialChannel?.name ?? "Manual"} ·{" "}
                    {selected.status}
                    {selected.assignee
                      ? ` · ${selected.assignee.name || selected.assignee.email}`
                      : ""}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void patchConversation(
                        { isUnread: true },
                        { isUnread: true, unreadCount: 1 },
                      )
                    }
                  >
                    Unread
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void patchConversation(
                        { isStarred: !selected.isStarred },
                        { isStarred: !selected.isStarred },
                      )
                    }
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        selected.isStarred && "fill-amber-400 text-amber-400",
                      )}
                    />
                  </Button>
                  <select
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    value={selected.assignee?.id || ""}
                    onChange={(e) =>
                      void patchConversation({
                        assigneeId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.email}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    value={selected.status}
                    onChange={(e) =>
                      void patchConversation({ status: e.target.value })
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void patchConversation({ status: "ARCHIVED" })
                    }
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void patchConversation({
                        status:
                          selected.status === "CLOSED" ? "OPEN" : "CLOSED",
                      })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {timeline.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Conversation started — send the first reply.
                  </p>
                ) : (
                  timeline.map((item, idx) => {
                    const prev = timeline[idx - 1];
                    const showDate =
                      !prev ||
                      !isSameDay(new Date(prev.at), new Date(item.at));
                    return (
                      <div key={`${item.kind}-${item.data.id}`}>
                        {showDate ? (
                          <div className="my-3 flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {format(new Date(item.at), "MMM d, yyyy")}
                            </span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                        ) : null}
                        {item.kind === "event" ? (
                          <div className="flex justify-center">
                            <span className="rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
                              {item.data.title}
                              <span className="ml-2 opacity-70">
                                {format(new Date(item.data.createdAt), "HH:mm")}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <MessageBubble message={item.data} />
                        )}
                      </div>
                    );
                  })
                )}
                {typing ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex gap-1 rounded-full bg-muted px-3 py-2">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    </span>
                    Typing…
                  </div>
                ) : null}
              </div>

              <div className="relative border-t border-border/80 p-3">
                {showEmoji ? (
                  <div className="absolute bottom-full left-3 mb-2 flex gap-1 rounded-xl border border-border bg-background p-2 shadow-lg">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="rounded-md px-2 py-1 text-lg hover:bg-accent"
                        onClick={() => {
                          setReply((r) => r + e);
                          setShowEmoji(false);
                          composerRef.current?.focus();
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                ) : null}
                {showReplies ? (
                  <div className="absolute bottom-full left-3 right-3 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-background p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Input
                        placeholder="Search saved replies…"
                        value={replySearch}
                        onChange={(e) => setReplySearch(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowReplies(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {filteredReplies.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-start gap-2 rounded-lg border border-border/60 p-2"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => {
                              setReply(r.body);
                              setShowReplies(false);
                              composerRef.current?.focus();
                            }}
                          >
                            <div className="text-sm font-medium">{r.title}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {r.shortcut ? `${r.shortcut} · ` : ""}
                              {r.category || "General"}
                            </div>
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void deleteReply(r.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-medium">Create saved reply</p>
                      <Input
                        placeholder="Title"
                        value={replyForm.title}
                        onChange={(e) =>
                          setReplyForm((f) => ({ ...f, title: e.target.value }))
                        }
                      />
                      <Textarea
                        rows={2}
                        placeholder="Body"
                        value={replyForm.body}
                        onChange={(e) =>
                          setReplyForm((f) => ({ ...f, body: e.target.value }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Category"
                          value={replyForm.category}
                          onChange={(e) =>
                            setReplyForm((f) => ({
                              ...f,
                              category: e.target.value,
                            }))
                          }
                        />
                        <Input
                          placeholder="/shortcut"
                          value={replyForm.shortcut}
                          onChange={(e) =>
                            setReplyForm((f) => ({
                              ...f,
                              shortcut: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button size="sm" onClick={() => void saveReplyTemplate()}>
                        <Plus className="h-4 w-4" />
                        Save reply
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mb-2 flex flex-wrap items-center gap-1">
                  <Button
                    size="sm"
                    variant={isInternal ? "default" : "outline"}
                    onClick={() => setIsInternal((v) => !v)}
                  >
                    <StickyNote className="h-4 w-4" />
                    Internal note
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowEmoji((v) => !v)}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowReplies((v) => !v)}
                  >
                    <FileText className="h-4 w-4" />
                    Saved
                  </Button>
                  <Button size="sm" variant="outline" disabled title="Coming soon">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled title="Schedule send disabled">
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled title="Voice record disabled">
                    <Mic className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    ref={composerRef}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={
                      isInternal
                        ? "Write an internal note (not sent to customer)…"
                        : "Write a reply… Enter to send, Shift+Enter for new line"
                    }
                    rows={3}
                    className={cn(
                      isInternal && "border-amber-500/40 bg-amber-500/5",
                    )}
                    onKeyDown={onComposerKey}
                  />
                  <Button
                    disabled={sending || !reply.trim()}
                    onClick={() => void sendReply()}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* RIGHT */}
        <aside
          className={cn(
            "min-h-0 flex-col overflow-y-auto bg-background/30",
            mobilePane === "customer" ? "flex" : "hidden lg:flex",
          )}
        >
          {!selected ? (
            <div className="p-6">
              <EmptyState
                title="Customer workspace"
                description="Open a conversation to see profile, tags, notes, and history."
                icon={<UserPlus className="h-8 w-8" />}
              />
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex gap-1 rounded-lg border border-border p-1">
                {(
                  [
                    ["profile", "Profile"],
                    ["timeline", "Timeline"],
                    ["notes", "Notes"],
                    ["activity", "Activity"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRightTab(id)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium",
                      rightTab === id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {rightTab === "profile" ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14">
                      {selected.contact.avatarUrl ? (
                        <AvatarImage src={selected.contact.avatarUrl} />
                      ) : null}
                      <AvatarFallback>
                        {initials(displayName(selected.contact))}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">
                        {displayName(selected.contact)}
                      </div>
                      {selected.contact.instagramUsername ? (
                        <div className="text-xs text-muted-foreground">
                          @{selected.contact.instagramUsername}
                        </div>
                      ) : null}
                      <Badge variant="muted" className="mt-1 text-[10px]">
                        {selected.contact.leadStatus || "Lead"}
                      </Badge>
                    </div>
                  </div>

                  <ProfileField
                    label="Email"
                    value={selected.contact.email}
                    onSave={(email) =>
                      void patchConversation({ contact: { email } })
                    }
                  />
                  <ProfileField
                    label="Phone"
                    value={selected.contact.phone}
                    onSave={(phone) =>
                      void patchConversation({ contact: { phone } })
                    }
                  />
                  <ProfileField
                    label="Country"
                    value={selected.contact.country}
                    onSave={(country) =>
                      void patchConversation({ contact: { country } })
                    }
                  />
                  <ProfileField
                    label="Language"
                    value={selected.contact.language}
                    onSave={(language) =>
                      void patchConversation({ contact: { language } })
                    }
                  />
                  <ProfileField
                    label="Lifetime value"
                    value={selected.contact.lifetimeValue}
                    onSave={(lifetimeValue) =>
                      void patchConversation({ contact: { lifetimeValue } })
                    }
                  />
                  <div className="text-xs text-muted-foreground">
                    Joined{" "}
                    {selected.contact.joinedAt
                      ? format(new Date(selected.contact.joinedAt), "MMM d, yyyy")
                      : "—"}
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Channels
                    </h3>
                    <div className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm">
                      <PlatformIcon
                        platform={selected.channel?.socialChannel?.platform}
                      />
                      <span>
                        {selected.channel?.socialChannel?.name || "Unlinked"}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {selected.channel?.accountHandle || ""}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Tag className="h-3 w-3" /> Tags
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => {
                        const active = conversationTags.some(
                          (t) => t.id === tag.id,
                        );
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => void toggleTag(tag)}
                            className={cn(
                              "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                              active
                                ? "border-transparent text-white"
                                : "border-border text-muted-foreground hover:bg-accent",
                            )}
                            style={
                              active
                                ? { background: tag.color || "#14b8a6" }
                                : undefined
                            }
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="New tag"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void createTag();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void createTag()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Orders (mock)
                    </h3>
                    <div className="space-y-1">
                      {MOCK_ORDERS.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                        >
                          <span>{o.id}</span>
                          <span>{o.total}</span>
                          <span className="text-muted-foreground">{o.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Previous conversations
                    </h3>
                    {previous.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {previous.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-left text-xs hover:bg-accent/40"
                            onClick={() => {
                              setSelectedId(p.id);
                              setMobilePane("thread");
                            }}
                          >
                            <span className="truncate">
                              {p.subject || p.channel?.socialChannel?.name}
                            </span>
                            <span className="text-muted-foreground">{p.status}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {rightTab === "timeline" ? (
                <div className="space-y-2">
                  {timeline
                    .slice()
                    .reverse()
                    .map((item) => (
                      <div
                        key={`rt-${item.kind}-${item.data.id}`}
                        className="rounded-lg border border-border/60 px-3 py-2 text-xs"
                      >
                        <div className="font-medium">
                          {item.kind === "event"
                            ? item.data.title
                            : item.data.isInternal
                              ? "Internal note"
                              : item.data.direction === "INBOUND"
                                ? "Customer message"
                                : "Agent reply"}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-muted-foreground">
                          {item.kind === "message" ? item.data.body : null}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(item.at), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}

              {rightTab === "notes" ? (
                <div className="space-y-3">
                  <Textarea
                    rows={4}
                    placeholder="Internal note…"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <Button size="sm" onClick={() => void addInternalNote()}>
                    Save note
                  </Button>
                  <div className="space-y-2">
                    {(selected.internalNotes || []).map((n) => (
                      <div
                        key={n.id}
                        className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs"
                      >
                        <p className="whitespace-pre-wrap">{n.body}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {n.user.name || n.user.email} ·{" "}
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {rightTab === "activity" ? (
                <div className="space-y-2">
                  {(selected.events || [])
                    .slice()
                    .reverse()
                    .map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-lg border border-border/60 px-3 py-2 text-xs"
                      >
                        <div className="font-medium">{ev.title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {ev.type} ·{" "}
                          {formatDistanceToNow(new Date(ev.createdAt), {
                            addSuffix: true,
                          })}
                          {ev.user
                            ? ` · ${ev.user.name || ev.user.email}`
                            : ""}
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.isInternal || message.direction === "SYSTEM") {
    return (
      <div className="mx-auto max-w-[85%] rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-amber-600">
          <StickyNote className="h-3 w-3" /> Internal
        </div>
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {format(new Date(message.createdAt), "HH:mm")}
        </p>
      </div>
    );
  }

  const outbound = message.direction === "OUTBOUND";
  return (
    <div
      className={cn(
        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm transition-all",
        outbound
          ? "ml-auto bg-primary text-primary-foreground"
          : "bg-muted/80 text-foreground",
      )}
    >
      {message.kind === "IMAGE" && message.attachments[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={message.attachments[0].url}
          alt={message.attachments[0].filename || "attachment"}
          className="mb-2 max-h-48 rounded-lg object-cover"
        />
      ) : null}
      {message.kind === "FILE" && message.attachments[0] ? (
        <a
          href={message.attachments[0].url}
          className="mb-2 flex items-center gap-2 underline"
          target="_blank"
          rel="noreferrer"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {message.attachments[0].filename || "File"}
        </a>
      ) : null}
      <p className="whitespace-pre-wrap">{message.body}</p>
      <div
        className={cn(
          "mt-1 flex items-center gap-1 text-[10px]",
          outbound ? "justify-end text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        <span>{format(new Date(message.createdAt), "HH:mm")}</span>
        {outbound ? (
          message.deliveryStatus === "READ" ? (
            <CheckCheck className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )
        ) : null}
      </div>
    </div>
  );
}

function ProfileField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null | undefined;
  onSave: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => {
    setDraft(value || "");
  }, [value]);
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== (value || "")) onSave(draft || null);
        }}
      />
    </label>
  );
}
