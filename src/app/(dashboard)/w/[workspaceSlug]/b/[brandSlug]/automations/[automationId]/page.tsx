import { AutomationBuilder } from "@/components/automations/automation-builder";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    brandSlug: string;
    automationId: string;
  }>;
};

export default async function AutomationBuilderPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug, automationId } = await params;
  return (
    <AutomationBuilder
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
      automationId={automationId}
    />
  );
}
