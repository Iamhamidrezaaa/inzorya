import { BusinessBrainWorkspace } from "@/components/brain/business-brain-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function BusinessBrainPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <BusinessBrainWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
      mode="overview"
    />
  );
}
