"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  Cable,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";

type DiagnosticsPayload = {
  diagnostics: {
    oauth: {
      configured: boolean;
      appIdPresent: boolean;
      appSecretPresent: boolean;
      redirectUri: string;
      apiVersion: string;
      apiEnabled: boolean;
      sandbox: boolean;
    };
    encryption: { configured: boolean; keySource: string };
    webhook: { endpoint: string; verifyReady: boolean; subscribed: boolean };
  };
  accounts: {
    id: string;
    product: string;
    health: string;
    businessName: string | null;
    username: string | null;
    connectedAt: string | null;
    lastSyncAt: string | null;
  }[];
  syncQueue: {
    id: string;
    status: string;
    jobType: string;
    progress: number;
    createdAt: string;
    error: string | null;
  }[];
  webhooks: {
    id: string;
    platform: string;
    objectType: string;
    status: string;
    callbackPath: string;
  }[];
  audits: {
    id: string;
    kind: string;
    message: string;
    createdAt: string;
  }[];
};

export function IntegrationSettings({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug?: string | null;
}) {
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!brandSlug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      view: "diagnostics",
    });
    const res = await fetch(`/api/integrations/meta?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load diagnostics.");
      return;
    }
    setData((await res.json()) as DiagnosticsPayload);
  }, [workspaceSlug, brandSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!brandSlug) {
    return (
      <div>
        <PageHeader
          title="Integrations"
          description="Select a brand to inspect Meta OAuth, webhooks, and sync diagnostics."
        />
      </div>
    );
  }

  const d = data?.diagnostics;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration settings"
        description="OAuth configuration, webhook readiness, encryption, and developer diagnostics."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/w/${workspaceSlug}/b/${brandSlug}/channels`}>
              <ArrowLeft className="h-4 w-4" />
              Channels
            </Link>
          </Button>
        }
      />

      {loading || !d ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={<Cable className="h-4 w-4" />}
              title="OAuth"
              value={d.oauth.configured ? "Ready" : "Sandbox"}
              detail={`API ${d.oauth.apiEnabled ? "on" : "off"} · ${d.oauth.apiVersion}`}
            />
            <Stat
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Encryption"
              value={d.encryption.configured ? "Configured" : "Fallback"}
              detail={d.encryption.keySource}
            />
            <Stat
              icon={<Webhook className="h-4 w-4" />}
              title="Webhook"
              value={d.webhook.subscribed ? "Subscribed" : "Draft only"}
              detail={d.webhook.endpoint}
            />
            <Stat
              icon={<Activity className="h-4 w-4" />}
              title="Connections"
              value={String(data?.accounts.length || 0)}
              detail="Active Meta accounts"
            />
          </div>

          <section className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h2 className="text-sm font-semibold">Environment</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <EnvRow label="META_APP_ID" ok={d.oauth.appIdPresent} />
              <EnvRow label="META_APP_SECRET" ok={d.oauth.appSecretPresent} />
              <EnvRow label="META_API_ENABLED" ok={d.oauth.apiEnabled} />
              <EnvRow label="META_OAUTH_SANDBOX" ok={d.oauth.sandbox} />
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Redirect URI</dt>
                <dd className="mt-0.5 break-all font-mono text-xs">
                  {d.oauth.redirectUri}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Production Meta calls stay off until{" "}
              <code className="rounded bg-muted px-1">META_API_ENABLED=true</code>{" "}
              with real app credentials. Sandbox connect stores encrypted tokens
              locally without contacting Meta.
            </p>
          </section>

          <section className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h2 className="mb-3 text-sm font-semibold">Connection health</h2>
            {(data?.accounts.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No connected accounts.</p>
            ) : (
              <div className="space-y-2">
                {data!.accounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {a.businessName || a.product}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.username} · {a.product}
                      </div>
                    </div>
                    <Badge variant="muted">{a.health}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h2 className="mb-3 text-sm font-semibold">Sync queue</h2>
            {(data?.syncQueue.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Queue empty.</p>
            ) : (
              <div className="space-y-2">
                {data!.syncQueue.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                  >
                    <span>
                      {j.jobType} · {j.status} · {j.progress}%
                    </span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(j.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h2 className="mb-3 text-sm font-semibold">Webhook readiness</h2>
            <div className="space-y-2">
              {data!.webhooks.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                >
                  <span>
                    {w.platform} / {w.objectType}
                  </span>
                  <Badge variant="muted">{w.status}</Badge>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border/70 bg-card/40 p-4">
            <h2 className="mb-3 text-sm font-semibold">Security & integration audit</h2>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {(data?.audits || []).map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-border/50 px-2.5 py-1.5 text-xs"
                >
                  <div className="font-medium">{a.message}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {a.kind} ·{" "}
                    {formatDistanceToNow(new Date(a.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  icon,
  title,
  value,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function EnvRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
      <code className="text-xs">{label}</code>
      <Badge variant={ok ? "default" : "muted"}>{ok ? "set" : "off"}</Badge>
    </div>
  );
}
