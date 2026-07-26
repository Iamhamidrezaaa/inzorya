"use client";

import { useI18n } from "@/i18n/client";

/** Pair EN/FA UI chrome. Prefer dictionary keys long-term. */
export function useT() {
  const { locale } = useI18n();
  const t = (en: string, fa: string) => (locale === "fa" ? fa : en);
  return Object.assign(t, { locale }) as ((en: string, fa: string) => string) & {
    locale: string;
  };
}
