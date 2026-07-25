import { KnowledgeWorkspace } from "@/components/knowledge/knowledge-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
  searchParams: Promise<{ doc?: string }>;
};

export default async function KnowledgePage({ params, searchParams }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  const { doc } = await searchParams;

  return (
    <KnowledgeWorkspace
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
      initialDocId={doc}
    />
  );
}
