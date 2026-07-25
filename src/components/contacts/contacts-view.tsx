"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Contact = {
  id: string;
  name: string | null;
  instagramUsername: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  notes: string | null;
  _count: { conversations: number };
};

export function ContactsView({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({
    name: "",
    instagramUsername: "",
    phone: "",
    email: "",
    tags: "",
    notes: "",
  });
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      ...(q ? { q } : {}),
    });
    const res = await fetch(`/api/contacts?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load contacts.");
      return;
    }
    const data = (await res.json()) as { contacts: Contact[] };
    setContacts(data.contacts);
  }, [workspaceSlug, brandSlug, q]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      instagramUsername: "",
      phone: "",
      email: "",
      tags: "",
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setForm({
      name: contact.name ?? "",
      instagramUsername: contact.instagramUsername ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      tags: contact.tags.join(", "),
      notes: contact.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    setPending(true);
    const payload = {
      workspaceSlug,
      brandSlug,
      id: editing?.id,
      name: form.name || null,
      instagramUsername: form.instagramUsername || null,
      phone: form.phone || null,
      email: form.email || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes || null,
    };
    const res = await fetch("/api/contacts", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Could not save contact.");
      return;
    }
    toast.success(editing ? "Contact updated." : "Contact created.");
    setOpen(false);
    await load();
    router.refresh();
  }

  async function remove(contact: Contact) {
    if (!confirm(`Delete ${contact.name || contact.instagramUsername || "contact"}?`)) {
      return;
    }
    const res = await fetch("/api/contacts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        id: contact.id,
      }),
    });
    if (!res.ok) {
      toast.error("Delete failed.");
      return;
    }
    toast.success("Deleted.");
    await load();
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="People you talk to. Conversation count stays attached to each contact."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add contact
          </Button>
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search contacts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add a customer with Instagram username, email, or phone to begin."
          actionLabel="Add contact"
          onAction={openCreate}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Instagram</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Tags</th>
                <th className="px-4 py-3 font-medium">Conversations</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{c.name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.instagramUsername ? `@${c.instagramUsername}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.phone || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((tag) => (
                        <Badge key={tag} variant="muted">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">{c._count.conversations}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void remove(c)}
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
            <SheetTitle>{editing ? "Edit contact" : "New contact"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram username</Label>
              <Input
                value={form.instagramUsername}
                onChange={(e) =>
                  setForm((f) => ({ ...f, instagramUsername: e.target.value }))
                }
                placeholder="without @"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
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
