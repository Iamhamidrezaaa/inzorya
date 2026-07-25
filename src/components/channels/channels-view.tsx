"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Briefcase,
  CheckCircle2,
  Circle,
  Globe2,
  MessageCircle,
  Music2,
  Radio,
  Send,
  Share2,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ChannelCard = {
  socialChannelId: string;
  platform: string;
  name: string;
  description: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "PENDING" | "ERROR";
  accountName: string | null;
  accountHandle: string | null;
  lastSyncAt: string | null;
  connectionId: string | null;
  permissions: { scope: string; label: string; granted: boolean }[];
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  INSTAGRAM: Share2,
  FACEBOOK: Globe2,
  WHATSAPP: MessageCircle,
  TELEGRAM: Send,
  LINKEDIN: Briefcase,
  X: Radio,
  YOUTUBE: Video,
  TIKTOK: Music2,
};

export function ChannelsView({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ workspaceSlug, brandSlug });
    const res = await fetch(`/api/channels?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load channels.");
      return;
    }
    const data = (await res.json()) as { channels: ChannelCard[] };
    setChannels(data.channels);
  }, [workspaceSlug, brandSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(channel: ChannelCard) {
    setBusy(channel.platform);
    const next =
      channel.status === "CONNECTED" ? "DISCONNECTED" : "CONNECTED";
    const res = await fetch("/api/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        brandSlug,
        platform: channel.platform,
        status: next,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error("Could not update channel.");
      return;
    }
    toast.success(
      next === "CONNECTED"
        ? `${channel.name} connected (mock)`
        : `${channel.name} disconnected`,
    );
    await load();
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Channels"
        description="Connect the social accounts your business owns. OAuth plugs in later — this UI stays the same."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {channels.map((channel) => {
            const Icon = ICONS[channel.platform] ?? Radio;
            const connected = channel.status === "CONNECTED";
            return (
              <div
                key={channel.platform}
                className="interactive-card flex flex-col rounded-xl border border-border/80 bg-card p-5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl border border-border",
                        connected ? "bg-primary/15 text-primary" : "bg-muted",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold tracking-tight">
                        {channel.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {channel.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant={connected ? "default" : "muted"}>
                    {connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Account</span>
                    <span className="truncate font-medium">
                      {channel.accountName || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Handle</span>
                    <span className="truncate">
                      {channel.accountHandle || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Last sync</span>
                    <span>
                      {channel.lastSyncAt
                        ? formatDistanceToNow(new Date(channel.lastSyncAt), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Permissions
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {channel.permissions.map((p) => (
                      <li
                        key={p.scope}
                        className="flex items-center gap-2 text-xs"
                      >
                        {p.granted ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span
                          className={
                            p.granted
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {p.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto flex gap-2 pt-5">
                  {connected ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={busy === channel.platform}
                      onClick={() => void toggle(channel)}
                    >
                      {busy === channel.platform ? "Saving…" : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      disabled={busy === channel.platform}
                      onClick={() => void toggle(channel)}
                    >
                      {busy === channel.platform ? "Connecting…" : "Connect"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
