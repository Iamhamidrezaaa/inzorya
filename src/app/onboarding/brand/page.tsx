import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserWorkspaces, getWorkspaceForUser } from "@/server/services/workspace";
import { BrandOnboardingForm } from "@/components/onboarding/brand-onboarding-form";

type PageProps = {
  searchParams: Promise<{ workspace?: string }>;
};

export default async function BrandOnboardingPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const workspaces = await getUserWorkspaces(session.user.id);
  const workspaceSlug = params.workspace || workspaces[0]?.slug;

  if (!workspaceSlug) {
    redirect("/register");
  }

  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) {
    redirect("/dashboard");
  }

  if (workspace.brands.length > 0) {
    redirect(`/w/${workspace.slug}/home`);
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.05_195_/_0.3),transparent_55%)]"
      />
      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
            Onboarding
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Create your first brand
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Brands are the operating context inside{" "}
            <span className="text-foreground">{workspace.name}</span>. Knowledge,
            campaigns, and content all hang off this identity.
          </p>
        </div>
        <BrandOnboardingForm workspaceSlug={workspace.slug} />
      </div>
    </div>
  );
}
