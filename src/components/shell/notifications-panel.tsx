"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/page";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  brandSlug?: string | null;
  onUnreadChange?: (count: number) => void;
};

export function NotificationsPanel({
  open,
  onOpenChange,
  workspaceSlug,
  brandSlug,
  onUnreadChange,
}: NotificationsPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ workspaceSlug });
    if (brandSlug) params.set("brandSlug", brandSlug);
    const res = await fetch(`/api/notifications?${params}`);
    setLoading(false);
    if (!res.ok) return;
    const data = (await res.json()) as {
      items: NotificationItem[];
      unreadCount: number;
    };
    setItems(data.items);
    onUnreadChange?.(data.unreadCount);
  }, [workspaceSlug, brandSlug, onUnreadChange]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, markAllRead: true }),
    });
    await load();
  }

  async function openItem(item: NotificationItem) {
    if (!item.readAt) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, id: item.id }),
      });
    }
    onOpenChange(false);
    if (item.href) router.push(item.href);
    else void load();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>
                System, workspace, channel, and strategy updates.
              </SheetDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-muted/50"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              className="min-h-0 border-0 bg-transparent py-16"
              title="No notifications"
              description="Workspace events and reminders will show up here."
            />
          ) : (
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className={cn(
                      "w-full rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:bg-accent/50",
                      !item.readAt && "bg-accent/30",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="muted" className="capitalize">
                        {item.type.toLowerCase()}
                      </Badge>
                      {!item.readAt ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      ) : null}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm font-medium tracking-tight">
                      {item.title}
                    </div>
                    {item.body ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
