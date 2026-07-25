import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function AutomationRunsPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <div>
      <PageHeader
        title="Automation runs"
        description="Execution history is mocked for now — structure is ready for a future runner."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/w/${workspaceSlug}/b/${brandSlug}/automations`}>
              Back to automations
            </Link>
          </Button>
        }
      />
      <EmptyState
        title="No live executions yet"
        description="Workflows can be designed and versioned today. The execution engine ships in a later sprint."
        icon={<History className="h-8 w-8" />}
        actionLabel="Open builder list"
        actionHref={`/w/${workspaceSlug}/b/${brandSlug}/automations`}
      />
    </div>
  );
}
