import { CampaignRecommendationsWorkspace } from "@/components/recommendations/campaign-recommendations-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function CampaignRecommendationsPage({
  params,
}: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <CampaignRecommendationsWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
