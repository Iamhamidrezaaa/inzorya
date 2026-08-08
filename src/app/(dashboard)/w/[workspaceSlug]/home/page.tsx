import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkspaceForUser } from "@/server/services/workspace";
import {
  ensureBusinessBrain,
  ensureStrategyForBrain,
  completionFromBrain,
} from "@/server/services/business-brain";
import { getI18n } from "@/i18n/server";
import { localizeEventishTitle } from "@/i18n/display-labels";
import { HomeWorkspace } from "@/components/home/home-workspace";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function HomePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { workspaceSlug } = await params;
  const { locale, dictionary: d } = await getI18n();

  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) redirect("/dashboard");

  const brand = workspace.brands[0];
  if (!brand) {
    redirect(`/onboarding/business?workspace=${workspaceSlug}`);
  }

  const brandBase = `/w/${workspaceSlug}/b/${brand.slug}`;
  const brain = await ensureBusinessBrain(brand.id);
  const strategy = await ensureStrategyForBrain(brand.id);
  const brainCompletion = completionFromBrain({
    answers: brain.answers,
    voice: brain.voice,
    assetsCount: brain.assets.length,
    competitorsCount: strategy.competitors.length,
    pillarsCount: strategy.pillars.length,
  });

  const now = new Date();
  const inTwoWeeks = new Date(Date.now() + 14 * 86400000);

  const [planItems, upcomingOpps] = await Promise.all([
    prisma.contentPlanItem.findMany({
      where: {
        plan: { brandId: brand.id },
        suggestedDate: { gte: now },
      },
      take: 50,
      select: { contentType: true },
    }),
    prisma.businessOpportunity.findMany({
      where: {
        brandId: brand.id,
        eventDate: { gte: now, lte: inTwoWeeks },
      },
      orderBy: { eventDate: "asc" },
      take: 5,
      select: { id: true, title: true },
    }),
  ]);

  const typeOf = (t: string) => t.toLowerCase();
  let posts = planItems.filter((i) => {
    const t = typeOf(i.contentType);
    return t.includes("post") || t.includes("feed") || t.includes("carousel");
  }).length;
  let stories = planItems.filter((i) =>
    typeOf(i.contentType).includes("story"),
  ).length;
  let reels = planItems.filter((i) =>
    /reel|video|short/.test(typeOf(i.contentType)),
  ).length;
  if (planItems.length > 0 && posts + stories + reels === 0) {
    posts = planItems.length;
  }

  const recommendations = upcomingOpps.slice(0, 3).map((o) => ({
    id: o.id,
    title: localizeEventishTitle(locale, o.title),
    href: `${brandBase}/opportunities`,
  }));

  const opportunities = upcomingOpps.map((o) => ({
    id: o.id,
    title: localizeEventishTitle(locale, o.title),
    href: `${brandBase}/opportunities`,
  }));

  const firstName =
    session.user.name?.split(" ")[0] || d.home.welcomeGuest;

  const health = {
    brand: Math.min(100, Math.round(brainCompletion.completionPercent || 0)),
    publishing: Math.min(
      100,
      planItems.length > 0 ? 70 + Math.min(30, planItems.length * 3) : 40,
    ),
    diversity: Math.min(
      100,
      50 +
        (posts > 0 ? 15 : 0) +
        (stories > 0 ? 15 : 0) +
        (reels > 0 ? 15 : 0) +
        (strategy.pillars.length > 0 ? 5 : 0),
    ),
  };

  return (
    <HomeWorkspace
      firstName={firstName}
      brandBase={brandBase}
      recommendations={recommendations}
      opportunities={opportunities}
      upcoming={{
        posts,
        stories,
        reels,
        planHref: `${brandBase}/planner`,
      }}
      health={health}
    />
  );
}
