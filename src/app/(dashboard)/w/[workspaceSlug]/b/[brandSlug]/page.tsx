import { redirect } from "next/navigation";

export default async function BrandIndexPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
}) {
  const { workspaceSlug, brandSlug } = await params;
  redirect(`/w/${workspaceSlug}/b/${brandSlug}/brand`);
}
