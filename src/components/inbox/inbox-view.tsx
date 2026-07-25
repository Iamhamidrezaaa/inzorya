"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Archive,
  CheckCircle2,
  Inbox,
  Plus,
  Search,
  Send,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Contact = {
  id: string;
  name: string | null;
  instagramUsername: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  notes: string | null;
};

type Conversation = {
  id: string;
  subject: string | null;
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  isUnread: boolean;
  lastMessageAt: string;
  contact: Contact;
  channel: {
    socialChannel: { platform: string; name: string };
    status: string;
  } | null;
  assignee: { id: string; name: string | null; email: string } | null;
  messages: {
    id: string;
    body: string;
    direction: "INBOUND" | "OUTBOUND";
    createdAt: string;
  }[];
};

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "unread", label: "Unread" },
  { id: "assigned", label: "Assigned" },
  { id: "closed", label: "Closed" },
  { id: "archived", label: "Archived" },
] as const;

function displayName(contact: Contact) {
  return (
    contact.name ||
    (contact.instagramUsername ? `@${contact.instagramUsername}` : null) ||
    contact.email ||
    "Unknown contact"
  );
}

export function InboxView({
  workspaceSlug,
  brandSlug,
  currentUserId,
}: {
  workspaceSlug: string;
  brandSlug: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("open");
  const [q, setQ] = useState("");
  const [list, setList] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [contacts, setContacts] = useState<{ id: string; label: string }[]>([]);

  const loadList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      filter,
      ...(q ? { q } : {}),
    });
    const res = await fetch(`/api/conversations?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load inbox.");
      return;
    }
    const data = (await res.json()) as { conversations: Conversation[] };
    setList(data.conversations);
    if (
      selectedId &&
      !data.conversations.some((c) => c.id === selectedId)
    ) {
      setSelectedId(null);
      setSelected(null);
    }
  }, [workspaceSlug, brandSlug, filter, q, selectedId]);

  const loadOne = useCallback(
    async (id: string) => {
      const params = new URLSearchParams({
        workspaceSlug,
        brandSlug,
        id,
      });
      const res = await fetch(`/api/conversations?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { conversation: Conversation };
      setSelected(data.conversation);
      setNotes(data.conversation.contact.notes ?? "");
      if (data.conversation.isUnread) {
        await fetch("/api/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceSlug,
            brandSlug,
            id,
            isUnread: false,
          }),
        });
        setList((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isUnread: false } : c)),
        );
        router.refresh();
      }
    },
    [workspaceSlug, brandSlug, router],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadOne(selectedId);
  }, [selectedId, loadOne]);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams({ workspaceSlug, brandSlug });
      const res = await fetch(`/api/contacts?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        contacts: Contact[];
      };
      setContacts(
        data.contacts.map((c) => ({
          id: c.id,
          label: displayName(c),
        })),
      );
    })();
  }, [workspaceSlug, brandSlug]);

  const preview = useMemo(() => {
    return (c: Conversation) => c.messages[0]?.body || c.subject || "No messages yet";
  }, []);

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "message",
        workspaceSlug,
        brandSlug,
        conversationId: selected.id,
        body: reply.trim(),
      }),
    });
    setSending(false);
    if (!res.ok) {
      toast.error("Could not send reply.");
      return;
    }
    const data = (await res.json()) as { conversation: Conversation };
    setSelected(data.conversation);
    setReply("");
    toast.success("Reply sent.");
    await loadList();
    router.refresh();
  }

  async function patchConversation(patch: Record<string, unknown>) {
    if (!selected) return;
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
      return;
    }
    const data = (await res.json()) as { conversation: Conversation };
    setSelected(data.conversation);
    setNotes(data.conversation.contact.notes ?? "");
    await loadList();
    router.refresh();
  }

  async function startConversation() {
    if (contacts.length === 0) {
      toast.error("Add a contact first.");
      return;
    }
    const contactId = contacts[0].id;
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        contactId,
        subject: "New conversation",
      }),
    });
    if (!res.ok) {
      toast.error("Could not start conversation.");
      return;
    }
    const data = (await res.json()) as { conversation: Conversation };
    toast.success("Conversation created.");
    setFilter("open");
    setSelectedId(data.conversation.id);
    await loadList();
    router.refresh();
  }

  function addTag() {
    if (!selected || !tagInput.trim()) return;
    const tags = Array.from(
      new Set([...(selected.contact.tags || []), tagInput.trim()]),
    );
    setTagInput("");
    void patchConversation({ tags });
  }

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100svh-3.5rem)] flex-col md:-mx-8">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
          <p className="text-xs text-muted-foreground">
            Customer conversations — the center of Inzorya.
          </p>
        </div>
        <Button size="sm" onClick={() => void startConversation()}>
          <Plus className="h-4 w-4" />
          New thread
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_1fr_300px]">
        {/* List */}
        <aside className="flex min-h-0 flex-col border-r border-border">
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadList();
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium",
                    filter === f.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : list.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No conversations in this filter.
              </div>
            ) : (
              list.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full border-b border-border px-3 py-3 text-left transition-colors",
                    selectedId === c.id ? "bg-accent/60" : "hover:bg-accent/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {displayName(c.contact)}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.lastMessageAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {c.isUnread ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ) : null}
                    <span className="truncate text-xs text-muted-foreground">
                      {preview(c)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Chat */}
        <section className="flex min-h-0 flex-col border-r border-border">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                title="Select a conversation"
                description="Your inbox is empty until customers message you — or start a thread from a contact."
                actionLabel="New thread"
                onAction={() => void startConversation()}
                icon={<Inbox className="h-8 w-8" />}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="font-medium">
                    {displayName(selected.contact)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selected.channel?.socialChannel?.name ?? "Manual"} ·{" "}
                    {selected.status}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void patchConversation({
                        assigneeId: selected.assignee?.id
                          ? null
                          : currentUserId,
                      })
                    }
                  >
                    <UserPlus className="h-4 w-4" />
                    {selected.assignee ? "Unassign" : "Assign me"}
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
                    {selected.status === "CLOSED" ? "Reopen" : "Close"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void patchConversation({ status: "ARCHIVED" })
                    }
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {selected.messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No messages yet. Send the first reply below.
                  </p>
                ) : (
                  selected.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                        m.direction === "OUTBOUND"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          m.direction === "OUTBOUND"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatDistanceToNow(new Date(m.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply…"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <Button
                    disabled={sending || !reply.trim()}
                    onClick={() => void sendReply()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  ⌘/Ctrl + Enter to send
                </p>
              </div>
            </>
          )}
        </section>

        {/* Profile */}
        <aside className="hidden min-h-0 flex-col overflow-y-auto lg:flex">
          {!selected ? (
            <div className="p-4 text-sm text-muted-foreground">
              Customer details appear when you open a thread.
            </div>
          ) : (
            <div className="space-y-5 p-4">
              <div>
                <h2 className="text-sm font-semibold">Customer</h2>
                <p className="mt-1 text-sm">{displayName(selected.contact)}</p>
                {selected.contact.instagramUsername ? (
                  <p className="text-xs text-muted-foreground">
                    @{selected.contact.instagramUsername}
                  </p>
                ) : null}
                {selected.contact.email ? (
                  <p className="text-xs text-muted-foreground">
                    {selected.contact.email}
                  </p>
                ) : null}
                {selected.contact.phone ? (
                  <p className="text-xs text-muted-foreground">
                    {selected.contact.phone}
                  </p>
                ) : null}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tags
                </h3>
                <div className="mt-2 flex flex-wrap gap-1">
                  {selected.contact.tags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No tags</span>
                  ) : (
                    selected.contact.tags.map((tag) => (
                      <Badge key={tag} variant="muted">
                        {tag}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes
                </h3>
                <Textarea
                  className="mt-2"
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => void patchConversation({ notes })}
                  placeholder="Internal notes about this customer…"
                />
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  History
                </h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  {selected.messages.length} message
                  {selected.messages.length === 1 ? "" : "s"} in this thread.
                  Status: {selected.status}
                  {selected.assignee
                    ? ` · Assigned to ${selected.assignee.name || selected.assignee.email}`
                    : " · Unassigned"}
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
