"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  ChevronDown,
  Headphones,
  Inbox,
  Radio,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { getAdvancedNavItems } from "@/lib/navigation";
import { PageHeader } from "@/components/shared/page";
import { cn } from "@/lib/utils";

export function WorkspaceHub({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const { locale, dictionary: d } = useI18n();
  const hub = d.workspaceHub;
  const base = `/w/${workspaceSlug}/b/${brandSlug}`;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const everyday = [
    {
      href: `${base}/business`,
      title: hub.business,
      desc: hub.businessDesc,
      icon: Briefcase,
    },
    {
      href: `${base}/channels`,
      title: hub.channels,
      desc: hub.channelsDesc,
      icon: Radio,
    },
    {
      href: `${base}/inbox`,
      title: hub.inbox,
      desc: hub.inboxDesc,
      icon: Inbox,
    },
    {
      href: `${base}/community`,
      title: hub.community,
      desc: hub.communityDesc,
      icon: Headphones,
    },
  ];

  const advanced = getAdvancedNavItems(
    workspaceSlug,
    brandSlug,
    {},
    d.nav,
  ).filter(
    (item) =>
      ![
        `${base}/business`,
        `${base}/channels`,
        `${base}/inbox`,
        `${base}/community`,
        `${base}/planner`,
        `${base}/creator`,
        `${base}/studio`,
        `${base}/strategist`,
        `${base}/calendar`,
        `${base}/analytics`,
        `${base}/content`,
        `${base}/workspace`,
      ].includes(item.href),
  );

  return (
    <div className="space-y-8" dir={locale === "fa" ? "rtl" : "ltr"}>
      <PageHeader title={hub.title} description={hub.subtitle} />

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {hub.everyday}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {everyday.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-colors hover:bg-accent/40"
            >
              <item.icon className="mb-2 size-4 text-primary" />
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border/70 px-4 py-3 text-start"
        >
          <div>
            <p className="text-sm font-medium">{hub.advanced}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hub.advancedHint}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              advancedOpen && "rotate-180",
            )}
          />
        </button>
        {advancedOpen ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {advanced.map((item) => (
              <Link
                key={item.href + item.title}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
              >
                <item.icon className="size-3.5 shrink-0" />
                <span className="truncate">{item.title}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
