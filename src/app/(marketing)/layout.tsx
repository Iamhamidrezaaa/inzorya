import Link from "next/link";
import { hasActiveWorkspaceSession } from "@/lib/session";
import { Button } from "@/components/ui/button";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loggedIn = await hasActiveWorkspaceSession();

  return (
    <div className="surface-ambient relative min-h-svh overflow-hidden">
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          Inzorya
        </Link>
        <nav className="flex items-center gap-1.5">
          {loggedIn ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>
      <main className="relative z-10">{children}</main>
    </div>
  );
}
