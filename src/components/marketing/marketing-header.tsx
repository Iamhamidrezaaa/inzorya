"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { NotchButton } from "@/components/marketing/notch-button";
import { InzoryaWordmark } from "@/components/marketing/inzorya-wordmark";
import { landingCopy } from "@/components/marketing/copy";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

type Props = {
  loggedIn: boolean;
  dashboardLabel: string;
};

export function MarketingHeader({ loggedIn, dashboardLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const ctaHref = loggedIn ? "/dashboard" : "/register";
  const ctaLabel = loggedIn ? dashboardLabel : landingCopy.getInzorya;

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 border-b border-black/5 bg-[#e8e6e1]/78 backdrop-blur-md transition-opacity duration-300 ease-out",
          scrolled ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="relative mx-auto grid max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5 sm:px-6 lg:px-8">
        <div className="justify-self-start">
          <Link href="/" className="inline-flex items-center" aria-label="Inzorya">
            <InzoryaWordmark />
          </Link>
        </div>

        <nav className="hidden items-center rounded-[1.15rem] bg-white px-2 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] lg:flex">
          {landingCopy.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-xl px-3.5 py-2.5 text-[15px] font-medium text-black/85 transition hover:bg-black/[0.04] hover:text-black"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <LanguageSwitcher
            variant="ghost"
            size="sm"
            className="text-black hover:bg-black/5 hover:text-black"
          />
          {!loggedIn ? (
            <Link
              href="/login"
              className="hidden text-[15px] font-medium text-black/80 hover:text-black sm:inline"
            >
              {landingCopy.signIn}
            </Link>
          ) : null}
          <NotchButton
            href={ctaHref}
            variant="dark"
            className="hidden sm:inline-flex"
          >
            {ctaLabel}
          </NotchButton>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl border border-black/10 bg-white lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? (
              <X className="size-5 text-black" />
            ) : (
              <Menu className="size-5 text-black" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div className="relative border-t border-black/5 bg-[#e8e6e1]/90 px-4 py-4 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-1">
            {landingCopy.nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-black"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <NotchButton href={ctaHref} variant="dark" className="mt-2 w-full">
              {ctaLabel}
            </NotchButton>
          </div>
        </div>
      ) : null}
    </header>
  );
}
