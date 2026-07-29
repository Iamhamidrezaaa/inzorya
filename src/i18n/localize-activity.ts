import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

function toLocaleDigits(value: string, locale: Locale) {
  if (locale !== "fa") return value;
  return value.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}

/**
 * Activity titles are stored as English (or mixed) strings at write time.
 * Re-localize known templates for the current UI locale at display time.
 */
export function localizeActivityTitle(
  title: string,
  locale: Locale,
  templates: Dictionary["activityTitles"],
): string {
  const t = title.trim();

  const aiEn = /^AI content generated:\s*(.+)$/i.exec(t);
  const aiFa = /^محتوای (?:هوش مصنوعی|AI) تولید شد:\s*(.+)$/i.exec(t);
  if (aiEn || aiFa) {
    const name = (aiEn?.[1] ?? aiFa?.[1] ?? "").trim();
    return fill(templates.aiContentGenerated, { title: name });
  }

  const oppEn =
    /^Opportunity scan complete\s*[·•\-–]\s*(\d+)\s*matched$/i.exec(t);
  const oppFa =
    /^اسکن فرصت کامل شد\s*[·•\-–]\s*([۰-۹0-9]+)\s*مورد منطبق$/i.exec(t);
  if (oppEn || oppFa) {
    const raw = (oppEn?.[1] ?? oppFa?.[1] ?? "0").replace(
      /[۰-۹]/g,
      (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
    );
    const count = toLocaleDigits(raw, locale);
    return fill(templates.opportunityScanComplete, { count });
  }

  const planEn = /^Content plan generated:\s*(.+)$/i.exec(t);
  const planFa = /^برنامه محتوا تولید شد:\s*(.+)$/i.exec(t);
  if (planEn || planFa) {
    const name = (planEn?.[1] ?? planFa?.[1] ?? "").trim();
    return fill(templates.contentPlanGenerated, { title: name });
  }

  const inboxEn =
    /^Community inbox scanned\s*[·•\-–]\s*(\d+)\s*threads$/i.exec(t);
  const inboxFa =
    /^اینباکس جامعه اسکن شد\s*[·•\-–]\s*([۰-۹0-9]+)\s*گفتگو$/i.exec(t);
  if (inboxEn || inboxFa) {
    const raw = (inboxEn?.[1] ?? inboxFa?.[1] ?? "0").replace(
      /[۰-۹]/g,
      (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
    );
    const count = toLocaleDigits(raw, locale);
    return fill(templates.communityInboxScanned, { count });
  }

  const studioEn = /^Pushed AI content to Studio:\s*(.+)$/i.exec(t);
  const studioFa = /^محتوای AI به استودیو ارسال شد:\s*(.+)$/i.exec(t);
  if (studioEn || studioFa) {
    const name = (studioEn?.[1] ?? studioFa?.[1] ?? "").trim();
    return fill(templates.pushedToStudio, { title: name });
  }

  return title;
}
