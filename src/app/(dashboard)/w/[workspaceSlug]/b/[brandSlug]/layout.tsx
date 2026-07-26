import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getBrandForWorkspace,
  getWorkspaceForUser,
} from "@/server/services/workspace";

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
}) {
  const session = await auth();
  const { workspaceSlug, brandSlug } = await params;
  if (!session?.user?.id) redirect("/login");

  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) redirect("/dashboard");

  const brand = await getBrandForWorkspace(workspace.id, brandSlug);
  if (!brand) notFound();

  return children;
}
