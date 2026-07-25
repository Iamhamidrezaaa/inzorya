import { CommunityManagerWorkspace } from "@/components/community/community-manager-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function CommunityManagerPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <CommunityManagerWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
