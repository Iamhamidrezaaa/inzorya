export const locales = ["en", "fa"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "inzorya_locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "fa";
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return locale === "fa" ? "rtl" : "ltr";
}
