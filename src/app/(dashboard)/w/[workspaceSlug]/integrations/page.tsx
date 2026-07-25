import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWorkspaceForUser } from "@/server/services/workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function IntegrationsRedirect({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace?.brands[0]) {
    redirect(`/onboarding/business?workspace=${workspaceSlug}`);
  }
  redirect(`/w/${workspaceSlug}/b/${workspace.brands[0].slug}/channels`);
}
