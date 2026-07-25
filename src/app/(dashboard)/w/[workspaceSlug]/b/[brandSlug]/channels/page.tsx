import { Suspense } from "react";
import { ChannelsView } from "@/components/channels/channels-view";
import { Skeleton } from "@/components/ui/skeleton";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ChannelsPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      }
    >
      <ChannelsView workspaceSlug={workspaceSlug} brandSlug={brandSlug} />
    </Suspense>
  );
}
