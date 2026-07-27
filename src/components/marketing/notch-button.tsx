import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "dark";
  className?: string;
  size?: "md" | "lg";
};

export function NotchButton({
  href,
  children,
  variant = "primary",
  className,
  size = "md",
}: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "marketing-notch inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition",
        size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-sm",
        variant === "primary" &&
          "bg-[var(--mkt-orange)] text-white shadow-[0_8px_24px_rgba(255,75,18,0.28)] hover:brightness-105",
        variant === "secondary" &&
          "border border-black/90 bg-white text-black hover:bg-black/[0.03]",
        variant === "dark" && "bg-black text-white hover:bg-black/90",
        className,
      )}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}
