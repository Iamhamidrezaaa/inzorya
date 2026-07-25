import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="surface-ambient relative flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="relative z-10 mb-10">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          Inzorya
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-[400px]">{children}</div>
    </div>
  );
}
