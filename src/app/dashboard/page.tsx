import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserWorkspaces } from "@/server/services/workspace";

export default async function DashboardEntryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces(session.user.id);
  const workspace = workspaces[0];

  if (!workspace) {
    redirect("/register");
  }

  if (workspace.brands.length === 0) {
    redirect(`/onboarding/brand?workspace=${workspace.slug}`);
  }

  redirect(`/w/${workspace.slug}/home`);
}
