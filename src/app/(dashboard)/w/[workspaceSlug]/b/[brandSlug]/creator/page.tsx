import { ContentCreatorWorkspace } from "@/components/creator/content-creator-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ContentCreatorPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <ContentCreatorWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
