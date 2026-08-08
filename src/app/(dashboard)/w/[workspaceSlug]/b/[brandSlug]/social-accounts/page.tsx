import { Suspense } from "react";
import { SocialAccountsView } from "@/components/social/social-accounts-view";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function SocialAccountsPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <SocialAccountsView workspaceSlug={workspaceSlug} brandSlug={brandSlug} />
    </Suspense>
  );
}
