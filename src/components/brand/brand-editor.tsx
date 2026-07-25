"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page";

export type BrandFormData = {
  name: string;
  description: string | null;
  website: string | null;
  industry: string | null;
  brandVoice: string | null;
  targetAudience: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
  slug: string;
};

export function BrandEditor({
  workspaceSlug,
  brand,
}: {
  workspaceSlug: string;
  brand: BrandFormData;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: brand.name,
    description: brand.description ?? "",
    website: brand.website ?? "",
    industry: brand.industry ?? "",
    brandVoice: brand.brandVoice ?? "",
    targetAudience: brand.targetAudience ?? "",
    primaryColor: brand.primaryColor ?? "#14b8a6",
    secondaryColor: brand.secondaryColor ?? "#0f172a",
    logoUrl: brand.logoUrl ?? "",
  });

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/brands/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug: brand.slug,
        ...form,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Could not save brand.");
      return;
    }
    toast.success("Brand saved.");
    router.refresh();
  }

  async function onLogo(file: File) {
    setUploading(true);
    const body = new FormData();
    body.set("workspaceSlug", workspaceSlug);
    body.set("brandSlug", brand.slug);
    body.set("file", file);
    const res = await fetch("/api/brands/logo", { method: "POST", body });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Logo upload failed.");
      return;
    }
    const data = (await res.json()) as { logoUrl: string };
    setForm((prev) => ({ ...prev, logoUrl: data.logoUrl }));
    toast.success("Logo updated.");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Brand"
        description="Identity, voice, audience, and colors for this brand."
      />
      <form onSubmit={onSave} className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logoUrl}
                alt="Logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-muted-foreground">Logo</span>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onLogo(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload logo"}
            </Button>
            <p className="text-xs text-muted-foreground">PNG or JPG, max 5MB.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Brand name</Label>
            <Input id="name" value={form.name} onChange={set("name")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={form.website}
              onChange={set("website")}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={form.industry}
              onChange={set("industry")}
              placeholder="SaaS, retail, health…"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={set("description")}
              rows={3}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="brandVoice">Brand voice</Label>
            <Textarea
              id="brandVoice"
              value={form.brandVoice}
              onChange={set("brandVoice")}
              rows={4}
              placeholder="Tone, vocabulary, what to avoid…"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="targetAudience">Target audience</Label>
            <Textarea
              id="targetAudience"
              value={form.targetAudience}
              onChange={set("targetAudience")}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary color</Label>
            <div className="flex gap-2">
              <Input
                id="primaryColor"
                type="color"
                className="h-9 w-14 p-1"
                value={form.primaryColor}
                onChange={set("primaryColor")}
              />
              <Input value={form.primaryColor} onChange={set("primaryColor")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryColor">Secondary color</Label>
            <div className="flex gap-2">
              <Input
                id="secondaryColor"
                type="color"
                className="h-9 w-14 p-1"
                value={form.secondaryColor}
                onChange={set("secondaryColor")}
              />
              <Input
                value={form.secondaryColor}
                onChange={set("secondaryColor")}
              />
            </div>
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save brand"}
        </Button>
      </form>
    </div>
  );
}
