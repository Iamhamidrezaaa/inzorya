"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  pending: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const dir: "ltr" | "rtl" = locale === "fa" ? "rtl" : "ltr";

  const setLocale = useCallback(
    (next: Locale) => {
      startTransition(() => {
        void (async () => {
          await fetch("/api/locale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: next }),
          });
          router.refresh();
        })();
      });
    },
    [router],
  );

  const value = useMemo(
    () => ({ locale, dictionary, dir, setLocale, pending }),
    [locale, dictionary, dir, setLocale, pending],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return ctx;
}

/** Safe for chrome that may remount outside providers during error recovery. */
export function useOptionalI18n() {
  return useContext(I18nContext);
}
