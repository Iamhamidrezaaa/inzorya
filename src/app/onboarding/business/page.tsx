import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getUserWorkspaces,
  getWorkspaceForUser,
} from "@/server/services/workspace";
import { BusinessOnboardingWizard } from "@/components/onboarding/business-onboarding-wizard";

type PageProps = {
  searchParams: Promise<{ workspace?: string }>;
};

export default async function BusinessOnboardingPage({
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const workspaces = await getUserWorkspaces(session.user.id);
  const workspaceSlug = params.workspace || workspaces[0]?.slug;
  if (!workspaceSlug) redirect("/register");

  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) redirect("/dashboard");

  const brand = workspace.brands[0];
  const profile = brand
    ? await prisma.businessProfile.findUnique({ where: { brandId: brand.id } })
    : null;

  if (profile?.onboardingCompletedAt) {
    redirect(`/w/${workspace.slug}/home`);
  }

  return (
    <div className="relative min-h-svh bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.05_195_/_0.28),transparent_55%)]"
      />
      <div className="relative z-10 mx-auto mb-8 max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
          Business brain
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Teach Inzorya who you are
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Answer once. Resume anytime. This profile powers future AI planning —
          no AI runs in this sprint.
        </p>
      </div>
      <div className="relative z-10">
        <BusinessOnboardingWizard
          workspaceSlug={workspace.slug}
          initialBrandSlug={brand?.slug}
          initialStep={profile?.onboardingStep ?? 0}
          initialForm={
            brand || profile
              ? {
                  name: brand?.name ?? "",
                  businessSummary: profile?.businessSummary ?? "",
                  industry: profile?.industry ?? brand?.industry ?? "",
                  website: profile?.website ?? brand?.website ?? "",
                  country: profile?.country ?? "",
                  languages: profile?.languages?.join(", ") ?? "",
                  businessGoals: profile?.businessGoals ?? "",
                  mainProducts: profile?.mainProducts ?? "",
                  targetAudience: profile?.targetAudience ?? "",
                  competitors: profile?.competitors ?? "",
                  brandPersonality: profile?.brandPersonality ?? "",
                  preferredTone: profile?.preferredTone ?? "",
                  contentStyle: profile?.contentStyle ?? "",
                  mainCta: profile?.mainCta ?? "",
                  postingFrequency: profile?.postingFrequency ?? "",
                  preferredPlatforms:
                    profile?.preferredPlatforms?.join(", ") ?? "",
                  marketingChallenges: profile?.marketingChallenges ?? "",
                  monthlyBudget: profile?.monthlyBudget ?? "",
                  teamSize: profile?.teamSize ?? "",
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
