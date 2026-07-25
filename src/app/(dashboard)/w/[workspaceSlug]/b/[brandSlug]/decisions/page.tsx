import { DecisionCenterWorkspace } from "@/components/decisions/decision-center-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function DecisionCenterPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <DecisionCenterWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
