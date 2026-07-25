import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Workspace-first",
    body: "Operate multiple brands from one tenant boundary with clear permissions.",
  },
  {
    title: "Knowledge as infrastructure",
    body: "Brand facts, sources, and guidelines live where campaigns and agents can use them.",
  },
  {
    title: "AI-ready shell",
    body: "Agents and automations plug into a calm operating system — not a post scheduler.",
  },
];

export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 pb-24 pt-16 md:pt-24">
      <section className="max-w-3xl">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-primary">
          AI Marketing Operating System
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Inzorya
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          Run brand, knowledge, campaigns, content, and automations from one
          premium workspace. Built like Linear and Vercel — not like a social
          calendar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {session?.user ? (
            <Button asChild size="lg">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/register">Start free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="mt-24 grid gap-8 border-t border-border pt-12 md:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title}>
            <h2 className="text-sm font-semibold text-foreground">
              {feature.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-24 rounded-2xl border border-border bg-card/50 px-8 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ready when your team is.
        </h2>
        <p className="mt-3 max-w-lg text-sm text-muted-foreground">
          Create a workspace, add your first brand, and enter the operating
          system.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href={session?.user ? "/dashboard" : "/register"}>
              {session?.user ? "Go to dashboard" : "Create account"}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
