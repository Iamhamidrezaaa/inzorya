import { Suspense } from "react";
import { BusinessBrainWorkspace } from "@/components/brain/business-brain-workspace";
import { PageSkeleton } from "@/components/shared/page";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function BusinessBrainInterviewPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BusinessBrainWorkspace
        workspaceSlug={workspaceSlug}
        brandSlug={brandSlug}
        mode="interview"
      />
    </Suspense>
  );
}
