import { Suspense } from "react";
import { ContentStudio } from "@/components/studio/content-studio";
import { PageSkeleton } from "@/components/shared/page";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function StudioPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContentStudio workspaceSlug={workspaceSlug} brandSlug={brandSlug} />
    </Suspense>
  );
}
