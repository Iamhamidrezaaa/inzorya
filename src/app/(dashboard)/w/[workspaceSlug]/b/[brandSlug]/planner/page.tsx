import { ContentPlannerWorkspace } from "@/components/planner/content-planner-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ContentPlannerPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <ContentPlannerWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
