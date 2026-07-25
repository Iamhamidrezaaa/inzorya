import { ContentLibrary } from "@/components/content/content-library";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function ContentPage({ params, searchParams }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  const { status } = await searchParams;

  return (
    <ContentLibrary
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
      initialStatus={status}
    />
  );
}
