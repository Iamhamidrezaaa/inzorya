import Link from "next/link";
import { hasActiveWorkspaceSession } from "@/lib/session";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const loggedIn = await hasActiveWorkspaceSession();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        That route is not available
        {loggedIn ? " in this workspace." : ". Sign in to open your dashboard."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {loggedIn ? (
          <Button asChild size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href="/login">Log in</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="ghost">
          <Link href="/">Back to Inzorya</Link>
        </Button>
      </div>
    </div>
  );
}
