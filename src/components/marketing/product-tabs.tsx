"use client";

import { useState } from "react";
import { landingCopy } from "@/components/marketing/copy";
import { cn } from "@/lib/utils";

type TabId = (typeof landingCopy.products.tabs)[number]["id"];

export function ProductTabs() {
  const { products } = landingCopy;
  const [active, setActive] = useState<TabId>(products.tabs[0].id);
  const tab = products.tabs.find((t) => t.id === active) ?? products.tabs[0];

  return (
    <section
      id="product"
      className="relative overflow-hidden bg-[var(--mkt-purple)] py-20 text-white md:py-28"
    >
      <div className="pointer-events-none absolute inset-0 marketing-topo marketing-topo-on-dark opacity-40" />
      <div className="relative mx-auto max-w-[1200px] px-5 lg:px-8">
        <div className="max-w-xl">
          <h2 className="text-4xl font-black tracking-[-0.04em] md:text-5xl">
            {products.title}
          </h2>
          <p className="mt-3 text-lg text-white/80">{products.subtitle}</p>
        </div>

        <div
          role="tablist"
          className="mt-10 flex flex-wrap gap-2"
        >
          {products.tabs.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.id)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  on
                    ? "bg-[var(--mkt-cream)] text-black"
                    : "bg-white/10 text-white hover:bg-white/15",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="marketing-poly-frame relative min-h-[280px] overflow-hidden bg-black/25 p-6 md:min-h-[360px]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Live preview
            </p>
            <p className="relative mt-6 text-2xl font-bold tracking-tight md:text-3xl">
              {tab.title}
            </p>
            <div className="relative mt-8 space-y-3">
              {[72, 54, 88, 61].map((w, i) => (
                <div
                  key={i}
                  className="h-3 rounded-full bg-white/15"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
            <div className="relative mt-10 grid grid-cols-3 gap-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="aspect-[4/5] rounded-xl border border-white/15 bg-white/10"
                />
              ))}
            </div>
          </div>

          <article className="rounded-2xl bg-[var(--mkt-cream)] p-7 text-black md:p-9">
            <h3 className="text-2xl font-black tracking-tight md:text-3xl">
              {tab.title}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-black/70">
              {tab.body}
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {tab.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm font-medium">
                  <span className="mt-1 inline-block size-2 shrink-0 rounded-full bg-[var(--mkt-purple)]" />
                  {b}
                </li>
              ))}
            </ul>
            <a
              href="/register"
              className="mt-8 inline-flex items-center gap-1 border-b border-[var(--mkt-orange)] pb-0.5 text-sm font-semibold text-[var(--mkt-orange)]"
            >
              Learn more →
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
