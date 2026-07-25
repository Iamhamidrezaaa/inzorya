import { OpportunitiesWorkspace } from "@/components/opportunities/opportunities-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function OpportunitiesPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <OpportunitiesWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
