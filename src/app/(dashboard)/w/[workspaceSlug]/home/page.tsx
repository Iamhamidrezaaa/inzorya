import { EmptyState, PageHeader } from "@/components/shared/page";
import { pageCopy } from "@/lib/navigation";

const modules = [
  {
    title: "Today's focus",
    body: "Prioritized tasks, approvals, and failing runs will surface here.",
  },
  {
    title: "Recent AI activity",
    body: "Agent and automation events will appear once AI features ship.",
  },
  {
    title: "Running automations",
    body: "Live and queued workflow counts will link into Automations.",
  },
  {
    title: "Pending approvals",
    body: "Content waiting for review will collect in this module.",
  },
  {
    title: "Campaign health",
    body: "Status for active campaigns will show here — no fake metrics.",
  },
  {
    title: "Quick actions",
    body: "Create content, campaigns, media uploads, and knowledge asks.",
  },
  {
    title: "Recent content",
    body: "Last-edited pieces will list here as the library grows.",
  },
  {
    title: "Notifications",
    body: "A truncated feed of workspace events will appear in this card.",
  },
] as const;

export default function HomePage() {
  const copy = pageCopy.home;

  return (
    <div>
      <PageHeader title={copy.title} description={copy.description} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <div
            key={module.title}
            className="rounded-xl border border-border bg-card/50 p-5"
          >
            <h2 className="text-sm font-medium text-foreground">
              {module.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{module.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      </div>
    </div>
  );
}
