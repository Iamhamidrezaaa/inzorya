"use client";

import { useI18n } from "@/i18n/client";

/** Pair EN/FA UI chrome. Prefer dictionary keys long-term. */
export function useT() {
  const { locale } = useI18n();
  return (en: string, fa: string) => (locale === "fa" ? fa : en);
}
