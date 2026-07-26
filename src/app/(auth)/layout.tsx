import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="surface-ambient relative flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="absolute end-4 top-4 z-20 md:end-8 md:top-6">
        <LanguageSwitcher variant="outline" size="sm" />
      </div>
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
