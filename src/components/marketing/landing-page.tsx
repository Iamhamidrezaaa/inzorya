"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "@/components/providers/theme-provider";
import { landingCopy } from "@/components/marketing/copy";
import { NotchButton } from "@/components/marketing/notch-button";
import { ProductTabs } from "@/components/marketing/product-tabs";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { cn } from "@/lib/utils";

type Props = {
  loggedIn: boolean;
  dashboardLabel: string;
};

export function LandingPage({ loggedIn, dashboardLabel }: Props) {
  const c = landingCopy;
  const primaryHref = loggedIn ? "/dashboard" : "/register";
  const [workIdx, setWorkIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const work = c.work.items[workIdx];
  const { setTheme } = useTheme();

  useEffect(() => {
    const id = window.setInterval(() => {
      setWordIdx((i) => (i + 1) % c.platformLine.words.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [c.platformLine.words.length]);

  useEffect(() => {
    setTheme("light");
    document.documentElement.classList.add("marketing-light");
    return () => {
      document.documentElement.classList.remove("marketing-light");
    };
  }, [setTheme]);

  return (
    <div className="marketing-site text-black">
      <MarketingHeader loggedIn={loggedIn} dashboardLabel={dashboardLabel} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 marketing-topo opacity-70" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-8 lg:py-24">
          <div>
            <h1 className="max-w-[14ch] text-[clamp(2.6rem,6vw,4.75rem)] font-black leading-[0.98] tracking-[-0.045em] text-black">
              {c.hero.headline}
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-black/75 md:text-lg">
              {c.hero.subhead}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <NotchButton href={primaryHref} variant="primary" size="lg">
                {loggedIn ? dashboardLabel : c.hero.ctaPrimary}
              </NotchButton>
              <NotchButton href="#product" variant="secondary" size="lg">
                {c.hero.ctaSecondary}
              </NotchButton>
            </div>
          </div>

          <div className="marketing-poly-frame relative aspect-[5/6] overflow-hidden bg-[#1a1224] md:aspect-[4/5]">
            <Image
              src="/marketing/hero-portrait.png"
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 90vw, 520px"
              className="object-cover object-top"
            />
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="border-y border-black/5 bg-[var(--mkt-cream)] py-12">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-black/45">
            {c.trusted.title}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {c.trusted.logos.map((logo) => (
              <span
                key={logo}
                className="text-lg font-black tracking-tight text-black/25 md:text-xl"
              >
                {logo}
              </span>
            ))}
          </div>
        </div>
      </section>

      <ProductTabs />

      {/* PLATFORM LINE */}
      <section id="platform" className="bg-[var(--mkt-cream)] py-24 md:py-32">
        <div className="mx-auto max-w-[1000px] px-5 text-center lg:px-8">
          <h2 className="text-[clamp(2rem,5vw,3.75rem)] font-black leading-[1.05] tracking-[-0.04em]">
            {c.platformLine.prefix}{" "}
            <span
              key={wordIdx}
              className="inline-block text-[var(--mkt-purple)] animate-in fade-in slide-in-from-bottom-1 duration-500"
            >
              {c.platformLine.words[wordIdx]}
            </span>{" "}
            {c.platformLine.suffix}
          </h2>
        </div>
      </section>

      {/* STATS + AI */}
      <section
        id="intelligence"
        className="relative overflow-hidden bg-gradient-to-b from-[#7B3FE4] via-[#D43B8C] to-[var(--mkt-orange)] py-20 text-white md:py-28"
      >
        <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            {c.stats.title}
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {c.stats.items.map((s) => (
              <div key={s.label}>
                <p className="text-4xl font-black tracking-tight md:text-5xl">
                  {s.value}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid items-center gap-8 rounded-3xl bg-black/20 p-8 backdrop-blur-sm lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
            <div>
              <h3 className="text-3xl font-black tracking-tight md:text-4xl">
                {c.ai.title}
              </h3>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85">
                {c.ai.body}
              </p>
              <a
                href="#product"
                className="mt-6 inline-flex border-b border-white/80 pb-0.5 text-sm font-semibold"
              >
                {c.ai.cta} →
              </a>
            </div>
            <div className="marketing-poly-frame aspect-[5/4] bg-white/10 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Context graph
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium">
                {[
                  "Industry",
                  "Audience",
                  "Product",
                  "Season",
                  "Goal",
                  "Tone",
                  "Event",
                  "Channel",
                ].map((n) => (
                  <div
                    key={n}
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-2"
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PIPELINE */}
      <section className="bg-[var(--mkt-cream)] py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">
              {c.pipeline.title}
            </h2>
            <p className="mt-4 text-base text-black/70 md:text-lg">
              {c.pipeline.body}
            </p>
          </div>
          <ol className="mt-12 grid gap-4 md:grid-cols-4">
            {c.pipeline.steps.map((step, i) => (
              <li
                key={step.title}
                className="rounded-2xl border border-black/8 bg-white p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40">
                  0{i + 1}
                </p>
                <p className="mt-3 text-xl font-bold tracking-tight">
                  {step.title}
                </p>
                <p className="mt-2 text-sm text-black/65">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* WORK / OUTCOMES */}
      <section className="border-t border-black/5 bg-[var(--mkt-cream)] pb-20">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">
            {c.work.title}
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {c.work.items.map((item, i) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setWorkIdx(i)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  i === workIdx
                    ? "bg-black text-white"
                    : "bg-black/5 text-black hover:bg-black/10",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="mt-8 grid gap-8 rounded-3xl border border-black/8 bg-white p-8 lg:grid-cols-[1.4fr_0.6fr] lg:p-10">
            <div>
              <p className="text-xl leading-relaxed md:text-2xl md:leading-snug">
                “{work.quote}”
              </p>
              <p className="mt-6 text-sm font-medium text-black/55">{work.role}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {work.metrics.map((m) => (
                <div key={m.label} className="rounded-xl bg-black/[0.03] p-4">
                  <p className="text-3xl font-black tracking-tight">{m.value}</p>
                  <p className="mt-1 text-sm text-black/60">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* RESOURCES */}
      <section id="resources" className="bg-black py-20 text-white md:py-24">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">
            {c.resources.title}
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {c.resources.cards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/8"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                  {card.kind}
                </p>
                <h3 className="mt-3 text-lg font-bold leading-snug">{card.title}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="relative overflow-hidden bg-[var(--mkt-cream)] py-24 md:py-32">
        <div className="pointer-events-none absolute inset-0 marketing-topo opacity-50" />
        <div className="relative mx-auto max-w-[900px] px-5 text-center lg:px-8">
          <h2 className="text-[clamp(2.2rem,5.5vw,4.25rem)] font-black leading-[1.02] tracking-[-0.045em]">
            {c.closing.title}
          </h2>
          <div className="mt-10 flex justify-center">
            <NotchButton href={primaryHref} variant="primary" size="lg">
              {loggedIn ? dashboardLabel : c.closing.cta}
            </NotchButton>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/10 bg-[var(--mkt-cream)] pb-10 pt-14">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {c.footer.columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-bold">{col.title}</p>
              <ul className="mt-4 space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <span className="text-sm text-black/55">{link}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-12 max-w-[1200px] px-5 text-xs text-black/45 lg:px-8">
          {c.footer.rights}
        </p>
      </footer>
    </div>
  );
}
