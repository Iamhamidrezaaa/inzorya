"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type FavoriteItem = {
  id: string;
  title: string;
  href: string;
  targetType: string;
  targetId: string;
};

export function useFavorites(workspaceSlug: string) {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(
      `/api/favorites?workspaceSlug=${encodeURIComponent(workspaceSlug)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as { items: FavoriteItem[] };
    setItems(data.items);
    setLoaded(true);
  }, [workspaceSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const togglePageFavorite = useCallback(
    async (input: { targetId: string; title: string; href: string }) => {
      const exists = items.some(
        (f) => f.targetType === "PAGE" && f.targetId === input.targetId,
      );
      if (exists) {
        await fetch("/api/favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceSlug,
            targetType: "PAGE",
            targetId: input.targetId,
          }),
        });
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceSlug,
            targetType: "PAGE",
            targetId: input.targetId,
            title: input.title,
            href: input.href,
          }),
        });
      }
      await refresh();
    },
    [items, refresh, workspaceSlug],
  );

  return { items, loaded, refresh, togglePageFavorite };
}

export function FavoritesNav({
  items,
  collapsed,
  onNavigate,
}: {
  items: FavoriteItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  if (items.length === 0) return null;

  return (
    <div>
      {!collapsed ? (
        <div className="mb-2 px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
          Favorites
        </div>
      ) : null}
      <div className="space-y-0.5">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const link = (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                active
                  ? "bg-accent text-accent-foreground shadow-[inset_2px_0_0_0_var(--primary)]"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <Star
                className={cn(
                  "h-[15px] w-[15px] shrink-0",
                  active ? "fill-primary text-primary" : "text-muted-foreground",
                )}
              />
              {!collapsed ? (
                <span className="truncate">{item.title}</span>
              ) : null}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </div>
    </div>
  );
}
