"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page";

export function WorkspaceSettingsForm({
  workspaceSlug,
  initialName,
}: {
  workspaceSlug: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, name }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Could not save workspace.");
      return;
    }
    toast.success("Workspace saved.");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Workspace settings"
        description="Name and basics for this workspace."
      />
      <form onSubmit={onSave} className="max-w-lg space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Workspace name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        </div>
        <p className="text-xs text-muted-foreground">Slug: {workspaceSlug}</p>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save workspace"}
        </Button>
      </form>
    </div>
  );
}
