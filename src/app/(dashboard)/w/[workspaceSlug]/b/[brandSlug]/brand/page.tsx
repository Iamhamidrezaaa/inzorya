import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBrandForWorkspace, getWorkspaceForUser } from "@/server/services/workspace";
import { BrandEditor } from "@/components/brand/brand-editor";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function BrandPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { workspaceSlug, brandSlug } = await params;
  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) notFound();

  const brand = await getBrandForWorkspace(workspace.id, brandSlug);
  if (!brand) notFound();

  return (
    <BrandEditor
      workspaceSlug={workspaceSlug}
      brand={{
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        website: brand.website,
        industry: brand.industry,
        brandVoice: brand.brandVoice,
        targetAudience: brand.targetAudience,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        logoUrl: brand.logoUrl,
      }}
    />
  );
}
