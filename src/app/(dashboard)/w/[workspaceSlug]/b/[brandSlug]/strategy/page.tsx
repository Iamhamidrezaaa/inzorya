import { StrategyWorkspace } from "@/components/strategy/strategy-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function StrategyPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <StrategyWorkspace workspaceSlug={workspaceSlug} brandSlug={brandSlug} />
  );
}
