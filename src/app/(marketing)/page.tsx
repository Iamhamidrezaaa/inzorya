import { hasActiveWorkspaceSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function MarketingHomePage() {
  const loggedIn = await hasActiveWorkspaceSession();
  const { dictionary } = await getI18n();

  return (
    <LandingPage
      loggedIn={loggedIn}
      dashboardLabel={dictionary.marketing.ctaDashboard}
    />
  );
}
