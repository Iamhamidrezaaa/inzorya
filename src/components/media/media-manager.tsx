"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";

type Asset = {
  id: string;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaManager({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const page = usePageCopy("media");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Asset | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ workspaceSlug, brandSlug });
    const res = await fetch(`/api/media?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load media.");
      return;
    }
    const data = (await res.json()) as { assets: Asset[] };
    setAssets(data.assets);
  }, [workspaceSlug, brandSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setUploading(true);
    const body = new FormData();
    body.set("workspaceSlug", workspaceSlug);
    body.set("brandSlug", brandSlug);
    body.set("file", file);
    const res = await fetch("/api/media", { method: "POST", body });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Upload failed.");
      return;
    }
    toast.success("Uploaded.");
    await load();
    router.refresh();
  }

  async function remove(asset: Asset) {
    if (!confirm(`Delete “${asset.originalName}”?`)) return;
    const prev = assets;
    setAssets((list) => list.filter((a) => a.id !== asset.id));
    if (preview?.id === asset.id) setPreview(null);
    const res = await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        id: asset.id,
      }),
    });
    if (!res.ok) {
      setAssets(prev);
      toast.error("Delete failed.");
      return;
    }
    toast.success("Deleted.");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title={page.title}
        description={page.description}
        actions={
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
            <Button
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload image"}
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          title="Media library is empty"
          description="Upload images to reuse across content and campaigns."
          actionLabel="Upload image"
          onAction={() => inputRef.current?.click()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <button
                type="button"
                className="block w-full"
                onClick={() => setPreview(asset)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={asset.originalName}
                  className="aspect-square w-full object-cover"
                />
              </button>
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {asset.originalName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(asset.size)}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => void remove(asset)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-h-full max-w-4xl overflow-hidden rounded-xl bg-background p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt={preview.originalName}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="truncate text-sm">{preview.originalName}</div>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
