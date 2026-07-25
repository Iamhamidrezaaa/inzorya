import { AnalyticsView } from "@/components/analytics/analytics-view";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function AnalyticsPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <AnalyticsView workspaceSlug={workspaceSlug} brandSlug={brandSlug} />
  );
}
