import { ContentWorkspaceDetail } from "@/components/content-workspace/content-workspace-detail";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    brandSlug: string;
    draftId: string;
  }>;
};

export default async function ContentWorkspaceDetailPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug, draftId } = await params;
  return (
    <ContentWorkspaceDetail
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
      draftId={draftId}
    />
  );
}
