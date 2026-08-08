"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Star } from "lucide-react";
import { getNavGroups, type NavBadges } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/hooks/use-shell-store";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FavoritesNav, useFavorites } from "@/components/shell/favorites";

type SidebarProps = {
  workspaceSlug: string;
  brandSlug?: string | null;
  workspaceName: string;
  badges?: NavBadges;
};

export function Sidebar({
  workspaceSlug,
  brandSlug,
  workspaceName,
  badges,
}: SidebarProps) {
  const pathname = usePathname();
  const { dictionary, locale } = useI18n();
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } =
    useShellStore();
  const brandFromPath = pathname.match(/\/b\/([^/]+)/)?.[1] ?? null;
  const activeBrandSlug = brandFromPath ?? brandSlug;
  const groups = getNavGroups(
    workspaceSlug,
    activeBrandSlug,
    badges,
    dictionary.nav,
  );
  const { items: favorites, togglePageFavorite } = useFavorites(workspaceSlug);

  const pageKey = pathname;
  const isFavorited = favorites.some(
    (f) => f.targetType === "PAGE" && f.targetId === pageKey,
  );

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b border-border/60 px-3">
        <Link
          href={`/w/${workspaceSlug}/home`}
          className="flex min-w-0 flex-1 items-center gap-2.5"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold tracking-tight text-primary-foreground">
            Iz
          </div>
          {!sidebarCollapsed ? (
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold tracking-tight">
                Inzorya
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {workspaceName}
              </div>
            </div>
          ) : null}
        </Link>
        {!sidebarCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() =>
                  void togglePageFavorite({
                    targetId: pageKey,
                    title:
                      pathname.split("/").filter(Boolean).pop()?.replace(
                        /-/g,
                        " ",
                      ) || "Page",
                    href: pathname,
                  })
                }
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    isFavorited && "fill-primary text-primary",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFavorited
                ? dictionary.shell.unfavorite
                : dictionary.shell.favorite}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <div className="space-y-6">
          <FavoritesNav
            items={favorites}
            collapsed={sidebarCollapsed}
            onNavigate={() => setMobileNavOpen(false)}
          />

          {groups.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed && group.label ? (
                <div className="mb-2 px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                  {group.label}
                </div>
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const badge =
                    item.badge && item.badge > 0 ? item.badge : null;
                  const link = (
                    <Link
                      key={item.href + item.title}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-[background-color,color,box-shadow] duration-150",
                        active
                          ? "border-s-2 border-primary bg-accent text-accent-foreground"
                          : "border-s-2 border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        sidebarCollapsed && "justify-center px-0",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[15px] w-[15px] shrink-0 transition-colors",
                          active
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {!sidebarCollapsed ? (
                        <>
                          <span className="flex-1 truncate">{item.title}</span>
                          {badge ? (
                            <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {badge > 99 ? "99+" : badge}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </Link>
                  );

                  if (sidebarCollapsed) {
                    return (
                      <Tooltip key={item.title}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side={locale === "fa" ? "left" : "right"}>
                          {item.title}
                          {badge ? ` (${badge})` : ""}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return link;
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 p-2">
        <Button
          variant="ghost"
          size={sidebarCollapsed ? "icon" : "sm"}
          className={cn(
            "w-full text-muted-foreground",
            !sidebarCollapsed && "justify-start",
          )}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
              {dictionary.shell.collapse}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 56 : 240 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="hidden h-svh shrink-0 overflow-hidden border-e border-border/60 bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:flex-col"
      >
        {content}
      </motion.aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label={dictionary.shell.closeNav}
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 w-72 border-e border-border/60 bg-sidebar shadow-lg">
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}
