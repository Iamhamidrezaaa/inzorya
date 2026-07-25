import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { IntegrationSettings } from "@/components/settings/integration-settings";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function IntegrationsSettingsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { workspaceSlug } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: workspaceSlug,
      members: { some: { userId: session.user.id } },
    },
    include: {
      brands: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  return (
    <IntegrationSettings
      workspaceSlug={workspaceSlug}
      brandSlug={workspace?.brands[0]?.slug || null}
    />
  );
}
