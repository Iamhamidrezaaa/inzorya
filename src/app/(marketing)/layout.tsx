import Link from "next/link";
import { hasActiveWorkspaceSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loggedIn = await hasActiveWorkspaceSession();
  const { dictionary } = await getI18n();

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
          <LanguageSwitcher variant="ghost" size="sm" />
          {loggedIn ? (
            <Button asChild size="sm">
              <Link href="/dashboard">{dictionary.common.dashboard}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{dictionary.common.login}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{dictionary.common.register}</Link>
              </Button>
            </>
          )}
        </nav>
      </header>
      <main className="relative z-10">{children}</main>
    </div>
  );
}
