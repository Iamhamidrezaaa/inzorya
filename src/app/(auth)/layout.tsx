import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.05_195_/_0.28),transparent_50%)]"
      />
      <div className="relative z-10 mb-8">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Inzorya
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
