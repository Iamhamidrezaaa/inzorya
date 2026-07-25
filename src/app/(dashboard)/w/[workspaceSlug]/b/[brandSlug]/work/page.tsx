import { Suspense } from "react";
import { WorkEngineWorkspace } from "@/components/work/work-engine-workspace";
import { Skeleton } from "@/components/ui/skeleton";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function WorkEnginePage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 p-6 lg:grid-cols-[240px_1fr_320px]">
          <Skeleton className="h-[70vh]" />
          <Skeleton className="h-[70vh]" />
          <Skeleton className="h-[70vh]" />
        </div>
      }
    >
      <WorkEngineWorkspace
        workspaceSlug={workspaceSlug}
        brandSlug={brandSlug}
      />
    </Suspense>
  );
}
