import { ChannelsView } from "@/components/channels/channels-view";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ChannelsPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return <ChannelsView workspaceSlug={workspaceSlug} brandSlug={brandSlug} />;
}
