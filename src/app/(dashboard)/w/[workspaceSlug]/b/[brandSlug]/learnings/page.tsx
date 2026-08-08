import { PerformanceLearningsView } from "@/components/learnings/performance-learnings-view";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function LearningsPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <PerformanceLearningsView
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
