import { StrategistWorkspace } from "@/components/strategist/strategist-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function StrategistPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <StrategistWorkspace workspaceSlug={workspaceSlug} brandSlug={brandSlug} />
  );
}
