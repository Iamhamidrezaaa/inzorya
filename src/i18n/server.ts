import { cookies } from "next/headers";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "./config";
import { getDictionary, type Dictionary } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getI18n(): Promise<{
  locale: Locale;
  dictionary: Dictionary;
  dir: "ltr" | "rtl";
}> {
  const locale = await getLocale();
  return {
    locale,
    dictionary: getDictionary(locale),
    dir: locale === "fa" ? "rtl" : "ltr",
  };
}
