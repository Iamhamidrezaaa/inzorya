"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PageHeader, EmptyState } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type ActivityItem = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  href: string | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
};

export function ActivityFeed({ workspaceSlug }: { workspaceSlug: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch(
        `/api/activity?workspaceSlug=${encodeURIComponent(workspaceSlug)}`,
      );
      setLoading(false);
      if (!res.ok) return;
      const data = (await res.json()) as { items: ActivityItem[] };
      setItems(data.items);
    })();
  }, [workspaceSlug]);

  return (
    <div>
      <PageHeader
        title="Activity"
        description="A single timeline of meaningful workspace changes — no noise, no AI."
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Updates to business, channels, knowledge, content, and strategy will appear here."
        />
      ) : (
        <ol className="relative space-y-0 border-l border-border/70 pl-6">
          {items.map((item) => (
            <li key={item.id} className="relative pb-6 last:pb-0">
              <span className="absolute -left-[1.55rem] top-2 h-3 w-3 rounded-full border border-border bg-card" />
              <div className="rounded-xl border border-border/70 bg-card/60 px-4 py-3 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted" className="capitalize">
                    {item.kind.replaceAll("_", " ").toLowerCase()}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  {item.user?.name || item.user?.email ? (
                    <span className="text-[11px] text-muted-foreground">
                      · {item.user.name || item.user.email}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 text-sm font-medium tracking-tight">
                  {item.href ? (
                    <Link href={item.href} className="hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </div>
                {item.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
