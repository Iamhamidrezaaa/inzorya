import { ActivityFeed } from "@/components/activity/activity-feed";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function ActivityPage({ params }: PageProps) {
  const { workspaceSlug } = await params;
  return <ActivityFeed workspaceSlug={workspaceSlug} />;
}
