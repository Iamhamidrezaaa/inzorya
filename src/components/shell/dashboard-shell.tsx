"use client";

import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { CommandPalette } from "@/components/shell/command-palette";
import { FadeIn } from "@/components/shared/fade-in";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/hooks/use-shell-store";
import type { NavBadges } from "@/lib/navigation";

type BrandOption = { id: string; name: string; slug: string };
type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  brands: BrandOption[];
};

type DashboardShellProps = {
  workspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  brandSlug?: string | null;
  badges?: NavBadges;
  children: React.ReactNode;
};

export function DashboardShell({
  workspace,
  workspaces,
  brandSlug,
  badges,
  children,
}: DashboardShellProps) {
  const { sidebarCollapsed } = useShellStore();

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar
        workspaceSlug={workspace.slug}
        brandSlug={brandSlug}
        workspaceName={workspace.name}
        badges={badges}
      />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          sidebarCollapsed
            ? "md:max-w-[calc(100%-3.5rem)]"
            : "md:max-w-[calc(100%-15rem)]",
        )}
      >
        <TopBar
          workspace={workspace}
          workspaces={workspaces}
          brandSlug={brandSlug}
        />
        <main className="flex-1 px-5 py-7 md:px-10 md:py-8">
          <FadeIn>{children}</FadeIn>
        </main>
      </div>
      <CommandPalette workspaceSlug={workspace.slug} brandSlug={brandSlug} />
    </div>
  );
}
