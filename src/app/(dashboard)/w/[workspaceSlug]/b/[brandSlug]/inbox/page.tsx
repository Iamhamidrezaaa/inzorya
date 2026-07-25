import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { InboxView } from "@/components/inbox/inbox-view";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function InboxPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { workspaceSlug, brandSlug } = await params;

  return (
    <InboxView
      workspaceSlug={workspaceSlug}
      brandSlug={brandSlug}
      currentUserId={session.user.id}
    />
  );
}
