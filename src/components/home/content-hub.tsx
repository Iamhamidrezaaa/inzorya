"use client";

import Link from "next/link";
import { CalendarDays, Clapperboard, PenLine } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { usePageCopy } from "@/i18n/use-page-copy";
import { PageHeader } from "@/components/shared/page";

export function ContentHub({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const { locale, dictionary: d } = useI18n();
  const page = usePageCopy("content");
  const hub = d.contentHub;
  const base = `/w/${workspaceSlug}/b/${brandSlug}`;

  const actions = [
    {
      href: `${base}/planner`,
      title: hub.planWeek,
      desc: hub.planWeekDesc,
      icon: CalendarDays,
    },
    {
      href: `${base}/creator`,
      title: hub.createPosts,
      desc: hub.createPostsDesc,
      icon: PenLine,
    },
    {
      href: `${base}/studio`,
      title: hub.openStudio,
      desc: hub.openStudioDesc,
      icon: Clapperboard,
    },
  ];

  return (
    <div className="space-y-8" dir={locale === "fa" ? "rtl" : "ltr"}>
      <PageHeader title={hub.title} description={hub.subtitle || page.description} />
      <div className="grid gap-3 md:grid-cols-3">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-xl border border-border/80 bg-card p-5 shadow-xs transition-colors hover:bg-accent/40"
          >
            <a.icon className="mb-3 size-5 text-primary" />
            <h2 className="text-[15px] font-medium tracking-tight">{a.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
