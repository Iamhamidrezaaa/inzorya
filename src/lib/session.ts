import { auth } from "@/lib/auth";
import { getUserWorkspaces } from "@/server/services/workspace";

/** Session is usable only with a user id and at least one workspace. */
export async function hasActiveWorkspaceSession() {
  const session = await auth();
  if (!session?.user?.id) return false;
  const workspaces = await getUserWorkspaces(session.user.id);
  return workspaces.length > 0;
}
