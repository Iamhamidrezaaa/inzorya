import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Inbox that feels calm",
    body: "Every conversation in one place — clear, focused, ready for reply.",
  },
  {
    title: "Business brain first",
    body: "Capture who you are so every channel and message stays on-brand.",
  },
  {
    title: "Channels, not clutter",
    body: "Connect Instagram, WhatsApp, and more without drowning in tools.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  const ctaHref = session?.user ? "/dashboard" : "/register";
  const ctaLabel = session?.user ? "Open dashboard" : "Start free";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-6 pb-28 pt-20 md:pt-28">
      <section className="max-w-2xl">
        <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Conversation operating system
        </p>
        <h1 className="text-5xl font-semibold tracking-[-0.04em] text-foreground md:text-6xl md:leading-[1.05]">
          Inzorya
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
          The calm workspace for customer conversations, brand knowledge, and
          channels — built like a serious product team would ship it.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
          {!session?.user ? (
            <Button asChild size="lg" variant="ghost">
              <Link href="/login">Log in</Link>
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
          Ready when your team is.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Create a workspace. Add your brand. Start answering with clarity.
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href={ctaHref}>
              {session?.user ? "Go to dashboard" : "Create account"}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
