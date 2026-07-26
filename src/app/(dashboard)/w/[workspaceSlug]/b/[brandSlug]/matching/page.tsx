import { MatchingEngineWorkspace } from "@/components/matching/matching-engine-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function MatchingEnginePage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <MatchingEngineWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
