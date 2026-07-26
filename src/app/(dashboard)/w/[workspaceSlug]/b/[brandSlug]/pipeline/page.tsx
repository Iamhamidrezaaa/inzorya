import { ExecutionPipelineWorkspace } from "@/components/pipeline/execution-pipeline-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ExecutionPipelinePage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <ExecutionPipelineWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
