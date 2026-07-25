import { AutomationsList } from "@/components/automations/automations-list";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function AutomationsPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <AutomationsList workspaceSlug={workspaceSlug} brandSlug={brandSlug} />
  );
}
