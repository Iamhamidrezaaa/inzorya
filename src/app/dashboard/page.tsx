import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { getUserWorkspaces } from "@/server/services/workspace";

export default async function DashboardEntryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces(session.user.id);
  const workspace = workspaces[0];

  // Stale cookie after DB reset / expired membership — clear session, show login
  if (!workspace) {
    return signOut({ redirectTo: "/login" });
  }

  if (workspace.brands.length === 0) {
    redirect(`/onboarding/business?workspace=${workspace.slug}`);
  }

  redirect(`/w/${workspace.slug}/home`);
}
