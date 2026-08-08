import { ContentWorkspaceList } from "@/components/content-workspace/content-workspace-list";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ContentWorkspacePage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <ContentWorkspaceList
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
