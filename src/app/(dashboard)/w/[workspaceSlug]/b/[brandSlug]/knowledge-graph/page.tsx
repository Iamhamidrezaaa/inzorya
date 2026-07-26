import { KnowledgeGraphWorkspace } from "@/components/knowledge/knowledge-graph-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function KnowledgeGraphPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <KnowledgeGraphWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
    />
  );
}
