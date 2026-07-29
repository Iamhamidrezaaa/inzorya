"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "@/components/providers/theme-provider";
import {
  Bell,
  Check,
  ChevronsUpDown,
  Keyboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useShellStore } from "@/hooks/use-shell-store";
import { NotificationsPanel } from "@/components/shell/notifications-panel";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/i18n/client";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";

type BrandOption = { id: string; name: string; slug: string };
type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  brands: BrandOption[];
};

type TopBarProps = {
  workspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  brandSlug?: string | null;
};

function titleCase(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const BREADCRUMB_NAV: Record<string, keyof Dictionary["nav"]> = {
  home: "home",
  brain: "businessBrain",
  strategy: "strategy",
  strategist: "aiStrategist",
  planner: "aiContentPlanner",
  creator: "aiContentCreator",
  opportunities: "opportunities",
  community: "communityManager",
  decisions: "decisionCenter",
  work: "taskEngine",
  calendar: "calendarIntelligence",
  "knowledge-graph": "knowledgeGraph",
  matching: "matchingEngine",
  recommendations: "campaignRecommendations",
  pipeline: "executionPipeline",
  inbox: "inbox",
  contacts: "contacts",
  channels: "channels",
  automations: "automations",
  analytics: "analytics",
  knowledge: "knowledge",
  studio: "contentStudio",
  campaigns: "campaigns",
  media: "media",
  activity: "activity",
  settings: "settings",
  brand: "brand",
};

export function TopBar({ workspace, workspaces, brandSlug }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { dictionary: d } = useI18n();
  const {
    setMobileNavOpen,
    setCommandOpen,
    notificationsOpen,
    setNotificationsOpen,
  } = useShellStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const brandFromPath = pathname.match(/\/b\/([^/]+)/)?.[1] ?? null;
  const resolvedBrandSlug = brandFromPath ?? brandSlug;
  const activeBrand =
    workspace.brands.find((b) => b.slug === resolvedBrandSlug) ??
    workspace.brands[0];

  const refreshUnread = useCallback(async () => {
    const params = new URLSearchParams({ workspaceSlug: workspace.slug });
    if (resolvedBrandSlug) params.set("brandSlug", resolvedBrandSlug);
    const res = await fetch(`/api/notifications?${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as { unreadCount: number };
    setUnreadCount(data.unreadCount ?? 0);
  }, [workspace.slug, resolvedBrandSlug]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  const brandSlugs = new Set(workspace.brands.map((b) => b.slug));
  const crumbs = pathname
    .split("/")
    .filter(Boolean)
    .slice(2)
    .filter((segment) => segment !== "b")
    .map((segment, index, arr) => {
      const navKey = BREADCRUMB_NAV[segment];
      const brand = workspace.brands.find((b) => b.slug === segment);
      const label = brand
        ? brand.name
        : navKey
          ? d.nav[navKey]
          : brandSlugs.has(segment)
            ? segment
            : titleCase(segment);
      return {
        label,
        href:
          index === arr.length - 1
            ? undefined
            : `/w/${workspace.slug}/` +
              pathname
                .split("/")
                .filter(Boolean)
                .slice(2, index + 3)
                .join("/"),
      };
    });

  const initials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    session?.user?.email?.[0]?.toUpperCase() ||
    "U";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur-md md:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only">{d.shell.openNav}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="max-w-[160px] gap-1">
              <span className="truncate">{workspace.name}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{d.shell.workspaces}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => router.push(`/w/${ws.slug}/home`)}
              >
                <span className="flex-1 truncate">{ws.name}</span>
                {ws.slug === workspace.slug ? (
                  <Check className="h-4 w-4" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="max-w-[160px] gap-1">
              <span className="truncate">
                {activeBrand?.name ?? d.shell.selectBrand}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{d.shell.brands}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspace.brands.length === 0 ? (
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/onboarding/business?workspace=${workspace.slug}`)
                }
              >
                {d.shell.createBrand}
              </DropdownMenuItem>
            ) : (
              workspace.brands.map((brand) => (
                <DropdownMenuItem
                  key={brand.id}
                  onClick={() =>
                    router.push(`/w/${workspace.slug}/b/${brand.slug}/brand`)
                  }
                >
                  <span className="flex-1 truncate">{brand.name}</span>
                  {brand.slug === activeBrand?.slug ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden min-w-0 flex-1 lg:block">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/w/${workspace.slug}/home`}>
                    {workspace.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {crumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="contents">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitcher variant="ghost" size="sm" showLabel={false} />
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-2 text-muted-foreground sm:inline-flex"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="h-3.5 w-3.5" />
            {d.common.search}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setNotificationsOpen(true)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span
                className={cn(
                  "absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground",
                )}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
            <span className="sr-only">{d.shell.notifications}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">
                    {session?.user?.name ?? d.shell.account}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session?.user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/w/${workspace.slug}/settings`)
                }
              >
                <UserRound className="h-4 w-4" />
                {d.shell.settings}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {d.common.themeToggle}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCommandOpen(true)}>
                <Keyboard className="h-4 w-4" />
                {d.common.shortcuts}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-4 w-4" />
                {d.common.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <NotificationsPanel
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        workspaceSlug={workspace.slug}
        brandSlug={resolvedBrandSlug}
        onUnreadChange={setUnreadCount}
      />
    </>
  );
}
