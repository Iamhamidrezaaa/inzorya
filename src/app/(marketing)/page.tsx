import Link from "next/link";
import { hasActiveWorkspaceSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const loggedIn = await hasActiveWorkspaceSession();
  const { dictionary: d } = await getI18n();
  const ctaHref = loggedIn ? "/dashboard" : "/register";
  const ctaLabel = loggedIn ? d.marketing.ctaDashboard : d.marketing.ctaStart;

  const features = [
    {
      title: d.marketing.feature1Title,
      body: d.marketing.feature1Body,
    },
    {
      title: d.marketing.feature2Title,
      body: d.marketing.feature2Body,
    },
    {
      title: d.marketing.feature3Title,
      body: d.marketing.feature3Body,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-6 pb-28 pt-20 md:pt-28">
      <section className="max-w-2xl">
        <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {d.marketing.eyebrow}
        </p>
        <h1 className="text-5xl font-semibold tracking-[-0.04em] text-foreground md:text-6xl md:leading-[1.05]">
          {d.marketing.headline}
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
          {d.marketing.subhead}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
          {!loggedIn ? (
            <Button asChild size="lg" variant="ghost">
              <Link href="/login">{d.common.login}</Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="mt-28 grid gap-10 border-t border-border/70 pt-14 md:grid-cols-3 md:gap-8">
        {features.map((feature) => (
          <div key={feature.title} className="space-y-3">
            <h2 className="text-[15px] font-medium tracking-tight text-foreground">
              {feature.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {feature.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-28 rounded-2xl border border-border/80 bg-card/40 px-8 py-14 md:px-12">
        <h2 className="max-w-md text-2xl font-semibold tracking-tight md:text-3xl">
          {d.marketing.readyTitle}
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {d.marketing.readyBody}
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href={ctaHref}>
              {loggedIn
                ? d.marketing.ctaGoDashboard
                : d.marketing.ctaCreate}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
