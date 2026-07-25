"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { getNavGroups, type NavBadges } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/hooks/use-shell-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } =
    useShellStore();
  const brandFromPath = pathname.match(/\/b\/([^/]+)/)?.[1] ?? null;
  const activeBrandSlug = brandFromPath ?? brandSlug;
  const groups = getNavGroups(workspaceSlug, activeBrandSlug, badges);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-3">
        <Link
          href={`/w/${workspaceSlug}/home`}
          className="flex min-w-0 items-center gap-2"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            Iz
          </div>
          {!sidebarCollapsed ? (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">
                Inzorya
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {workspaceName}
              </div>
            </div>
          ) : null}
        </Link>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed ? (
                <div className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-accent text-accent-foreground shadow-[inset_2px_0_0_0_var(--primary)]"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                        sidebarCollapsed && "justify-center px-0",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active && "text-primary",
                        )}
                      />
                      {!sidebarCollapsed ? (
                        <>
                          <span className="flex-1 truncate">{item.title}</span>
                          {badge ? (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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
                        <TooltipContent side="right">
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

      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size={sidebarCollapsed ? "icon" : "sm"}
          className={cn("w-full", !sidebarCollapsed && "justify-start")}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              Collapse
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
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="hidden h-svh shrink-0 overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:flex-col"
      >
        {content}
      </motion.aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-sidebar shadow-xl">
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}
