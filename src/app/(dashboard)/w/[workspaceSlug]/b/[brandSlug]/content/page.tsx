import { ContentHub } from "@/components/home/content-hub";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ContentHubPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return <ContentHub workspaceSlug={workspaceSlug} brandSlug={brandSlug} />;
}
