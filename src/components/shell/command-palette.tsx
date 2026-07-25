"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { getNavGroups } from "@/lib/navigation";
import { useShellStore } from "@/hooks/use-shell-store";

type CommandPaletteProps = {
  workspaceSlug: string;
  brandSlug?: string | null;
};

export function CommandPalette({
  workspaceSlug,
  brandSlug,
}: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { commandOpen, setCommandOpen } = useShellStore();
  const brandFromPath = pathname.match(/\/b\/([^/]+)/)?.[1] ?? null;
  const groups = getNavGroups(workspaceSlug, brandFromPath ?? brandSlug);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(!commandOpen);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        useShellStore.getState().toggleSidebar();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandOpen, setCommandOpen]);

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search navigation and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.title}
                value={`${group.label} ${item.title}`}
                onSelect={() => go(item.href)}
              >
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() =>
              go(`/onboarding/business?workspace=${workspaceSlug}`)
            }
          >
            Create brand
          </CommandItem>
          <CommandItem
            onSelect={() => go(`/w/${workspaceSlug}/settings`)}
          >
            Open settings
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
