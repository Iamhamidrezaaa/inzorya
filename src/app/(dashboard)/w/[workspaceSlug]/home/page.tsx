import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import {
  Inbox,
  MessageSquareWarning,
  Sparkles,
} from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspaceForUser } from "@/server/services/workspace";
import {
  ensureBusinessBrain,
  ensureStrategyForBrain,
  completionFromBrain,
} from "@/server/services/business-brain";
import { localizeBrainCompletion } from "@/i18n/localize-brain";
import { getI18n } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

export default async function HomePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { workspaceSlug } = await params;
  const { locale, dictionary: d } = await getI18n();
  const dateLocale = locale === "fa" ? faIR : undefined;

  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) redirect("/dashboard");

  const brand = workspace.brands[0];
  if (!brand) {
    redirect(`/onboarding/business?workspace=${workspaceSlug}`);
  }

  const brandBase = `/w/${workspaceSlug}/b/${brand.slug}`;
  const brain = await ensureBusinessBrain(brand.id);
  const strategy = await ensureStrategyForBrain(brand.id);
  const brainCompletion = localizeBrainCompletion(
    completionFromBrain({
      answers: brain.answers,
      voice: brain.voice,
      assetsCount: brain.assets.length,
      competitorsCount: strategy.competitors.length,
      pillarsCount: strategy.pillars.length,
    }),
    d.brain,
  );

  const [unread, pendingReplies, recentConversations, recentActivities] =
    await Promise.all([
      prisma.conversation.count({
        where: { brandId: brand.id, isUnread: true },
      }),
      prisma.conversation.count({
        where: { brandId: brand.id, status: "OPEN", isUnread: true },
      }),
      prisma.conversation.findMany({
        where: { brandId: brand.id },
        include: { contact: true },
        orderBy: { lastMessageAt: "desc" },
        take: 5,
      }),
      prisma.activity.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const firstName =
    session.user.name?.split(" ")[0] || d.home.welcomeGuest;
  const next = brainCompletion.nextAction;
  const h = d.home;

  return (
    <div className="space-y-8">
      <PageHeader
        title={fill(h.welcomeBack, { name: firstName })}
        description={h.description}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`${brandBase}/brain`}>{h.businessBrain}</Link>
            </Button>
            <Button asChild>
              <Link
                href={
                  next
                    ? `${brandBase}${next.hrefSuffix}`
                    : `${brandBase}/brain/interview`
                }
              >
                <Sparkles className="h-4 w-4" />
                {next?.label ?? h.startInterview}
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs lg:col-span-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {h.progressTitle}
          </div>
          <div className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">
            {brainCompletion.score}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${brainCompletion.completionPercent}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {fill(h.percentComplete, {
              percent: brainCompletion.completionPercent,
              done: brainCompletion.sectionsCompleted,
              total: brainCompletion.sectionsTotal,
            })}
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs lg:col-span-2">
          <h2 className="text-[15px] font-medium tracking-tight">
            {h.nextActionTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {next
              ? fill(h.nextActionHint, { label: next.label })
              : h.brainSolid}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {brainCompletion.recommendations.map((r) => (
              <Badge
                key={r}
                variant="secondary"
                className="max-w-full whitespace-normal py-1"
              >
                {r}
              </Badge>
            ))}
          </div>
          <div className="mt-5">
            <Button asChild size="sm">
              <Link
                href={
                  next
                    ? `${brandBase}${next.hrefSuffix}`
                    : `${brandBase}/strategy`
                }
              >
                {next ? h.continue : h.openStrategy}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
          <h3 className="text-[15px] font-medium tracking-tight">
            {h.missingSections}
          </h3>
          {brainCompletion.missing.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {h.allSectionsFilled}
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {brainCompletion.missing.slice(0, 5).map((m) => (
                <li key={m.groupKey}>
                  <Link
                    href={`${brandBase}/brain/interview?group=${m.groupKey}`}
                    className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
                  >
                    <span>{m.groupLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      {fill(h.leftCount, { count: m.keys.length })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-medium tracking-tight">
              {h.recentUpdates}
            </h3>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/w/${workspaceSlug}/activity`}>{h.activity}</Link>
            </Button>
          </div>
          {recentActivities.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{h.noUpdates}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentActivities.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{a.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(a.createdAt, {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-medium tracking-tight">
              {h.recentConversations}
            </h3>
            <Button asChild size="sm" variant="ghost">
              <Link href={`${brandBase}/inbox`}>{h.inbox}</Link>
            </Button>
          </div>
          {recentConversations.length === 0 ? (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {h.noConversations}
            </p>
          ) : (
            <ul className="mt-5 space-y-3.5">
              {recentConversations.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium">
                    {c.contact.name ||
                      c.contact.instagramUsername ||
                      h.contact}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(c.lastMessageAt, {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
          <h3 className="text-[15px] font-medium tracking-tight">
            {h.pendingReplies}
          </h3>
          {pendingReplies === 0 && unread === 0 ? (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {h.nothingWaiting}
            </p>
          ) : (
            <div className="mt-5 flex items-center gap-3 text-sm">
              <MessageSquareWarning className="h-4 w-4 text-muted-foreground" />
              <span>
                {fill(h.pendingUnread, {
                  pending: pendingReplies,
                  unread,
                })}
              </span>
              <Button asChild size="sm" variant="outline" className="ms-auto">
                <Link href={`${brandBase}/inbox`}>
                  <Inbox className="h-4 w-4" />
                  {h.review}
                </Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
