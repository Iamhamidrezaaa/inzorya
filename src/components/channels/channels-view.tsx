"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Globe2,
  MessageCircle,
  RefreshCw,
  Settings2,
  Share2,
  Shield,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Permission = {
  scope: string;
  label: string;
  description: string | null;
  granted: boolean;
  required: boolean;
};

type ChannelCard = {
  product: "instagram" | "facebook_pages" | "messenger";
  platform: string;
  name: string;
  description: string;
  connected: boolean;
  accountId: string | null;
  businessName: string | null;
  username: string | null;
  profilePictureUrl: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  health: string;
  tokenExpiresAt: string | null;
  permissions: Permission[];
};

type Diagnostics = {
  oauth: {
    configured: boolean;
    apiEnabled: boolean;
    sandbox: boolean;
    redirectUri: string;
  };
  encryption: { configured: boolean; keySource: string };
  webhook: { endpoint: string; subscribed: boolean };
};

const ICONS = {
  instagram: Share2,
  facebook_pages: Globe2,
  messenger: MessageCircle,
};

const HEALTH_LABEL: Record<string, { label: string; className: string }> = {
  HEALTHY: { label: "Healthy", className: "bg-emerald-500/15 text-emerald-400" },
  PERMISSION_EXPIRED: {
    label: "Permission expired",
    className: "bg-amber-500/15 text-amber-400",
  },
  RECONNECT_REQUIRED: {
    label: "Reconnect required",
    className: "bg-rose-500/15 text-rose-400",
  },
  SYNC_FAILED: {
    label: "Sync failed",
    className: "bg-rose-500/15 text-rose-300",
  },
  PENDING: { label: "Pending", className: "bg-slate-500/15 text-slate-300" },
};

export function ChannelsView({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const page = usePageCopy("channels");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [channels, setChannels] = useState<ChannelCard[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ workspaceSlug, brandSlug });
    const res = await fetch(`/api/integrations/meta?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load Meta channels.");
      return;
    }
    const data = (await res.json()) as {
      channels: ChannelCard[];
      diagnostics: Diagnostics;
    };
    setChannels(data.channels);
    setDiagnostics(data.diagnostics);
  }, [workspaceSlug, brandSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("meta") === "connected") {
      toast.success("Meta account connected.");
      router.replace(`/w/${workspaceSlug}/b/${brandSlug}/channels`);
    }
  }, [searchParams, router, workspaceSlug, brandSlug]);

  async function connect(channel: ChannelCard) {
    setBusy(channel.product);
    const res = await fetch("/api/integrations/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "oauth_start",
        workspaceSlug,
        brandSlug,
        product: channel.product,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error("Could not start OAuth.");
      return;
    }
    const data = (await res.json()) as {
      mode: "redirect" | "sandbox_required";
      authorizeUrl?: string;
      reason?: string;
    };

    if (data.mode === "redirect" && data.authorizeUrl) {
      window.location.href = data.authorizeUrl;
      return;
    }

    if (diagnostics?.oauth.sandbox) {
      const sandbox = await fetch("/api/integrations/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "sandbox_connect",
          workspaceSlug,
          brandSlug,
          product: channel.product,
        }),
      });
      if (!sandbox.ok) {
        toast.error("Sandbox connect failed.");
        return;
      }
      toast.success(
        `${channel.name} connected in sandbox (encrypted tokens, no Meta API).`,
      );
      await load();
      router.refresh();
      return;
    }

    toast.error(
      data.reason ||
        "Configure META_APP_ID / META_APP_SECRET to connect production accounts.",
    );
  }

  async function disconnect(channel: ChannelCard) {
    if (!channel.accountId) return;
    setBusy(channel.product);
    const res = await fetch("/api/integrations/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "disconnect",
        workspaceSlug,
        brandSlug,
        accountId: channel.accountId,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error("Disconnect failed.");
      return;
    }
    toast.success("Disconnected. Tokens revoked locally.");
    await load();
    router.refresh();
  }

  async function sync(channel: ChannelCard) {
    if (!channel.accountId) return;
    setBusy(`sync-${channel.product}`);
    const res = await fetch("/api/integrations/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "sync",
        workspaceSlug,
        brandSlug,
        accountId: channel.accountId,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error("Sync failed.");
      return;
    }
    toast.success("Sync framework ran (no Meta API calls).");
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={page.title}
        description={page.description}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/w/${workspaceSlug}/settings/integrations`}>
              <Settings2 className="h-4 w-4" />
              Integration settings
            </Link>
          </Button>
        }
      />

      {diagnostics ? (
        <div className="grid gap-2 rounded-xl border border-border/70 bg-card/40 p-3 text-xs sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">OAuth</span>
            <div className="mt-0.5 font-medium">
              {diagnostics.oauth.configured
                ? "Credentials configured"
                : "Sandbox mode (no Meta credentials)"}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">API calls</span>
            <div className="mt-0.5 font-medium">
              {diagnostics.oauth.apiEnabled ? "Enabled" : "Disabled (foundation)"}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Token vault</span>
            <div className="mt-0.5 font-medium">
              {diagnostics.encryption.configured
                ? `Encrypted via ${diagnostics.encryption.keySource}`
                : "Using fallback key — set TOKEN_ENCRYPTION_KEY"}
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {channels.map((channel) => {
            const Icon = ICONS[channel.product];
            const health = HEALTH_LABEL[channel.health] || HEALTH_LABEL.PENDING;
            const missing = channel.permissions.filter(
              (p) => p.required && !p.granted,
            );
            return (
              <div
                key={channel.product}
                className="flex flex-col rounded-xl border border-border/80 bg-card p-5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl border border-border",
                        channel.connected
                          ? "bg-primary/15 text-primary"
                          : "bg-muted",
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
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase",
                      health.className,
                    )}
                  >
                    {health.label}
                  </span>
                </div>

                {channel.connected ? (
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      {channel.profilePictureUrl ? (
                        <AvatarImage src={channel.profilePictureUrl} />
                      ) : null}
                      <AvatarFallback>
                        {(channel.businessName || channel.name)
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {channel.businessName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {channel.username}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
                    Not connected
                  </div>
                )}

                <div className="mt-4 space-y-2 text-sm">
                  <Row
                    label="Connected since"
                    value={
                      channel.connectedAt
                        ? formatDistanceToNow(new Date(channel.connectedAt), {
                            addSuffix: true,
                          })
                        : "—"
                    }
                  />
                  <Row
                    label="Last sync"
                    value={
                      channel.lastSyncAt
                        ? formatDistanceToNow(new Date(channel.lastSyncAt), {
                            addSuffix: true,
                          })
                        : "Never"
                    }
                  />
                  <Row
                    label="Next sync"
                    value={
                      channel.nextSyncAt
                        ? formatDistanceToNow(new Date(channel.nextSyncAt), {
                            addSuffix: true,
                          })
                        : "—"
                    }
                  />
                  <Row
                    label="Token expiry"
                    value={
                      channel.tokenExpiresAt
                        ? new Date(channel.tokenExpiresAt).toLocaleDateString()
                        : "—"
                    }
                  />
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Shield className="h-3 w-3" /> Permissions
                  </div>
                  <ul className="space-y-1.5">
                    {channel.permissions.map((p) => (
                      <li key={p.scope} className="flex items-start gap-2 text-xs">
                        {p.granted ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Circle className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span>
                          <span
                            className={
                              p.granted
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }
                          >
                            {p.label}
                            {p.required ? " *" : ""}
                          </span>
                          {p.description ? (
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                              {p.description}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {missing.length > 0 && channel.connected ? (
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      Missing {missing.length} required permission
                      {missing.length === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto flex flex-col gap-2 pt-5">
                  {channel.connected ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `sync-${channel.product}`}
                          onClick={() => void sync(channel)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === channel.product}
                          onClick={() => void connect(channel)}
                        >
                          Reconnect
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === channel.product}
                        onClick={() => void disconnect(channel)}
                      >
                        <Unplug className="h-3.5 w-3.5" />
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      disabled={busy === channel.product}
                      onClick={() => void connect(channel)}
                    >
                      {busy === channel.product ? "Starting…" : "Connect"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        WhatsApp Business and other platforms will reuse this OAuth, token vault,
        sync, and webhook foundation.{" "}
        <Link
          className="text-primary underline-offset-2 hover:underline"
          href={`/w/${workspaceSlug}/settings/integrations`}
        >
          Open diagnostics
        </Link>
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}
