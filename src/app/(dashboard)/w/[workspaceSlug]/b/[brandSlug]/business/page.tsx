import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspaceForUser } from "@/server/services/workspace";
import { computeBusinessCompletion } from "@/lib/business";
import { BusinessProfileEditor } from "@/components/business/business-profile-editor";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function BusinessPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { workspaceSlug, brandSlug } = await params;
  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) notFound();

  const brand = workspace.brands.find((b) => b.slug === brandSlug);
  if (!brand) notFound();

  const profile = await prisma.businessProfile.findUnique({
    where: { brandId: brand.id },
  });

  return (
    <BusinessProfileEditor
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
      brandName={brand.name}
      completion={computeBusinessCompletion(profile)}
      profile={profile}
    />
  );
}
