import Link from "next/link";
import { hasActiveWorkspaceSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const loggedIn = await hasActiveWorkspaceSession();
  const { dictionary: d } = await getI18n();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {d.notFound.title}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {loggedIn ? d.notFound.bodyLoggedIn : d.notFound.bodyGuest}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {loggedIn ? (
          <Button asChild size="sm">
            <Link href="/dashboard">{d.common.dashboard}</Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href="/login">{d.common.login}</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="ghost">
          <Link href="/">{d.common.backHome}</Link>
        </Button>
      </div>
    </div>
  );
}
