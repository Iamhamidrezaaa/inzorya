import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspaceForUser } from "@/server/services/workspace";
import { SettingsHub } from "@/components/settings/settings-hub";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function SettingsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { workspaceSlug } = await params;
  const [user, workspace] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    }),
    getWorkspaceForUser(workspaceSlug, session.user.id),
  ]);

  if (!user || !workspace?.brands[0]) redirect("/dashboard");

  return (
    <SettingsHub
      initialName={user.name ?? ""}
      initialEmail={user.email}
      brandSlug={workspace.brands[0].slug}
    />
  );
}
