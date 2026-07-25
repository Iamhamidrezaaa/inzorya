"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  Clock3,
  Compass,
  FileText,
  Inbox,
  Library,
  LineChart,
  Plus,
  Radio,
  Settings,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
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

type SearchHit = {
  id: string;
  title: string;
  href: string;
  subtitle?: string;
  group?: string;
};

type RecentHit = {
  id: string;
  title: string;
  href: string;
  targetType: string;
};

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
  const activeBrand = brandFromPath ?? brandSlug;
  const groups = getNavGroups(workspaceSlug, activeBrand);
  const base = `/w/${workspaceSlug}`;
  const b = activeBrand ? `${base}/b/${activeBrand}` : base;

  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentHit[]>([]);
  const [hits, setHits] = useState<{
    pages: SearchHit[];
    contacts: SearchHit[];
    knowledge: SearchHit[];
    content: SearchHit[];
    channels: SearchHit[];
  }>({ pages: [], contacts: [], knowledge: [], content: [], channels: [] });

  const loadRecents = useCallback(async () => {
    const res = await fetch(
      `/api/recents?workspaceSlug=${encodeURIComponent(workspaceSlug)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      items: { id: string; title: string; href: string; targetType: string }[];
    };
    setRecents(data.items);
  }, [workspaceSlug]);

  useEffect(() => {
    if (!commandOpen) return;
    void loadRecents();
    setQuery("");
  }, [commandOpen, loadRecents]);

  useEffect(() => {
    if (!commandOpen || !activeBrand) return;
    const q = query.trim();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({
        workspaceSlug,
        brandSlug: activeBrand,
        q,
      });
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setHits({
        pages: data.pages ?? [],
        contacts: data.contacts ?? [],
        knowledge: data.knowledge ?? [],
        content: data.content ?? [],
        channels: data.channels ?? [],
      });
    }, 160);
    return () => clearTimeout(timer);
  }, [query, commandOpen, workspaceSlug, activeBrand]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(!useShellStore.getState().commandOpen);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        useShellStore.getState().toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandOpen]);

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  const searching = query.trim().length > 0;

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput
        placeholder="Search pages, contacts, knowledge, content…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {!searching && recents.length > 0 ? (
          <CommandGroup heading="Recent">
            {recents.map((item) => (
              <CommandItem
                key={item.id}
                value={`recent ${item.title}`}
                onSelect={() => go(item.href)}
              >
                <Clock3 />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {!searching ? (
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => go(`${b}/contacts`)}>
              <Plus />
              New Contact
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/knowledge`)}>
              <Library />
              New Knowledge Document
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/studio`)}>
              <FileText />
              New Content Draft
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/inbox`)}>
              <Inbox />
              Open Inbox
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/strategy`)}>
              <Compass />
              Go to Strategy
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/strategist`)}>
              <Sparkles />
              Open AI Strategist
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/planner`)}>
              <CalendarDays />
              Open AI Content Planner
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/business`)}>
              <Briefcase />
              Open Business Profile
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/channels`)}>
              <Radio />
              Open Channels
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/automations`)}>
              <Workflow />
              Open Automations
            </CommandItem>
            <CommandItem onSelect={() => go(`${b}/analytics`)}>
              <LineChart />
              Open Analytics
            </CommandItem>
            <CommandItem onSelect={() => go(`${base}/settings`)}>
              <Settings />
              Open Settings
              <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        ) : null}

        {searching ? (
          <>
            {hits.pages.length > 0 ? (
              <CommandGroup heading="Pages">
                {hits.pages.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`page ${p.title}`}
                    onSelect={() => go(p.href)}
                  >
                    <Zap />
                    {p.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {hits.contacts.length > 0 ? (
              <CommandGroup heading="Contacts">
                {hits.contacts.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`contact ${c.title}`}
                    onSelect={() => go(c.href)}
                  >
                    <Users />
                    <span className="flex flex-col">
                      <span>{c.title}</span>
                      {c.subtitle ? (
                        <span className="text-xs text-muted-foreground">
                          {c.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {hits.knowledge.length > 0 ? (
              <CommandGroup heading="Knowledge">
                {hits.knowledge.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={`knowledge ${d.title}`}
                    onSelect={() => go(d.href)}
                  >
                    <Library />
                    {d.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {hits.content.length > 0 ? (
              <CommandGroup heading="Content">
                {hits.content.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`content ${c.title}`}
                    onSelect={() => go(c.href)}
                  >
                    <FileText />
                    {c.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {hits.channels.length > 0 ? (
              <CommandGroup heading="Channels">
                {hits.channels.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`channel ${c.title}`}
                    onSelect={() => go(c.href)}
                  >
                    <Radio />
                    {c.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </>
        ) : (
          <>
            <CommandSeparator />
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.title}
                    value={`nav ${group.label} ${item.title}`}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon />
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
