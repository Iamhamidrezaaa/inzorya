import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        That route is not available in this workspace.
      </p>
      <Link href="/" className="text-sm text-primary hover:underline">
        Back to Inzorya
      </Link>
    </div>
  );
}
