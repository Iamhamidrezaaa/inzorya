"use client";

import { useI18n } from "@/i18n/client";
import { getPageCopy, type PageCopyKey } from "@/i18n/page-copy";

export function usePageCopy(key: PageCopyKey) {
  const { locale } = useI18n();
  return getPageCopy(locale, key);
}
