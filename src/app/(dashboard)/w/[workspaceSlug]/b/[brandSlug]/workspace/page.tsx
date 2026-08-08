import { WorkspaceHub } from "@/components/home/workspace-hub";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function WorkspaceHubPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <WorkspaceHub workspaceSlug={workspaceSlug} brandSlug={brandSlug} />
  );
}
