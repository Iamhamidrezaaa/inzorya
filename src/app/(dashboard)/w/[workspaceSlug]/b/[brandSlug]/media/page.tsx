import { MediaManager } from "@/components/media/media-manager";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function MediaPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return <MediaManager workspaceSlug={workspaceSlug} brandSlug={brandSlug} />;
}
