import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  Inbox,
  Library,
  MessageSquareWarning,
  Radio,
  Sparkles,
} from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspaceForUser } from "@/server/services/workspace";
import { computeBusinessCompletion } from "@/lib/business";
import { PageHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function HomePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) redirect("/dashboard");

  const brand = workspace.brands[0];
  if (!brand) {
    redirect(`/onboarding/business?workspace=${workspaceSlug}`);
  }

  const brandBase = `/w/${workspaceSlug}/b/${brand.slug}`;
  const profile = await prisma.businessProfile.findUnique({
    where: { brandId: brand.id },
  });

  if (!profile?.onboardingCompletedAt && (profile?.onboardingStep ?? 0) < 3) {
    // Soft nudge only via home card — don't force redirect forever
  }

  const completion = computeBusinessCompletion(profile);

  const [
    connectedChannels,
    knowledgeCount,
    draftCount,
    unread,
    pendingReplies,
    recentConversations,
  ] = await Promise.all([
    prisma.channelConnection.count({
      where: { brandId: brand.id, status: "CONNECTED" },
    }),
    prisma.knowledgeDocument.count({ where: { brandId: brand.id } }),
    prisma.contentItem.count({
      where: { brandId: brand.id, status: "DRAFT" },
    }),
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
  ]);

  const firstName = session.user.name?.split(" ")[0] || "there";
  const health =
    completion >= 70 && connectedChannels > 0
      ? "Strong foundation"
      : completion >= 40
        ? "Getting there"
        : "Needs setup";

  const stats = [
    {
      label: "Business completion",
      value: `${completion}%`,
      href: `${brandBase}/business`,
      icon: Sparkles,
    },
    {
      label: "Connected channels",
      value: connectedChannels,
      href: `${brandBase}/channels`,
      icon: Radio,
    },
    {
      label: "Knowledge documents",
      value: knowledgeCount,
      href: `${brandBase}/knowledge`,
      icon: Library,
    },
    {
      label: "Content drafts",
      value: draftCount,
      href: `${brandBase}/content?status=DRAFT`,
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Business brain + channels first. Conversations and AI build on this."
        actions={
          <div className="flex gap-2">
            {completion < 100 ? (
              <Button asChild variant="outline">
                <Link href={`/onboarding/business?workspace=${workspaceSlug}`}>
                  Resume onboarding
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href={`${brandBase}/inbox`}>Open inbox</Link>
            </Button>
          </div>
        }
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Marketing health</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {health}. Completion {completion}% · {connectedChannels} channel
              {connectedChannels === 1 ? "" : "s"} connected.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`${brandBase}/business`}>Edit business</Link>
          </Button>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-border bg-card/60 p-4 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </span>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">
              {stat.value}
            </div>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent conversations</h3>
            <Button asChild size="sm" variant="ghost">
              <Link href={`${brandBase}/inbox`}>Inbox</Link>
            </Button>
          </div>
          {recentConversations.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No conversations yet. Connect channels and customers will land in
              Inbox.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentConversations.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium">
                    {c.contact.name ||
                      c.contact.instagramUsername ||
                      "Contact"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(c.lastMessageAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Pending replies</h3>
          {pendingReplies === 0 && unread === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing waiting. Unread and open threads will appear here.
            </p>
          ) : (
            <div className="mt-4 flex items-center gap-3 text-sm">
              <MessageSquareWarning className="h-4 w-4 text-muted-foreground" />
              <span>
                {pendingReplies} pending · {unread} unread
              </span>
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link href={`${brandBase}/inbox`}>
                  <Inbox className="h-4 w-4" />
                  Review
                </Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
