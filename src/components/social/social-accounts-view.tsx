"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link2, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

type ProviderCard = {
  platform: string;
  displayName: string;
  configured: boolean;
  capabilities: Record<string, boolean>;
};

type AccountCard = {
  id: string;
  platform: string;
  accountName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  status: string;
  capabilities: Record<string, boolean>;
  lastSyncedAt: string | null;
  tokenExpiresAt: string | null;
  lastError: string | null;
};

type Unavailable = { platform: string; reason: string };

function statusLabel(status: string) {
  switch (status) {
    case "CONNECTED":
      return "متصل";
    case "REAUTH_REQUIRED":
    case "EXPIRED":
      return "نیاز به اتصال مجدد";
    case "ERROR":
      return "خطا";
    case "CONNECTING":
      return "در حال اتصال";
    case "DISCONNECTED":
      return "قطع‌شده";
    default:
      return status;
  }
}

function capabilitySummary(caps: Record<string, boolean>) {
  const items: string[] = [];
  if (caps.accountInfo || caps.profile) items.push("پروفایل");
  if (caps.publishing) items.push("انتشار");
  else items.push("انتشار: در دسترس نیست");
  if (caps.analytics) items.push("آنالیتیکس");
  else items.push("آنالیتیکس: در دسترس نیست");
  return items.join(" · ");
}

export function SocialAccountsView({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const { locale } = useI18n();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [accounts, setAccounts] = useState<AccountCard[]>([]);
  const [unavailable, setUnavailable] = useState<Unavailable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ workspaceSlug, brandSlug });
      const res = await fetch(`/api/social/accounts?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setProviders(data.providers || []);
      setAccounts(data.accounts || []);
      setUnavailable(data.unavailable || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, brandSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const socialError = searchParams.get("socialError");
    if (connected) {
      toast.success(
        connected === "linkedin"
          ? "LinkedIn connected."
          : `${connected} connected.`,
      );
      void load();
    }
    if (socialError) toast.error(socialError);
  }, [searchParams, load]);

  async function connect(platform: string) {
    setBusy(platform);
    try {
      const res = await fetch(`/api/social/accounts/${platform}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, brandSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connect failed");
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      throw new Error("Missing authorization URL");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(null);
    }
  }

  async function refresh(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/social/accounts/${id}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, brandSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      if (data.account?.status === "REAUTH_REQUIRED") {
        toast.error("Connection expired. Reconnect to continue publishing.");
      } else {
        toast.success("Account refreshed.");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/social/accounts/${id}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, brandSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Disconnect failed");
      toast.success("Disconnected.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(null);
    }
  }

  const accountByPlatform = new Map(accounts.map((a) => [a.platform, a]));

  return (
    <div className="space-y-8" dir={locale === "fa" ? "rtl" : "ltr"}>
      <PageHeader
        title="حساب‌های اجتماعی"
        description="اتصال امن حساب‌های کسب‌وکار به Inzorya و مشاهدهٔ قابلیت‌های واقعی هر پلتفرم. انتشار خودکار انجام نمی‌شود."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((p) => {
            const account = accountByPlatform.get(p.platform);
            return (
              <div
                key={p.platform}
                className="space-y-4 rounded-xl border border-border/80 bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-medium tracking-tight">
                      {p.displayName}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {account
                        ? account.accountName || account.username || account.id
                        : p.configured
                          ? "آماده برای اتصال"
                          : "پیکربندی نشده"}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {account
                      ? statusLabel(account.status)
                      : p.configured
                        ? "متصل نیست"
                        : "نیاز به تنظیمات"}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  {capabilitySummary(
                    account?.capabilities || p.capabilities || {},
                  )}
                </p>

                {account?.lastSyncedAt ? (
                  <p className="text-xs text-muted-foreground">
                    آخرین همگام‌سازی:{" "}
                    {new Date(account.lastSyncedAt).toLocaleString()}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {!account && p.configured ? (
                    <Button
                      size="sm"
                      disabled={busy === p.platform}
                      onClick={() => void connect(p.platform)}
                    >
                      <Link2 className="size-4" />
                      اتصال
                    </Button>
                  ) : null}
                  {account &&
                  (account.status === "REAUTH_REQUIRED" ||
                    account.status === "EXPIRED" ||
                    account.status === "ERROR") ? (
                    <Button
                      size="sm"
                      disabled={busy === p.platform}
                      onClick={() => void connect(p.platform)}
                    >
                      اتصال مجدد
                    </Button>
                  ) : null}
                  {account ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === account.id}
                        onClick={() => void refresh(account.id)}
                      >
                        <RefreshCw className="size-4" />
                        تازه‌سازی
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === account.id}
                        onClick={() => void disconnect(account.id)}
                      >
                        <Unplug className="size-4" />
                        قطع اتصال
                      </Button>
                    </>
                  ) : null}
                  {!p.configured ? (
                    <p className="text-xs text-muted-foreground">
                      برای اتصال، شناسه و رمز کلاینت LinkedIn را در تنظیمات سرور قرار دهید.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}

          {unavailable.map((u) => (
            <div
              key={u.platform}
              className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5 opacity-80"
            >
              <h2 className="text-[15px] font-medium capitalize tracking-tight">
                {u.platform === "meta" ? "Instagram / Facebook (Meta)" : "TikTok"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Coming later</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
