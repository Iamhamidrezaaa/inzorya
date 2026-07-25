import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWorkspaceForUser } from "@/server/services/workspace";
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function WorkspaceSettingsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) redirect("/dashboard");

  return (
    <WorkspaceSettingsForm
      workspaceSlug={workspace.slug}
      initialName={workspace.name}
    />
  );
}
