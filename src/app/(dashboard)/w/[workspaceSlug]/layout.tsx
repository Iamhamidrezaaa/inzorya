import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getUserWorkspaces,
  getWorkspaceForUser,
} from "@/server/services/workspace";
import { DashboardShell } from "@/components/shell/dashboard-shell";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
};

export default async function WorkspaceLayout({
  children,
  params,
}: LayoutProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { workspaceSlug } = await params;
  const [workspace, workspaces] = await Promise.all([
    getWorkspaceForUser(workspaceSlug, session.user.id),
    getUserWorkspaces(session.user.id),
  ]);

  if (!workspace) {
    notFound();
  }

  if (workspace.brands.length === 0) {
    redirect(`/onboarding/business?workspace=${workspace.slug}`);
  }

  const primaryBrand = workspace.brands[0];
  const [inbox, knowledge, content, media] = await Promise.all([
    prisma.conversation.count({
      where: { brandId: primaryBrand.id, isUnread: true },
    }),
    prisma.knowledgeDocument.count({ where: { brandId: primaryBrand.id } }),
    prisma.contentItem.count({ where: { brandId: primaryBrand.id } }),
    prisma.mediaAsset.count({ where: { brandId: primaryBrand.id } }),
  ]);

  const shellWorkspaces = workspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    brands: ws.brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
    })),
  }));

  const shellWorkspace = {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    brands: workspace.brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
    })),
  };

  return (
    <DashboardShell
      workspace={shellWorkspace}
      workspaces={shellWorkspaces}
      brandSlug={primaryBrand.slug}
      badges={{ inbox, knowledge, content, media }}
    >
      {children}
    </DashboardShell>
  );
}
