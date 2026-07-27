/** Display-time FA labels for catalog / enum values (UI chrome). */

export function faLabel(
  locale: string,
  en: string,
  map: Record<string, string>,
): string {
  if (locale !== "fa") return en;
  return map[en] ?? map[en.replaceAll(" ", "_")] ?? map[en.toUpperCase()] ?? en;
}

export const IMPORTANCE_FA: Record<string, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "بالا",
  CRITICAL: "بحرانی",
};

export const VERIFICATION_FA: Record<string, string> = {
  OFFICIAL: "رسمی",
  VERIFIED: "تأییدشده",
  COMMUNITY_VERIFIED: "تأیید جامعه",
  DRAFT: "پیش‌نویس",
  ARCHIVED: "بایگانی",
};

export const RECURRENCE_FA: Record<string, string> = {
  ONE_TIME: "یک‌بار",
  ANNUAL: "سالانه",
  MONTHLY: "ماهانه",
  WEEKLY: "هفتگی",
  CUSTOM: "سفارشی",
};

export const TIME_FILTER_FA: Record<string, string> = {
  upcoming: "پیش‌رو",
  today: "امروز",
  this_week: "این هفته",
  this_month: "این ماه",
  this_quarter: "این فصل",
  past: "گذشته",
};

export const EVENT_STATUS_FA: Record<string, string> = {
  ACTIVE: "فعال",
  DRAFT: "پیش‌نویس",
  ARCHIVED: "بایگانی",
};

export const NODE_KIND_FA: Record<string, string> = {
  INDUSTRY: "صنعت",
  BUSINESS_TYPE: "نوع کسب‌وکار",
  PRODUCT_CATEGORY: "محصول / خدمت",
  AUDIENCE: "مخاطب",
  CAMPAIGN_TYPE: "نوع کمپین",
  OBJECTIVE: "هدف",
  CONTENT_TYPE: "نوع محتوا",
  CHANNEL: "کانال",
  CTA: "دعوت به اقدام",
  EMOTIONAL_TONE: "لحن احساسی",
  SEASON: "فصل",
  CUSTOM: "سفارشی",
};

export const INDUSTRY_NAME_FA: Record<string, string> = {
  Restaurant: "رستوران",
  Cafe: "کافه",
  "Coffee Shop": "کافی‌شاپ",
  Bakery: "نانوایی",
  "Beauty Clinic": "کلینیک زیبایی",
  "Dental Clinic": "کلینیک دندان‌پزشکی",
  Clinic: "کلینیک",
  Salon: "سالن",
  Spa: "اسپا",
  Gym: "باشگاه",
  Hotel: "هتل",
  Automotive: "خودرو",
  "Real Estate": "املاک",
  Construction: "ساخت‌وساز",
  "E-commerce": "فروشگاه اینترنتی",
  Retail: "خرده‌فروشی",
  Fashion: "مد",
  Agency: "آژانس",
  "Travel Agency": "آژانس مسافرتی",
  Education: "آموزش",
  Technology: "فناوری",
  SaaS: "نرم‌افزار سرویس‌محور",
  Fintech: "فین‌تک",
  Healthcare: "سلامت",
  "Food & Beverage": "غذا و نوشیدنی",
  Custom: "سفارشی",
};

export const CATEGORY_NAME_FA: Record<string, string> = {
  "International Days": "روزهای بین‌المللی",
  "National Holidays": "تعطیلات ملی",
  "Religious Holidays": "تعطیلات مذهبی",
  "Retail Events": "رویدادهای خرده‌فروشی",
  "Shopping Seasons": "فصل‌های خرید",
  "Sales Events": "رویدادهای فروش",
  "Food Days": "روزهای غذایی",
  "Drink Days": "روزهای نوشیدنی",
  "Coffee Events": "رویدادهای قهوه",
  "Restaurant Events": "رویدادهای رستوران",
  "Technology Conferences": "کنفرانس‌های فناوری",
  "Developer Conferences": "کنفرانس‌های توسعه‌دهنده",
  "Gaming Events": "رویدادهای بازی",
  "Movie Releases": "اکران فیلم",
  "Music Festivals": "جشنواره‌های موسیقی",
  "Fashion Weeks": "هفته‌های مد",
  "Beauty Events": "رویدادهای زیبایی",
  "Sports Competitions": "مسابقات ورزشی",
  Olympics: "المپیک",
  "World Cup": "جام جهانی",
  "Local Sports Leagues": "لیگ‌های ورزشی محلی",
  "School Calendar": "تقویم مدرسه",
  "University Calendar": "تقویم دانشگاه",
  "Graduation Season": "فصل فارغ‌التحصیلی",
  "Travel Seasons": "فصل‌های سفر",
  "Vacation Periods": "دوره‌های تعطیلات",
  "Weather Seasons": "فصل‌های آب‌وهوا",
  "Tax Deadlines": "مهلت‌های مالیاتی",
  "Financial Events": "رویدادهای مالی",
  "Government Events": "رویدادهای دولتی",
  "Healthcare Awareness Days": "روزهای آگاهی سلامت",
  "Environmental Campaigns": "کمپین‌های محیط‌زیست",
  "NGO Campaigns": "کمپین‌های NGO",
  "Industry Specific Events": "رویدادهای صنعتی",
  "Company Custom Events": "رویدادهای سفارشی شرکت",
  "Food Events": "رویدادهای غذایی",
  "Technology Events": "رویدادهای فناوری",
  Entertainment: "سرگرمی",
};

/** Common marketing calendar event names (display only). */
export const EVENT_TITLE_FA: Record<string, string> = {
  "Back to School": "بازگشت به مدرسه",
  "Labor Day (US)": "روز کارگر (آمریکا)",
  "Autumn Equinox": "اعتدال پاییزی",
  "Fashion Week Paris": "هفته مد پاریس",
  "Black Friday": "جمعه سیاه",
  "Cyber Monday": "دوشنبه سایبری",
  "Earth Day": "روز زمین",
  "Valentine's Day": "روز ولنتاین",
  "New Year": "سال نو",
  Christmas: "کریسمس",
  Halloween: "هالووین",
  "Mother's Day": "روز مادر",
  "Father's Day": "روز پدر",
};

export const CONVERSATION_STATUS_FA: Record<string, string> = {
  OPEN: "باز",
  WAITING: "در انتظار",
  RESOLVED: "حل‌شده",
  CLOSED: "بسته",
  ARCHIVED: "بایگانی",
};

export const MESSAGE_DIR_FA: Record<string, string> = {
  INBOUND: "ورودی",
  OUTBOUND: "خروجی",
  SYSTEM: "سیستم",
};

export const INTENT_TYPE_FA: Record<string, string> = {
  QUESTION: "سؤال",
  SALES_LEAD: "سرنخ فروش",
  COMPLAINT: "شکایت",
  COMPLIMENT: "تعریف",
  SUPPORT: "پشتیبانی",
  VIP: "VIP",
  SPAM: "اسپم",
  OTHER: "سایر",
};

/** Localize titles that embed English event names / slugs. */
export function localizeEventishTitle(locale: string, title: string): string {
  if (locale !== "fa" || !title) return title;
  let out = title;
  for (const [en, fa] of Object.entries(EVENT_TITLE_FA)) {
    out = out.replaceAll(en, fa);
    out = out.replaceAll(en.toLowerCase(), fa);
  }
  return out
    .replaceAll("back to school", "بازگشت به مدرسه")
    .replaceAll("labor day us", "روز کارگر آمریکا")
    .replaceAll("autumn equinox", "اعتدال پاییزی")
    .replaceAll("fashion week paris", "هفته مد پاریس");
}
