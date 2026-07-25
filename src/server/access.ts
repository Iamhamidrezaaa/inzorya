import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

export async function requireBrandAccess(
  workspaceSlug: string,
  brandSlug: string,
  userId: string,
) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: workspaceSlug,
      members: { some: { userId } },
    },
  });
  if (!workspace) return null;

  const brand = await prisma.brand.findFirst({
    where: {
      workspaceId: workspace.id,
      slug: brandSlug,
      archivedAt: null,
    },
  });
  if (!brand) return null;

  return { workspace, brand };
}
