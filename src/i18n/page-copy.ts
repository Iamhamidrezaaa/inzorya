import type { Locale } from "./config";
import { pageCopy, type PageMeta } from "@/lib/navigation";

const faPages: Record<keyof typeof pageCopy, PageMeta> = {
  home: {
    title: "خانه",
    description: "نمای کلی گفتگوها در این ورک‌اسپیس.",
    emptyTitle: "اینباکس آماده است",
    emptyDescription: "یک کانال وصل کنید تا گفتگوها اینجا بیایند.",
  },
  inbox: {
    title: "اینباکس",
    description: "گفتگو با مشتری در کانال‌های متصل.",
    emptyTitle: "هنوز گفتگویی نیست",
    emptyDescription:
      "وقتی مشتری پیام بدهد، رشته‌ها اینجا ظاهر می‌شوند. برای شروع دستی یک مخاطب بسازید.",
  },
  contacts: {
    title: "مخاطبین",
    description: "افرادی که در اینستاگرام و کانال‌های دیگر با آن‌ها حرف می‌زنید.",
    emptyTitle: "هنوز مخاطبی نیست",
    emptyDescription: "یک مشتری اضافه کنید تا گفتگوها را پیگیری کنید.",
  },
  channels: {
    title: "کانال‌ها",
    description: "اتصال اینستاگرام بیزینس، صفحات فیسبوک و مسنجر.",
    emptyTitle: "کانالی وصل نیست",
    emptyDescription: "OAuth یا سندباکس را شروع کنید تا حساب متا را لینک کنید.",
  },
  strategy: {
    title: "استراتژی",
    description: "فضای درک کسب‌وکار و استراتژی بازاریابی.",
    emptyTitle: "استراتژی را شروع کنید",
    emptyDescription:
      "قبل از تولید محتوا، اهداف، مخاطب، رقبا و ستون‌ها را ثبت کنید.",
  },
  strategist: {
    title: "استراتژیست هوش مصنوعی",
    description: "استراتژیست ارشد بازاریابی بر پایه زمینه کسب‌وکار شما.",
    emptyTitle: "از استراتژیست بپرسید",
    emptyDescription:
      "بدون مهندسی پرامپت — به زبان ساده بپرسید و با پیشنهاد ساخت‌یافته تصمیم بگیرید.",
  },
  planner: {
    title: "برنامه‌ریز محتوا",
    description: "برنامه‌های انتشار استراتژیک از هوش کسب‌وکار.",
    emptyTitle: "یک برنامه بسازید",
    emptyDescription:
      "برنامه‌های تقویمی محتوا — فقط عنوان و اسلات، بدون کپشن.",
  },
  creator: {
    title: "تولیدکننده محتوا",
    description: "تولید محتوای آگاه از زمینه با نسخه‌های امتیازدهی‌شده.",
    emptyTitle: "محتوا تولید کنید",
    emptyDescription:
      "پلتفرم، هدف، کمپین و نوع را انتخاب کنید — زمینه کسب‌وکار بقیه را انجام می‌دهد.",
  },
  opportunities: {
    title: "هوش فرصت‌ها",
    description: "فرصت‌های بازاریابی پیش‌دستانه متناسب با کسب‌وکار شما.",
    emptyTitle: "فرصت‌ها را اسکن کنید",
    emptyDescription:
      "لحظات پراهمیت را قبل از رسیدن کشف کنید — نه لیست خام مناسبت‌ها.",
  },
  community: {
    title: "مدیریت جامعه",
    description: "گفتگوهای اولویت‌بندی‌شده با کمک پاسخ امن برای برند.",
    emptyTitle: "اینباکس را اسکن کنید",
    emptyDescription:
      "نیت را طبقه‌بندی کنید، فوریت را رتبه‌بندی کنید و پیش‌نویس پاسخ بسازید — بدون ارسال کور.",
  },
  decisions: {
    title: "مرکز تصمیم بازاریابی",
    description: "مغز اجرایی صبحگاهی — فقط تصمیم‌های مهم امروز.",
    emptyTitle: "بریف امروز را بسازید",
    emptyDescription:
      "اولویت‌ها، ریسک‌ها و اقدامات پیشنهادی — نه انبوه متریک.",
  },
  work: {
    title: "فضای کار بازاریابی",
    description: "لایه اجرا — پیشنهادهای هوش مصنوعی را به کار تمام‌شده تبدیل کنید.",
    emptyTitle: "اولین کار را بسازید",
    emptyDescription:
      "تصمیم‌ها، کمپین‌ها و ایده‌ها را با یک کلیک به کار قابل‌اجرا تبدیل کنید.",
  },
  calendar: {
    title: "هوش تقویم",
    description:
      "پایگاه رویدادهای بازاریابی جهانی — کشورها، فصل‌ها، بومی‌سازی، واردات.",
    emptyTitle: "تقویم را پر کنید",
    emptyDescription:
      "کاتالوگ جهانی رویدادها را بسازید. بدون هوش مصنوعی — فقط داده ساخت‌یافته.",
  },
  "knowledge-graph": {
    title: "گراف دانش بازاریابی",
    description:
      "معنای ساخت‌یافته کسب‌وکار برای هر رویداد — صنایع، مخاطبان، CTA.",
    emptyTitle: "گراف را آماده کنید",
    emptyDescription:
      "رویدادها را به صنایع، محصولات، اهداف و کانال‌ها وصل کنید — بدون هوش مصنوعی.",
  },
  matching: {
    title: "موتور تطبیق فرصت",
    description:
      "امتیازدهی قطعی مرتبط بودن — بدون LLM، بدون محتوا، قوانین تکرارپذیر.",
    emptyTitle: "تطبیق را اجرا کنید",
    emptyDescription:
      "هر رویداد بازاریابی را در برابر این برند با قوانین وزن‌دار امتیاز دهید.",
  },
  recommendations: {
    title: "موتور پیشنهاد کمپین",
    description:
      "فرصت‌های باارزش را به طرح کمپین برای تأیید انسان تبدیل کنید.",
    emptyTitle: "پیشنهاد بسازید",
    emptyDescription:
      "فرصت‌های واجد شرایط به برنامه ساخت‌یافته کمپین تبدیل می‌شوند — هرگز خودکار اجرا نمی‌شوند.",
  },
  pipeline: {
    title: "خط لوله اجرا",
    description:
      "کمپین‌های تأییدشده را به برنامه‌ریز، کارها، همگام‌سازی تقویم و انتشار وصل کنید.",
    emptyTitle: "یک پیشنهاد را تأیید کنید",
    emptyDescription:
      "گردش‌کار وقتی شروع می‌شود که طرح کمپین تأیید شود — زمینه از دست نمی‌رود.",
  },
  brain: {
    title: "مغز کسب‌وکار",
    description: "دانش ساخت‌یافته کسب‌وکار از طریق مصاحبه.",
    emptyTitle: "مصاحبه را شروع کنید",
    emptyDescription: "به اینزوریا بیاموزید کی هستید — یک سؤال در هر بار.",
  },
  knowledge: {
    title: "دانش",
    description: "منبع حقیقت برای تیم (و هوش مصنوعی آینده).",
    emptyTitle: "هنوز دانشی نیست",
    emptyDescription: "اسناد اضافه کنید تا پاسخ‌ها هم‌صدا با برند بمانند.",
  },
  "knowledge-sources": {
    title: "منابع",
    description: "منابع دانش واردشده.",
    emptyTitle: "منبعی نیست",
    emptyDescription: "منابع بعداً گسترش می‌یابند.",
  },
  "knowledge-ask": {
    title: "پرسش از دانش",
    description: "برای بازیابی با هوش مصنوعی در آینده.",
    emptyTitle: "به‌زودی",
    emptyDescription: "در این اسپرینت هوش مصنوعی نیست.",
  },
  content: {
    title: "محتوا",
    description: "هدایت به استودیو محتوا.",
    emptyTitle: "استودیو محتوا را باز کنید",
    emptyDescription: "کل خط لوله محتوا را در استودیو مدیریت کنید.",
  },
  studio: {
    title: "استودیو محتوا",
    description: "از ایده تا انتشار — گردش تولید محتوا.",
    emptyTitle: "اولین ایده را ثبت کنید",
    emptyDescription:
      "محتوا را از تحقیق، بریف، پیش‌نویس، بازبینی تا انتشار جلو ببرید.",
  },
  "content-approvals": {
    title: "تأییدها",
    description: "محتوای در انتظار بازبینی.",
    emptyTitle: "چیزی برای تأیید نیست",
    emptyDescription: "تأییدها نسبت به اینباکس ثانویه می‌مانند.",
  },
  campaigns: {
    title: "کمپین‌ها",
    description: "پوسته کمپین برای کارهای بعدی.",
    emptyTitle: "هنوز کمپینی نیست",
    emptyDescription: "کمپین‌ها ثانویه‌اند. گفتگو محصول اصلی است.",
  },
  media: {
    title: "رسانه",
    description: "تصاویر برای پاسخ و محتوا.",
    emptyTitle: "کتابخانه رسانه خالی است",
    emptyDescription: "تصاویر را آپلود کنید تا در گفتگو و محتوا دوباره استفاده شوند.",
  },
  analytics: {
    title: "تحلیل‌ها",
    description: "KPI، تعامل، مخاطب، محتوا و عملکرد کمپین.",
    emptyTitle: "هنوز تحلیلی نیست",
    emptyDescription: "کانال‌ها را بعداً وصل کنید — تحلیل آزمایشی امروز در دسترس است.",
  },
  automations: {
    title: "اتوماسیون‌ها",
    description: "گردش‌کارهای بصری بازاریابی — محرک، شرط و اقدام.",
    emptyTitle: "هنوز اتوماسیونی نیست",
    emptyDescription: "یک گردش‌کار بسازید یا از قالب شروع کنید.",
  },
  "automation-runs": {
    title: "اجراها",
    description: "تاریخچه اجرای آزمایشی برای گردش‌کارهای طراحی‌شده.",
    emptyTitle: "هنوز اجرایی نیست",
    emptyDescription: "موتور اجرا بعداً می‌آید — امروز جریان‌ها را طراحی کنید.",
  },
  agents: {
    title: "عامل‌های هوش مصنوعی",
    description: "رزرو شده. در این اسپرینت عاملی نیست.",
    emptyTitle: "هنوز در دسترس نیست",
    emptyDescription: "عامل‌ها بعد از پایه گفتگو می‌آیند.",
  },
  tasks: {
    title: "کارها",
    description: "رزرو شده.",
    emptyTitle: "هنوز در دسترس نیست",
    emptyDescription: "اولویت با اینباکس است.",
  },
  brand: {
    title: "برند",
    description: "هویت و لحن این برند.",
    emptyTitle: "برند را تعریف کنید",
    emptyDescription: "پروفایل برند را کامل کنید.",
  },
  workspace: {
    title: "ورک‌اسپیس",
    description: "نمای کلی ورک‌اسپیس.",
    emptyTitle: "ورک‌اسپیس آماده است",
    emptyDescription: "برای پیکربندی از تنظیمات استفاده کنید.",
  },
  team: {
    title: "تیم",
    description: "اعضا و نقش‌ها.",
    emptyTitle: "تیم",
    emptyDescription: "جریان دعوت بعداً می‌آید.",
  },
  "team-roles": {
    title: "نقش‌ها",
    description: "نقش‌های دسترسی.",
    emptyTitle: "نقش‌های پیش‌فرض",
    emptyDescription: "نقش‌های سفارشی بعداً.",
  },
  "team-invites": {
    title: "دعوت‌ها",
    description: "دعوت‌های در انتظار.",
    emptyTitle: "دعوتی نیست",
    emptyDescription: "دعوت‌ها بعداً می‌آیند.",
  },
  integrations: {
    title: "یکپارچه‌سازی‌ها",
    description: "به کانال‌ها منتقل شد.",
    emptyTitle: "از کانال‌ها استفاده کنید",
    emptyDescription: "اینستاگرام و کانال‌های دیگر را از بخش کانال‌ها وصل کنید.",
  },
  "integrations-catalog": {
    title: "کاتالوگ",
    description: "به‌جای آن از کانال‌ها استفاده کنید.",
    emptyTitle: "از کانال‌ها استفاده کنید",
    emptyDescription: "کارت‌های کانال زیر بخش کانال‌ها هستند.",
  },
  settings: {
    title: "تنظیمات",
    description: "پروفایل، ورک‌اسپیس و برند.",
    emptyTitle: "تنظیمات",
    emptyDescription: "پیکربندی اینزوریا برای تیم خود را مدیریت کنید.",
  },
  activity: {
    title: "فعالیت‌ها",
    description: "جدول زمانی تغییرات مهم ورک‌اسپیس.",
    emptyTitle: "هنوز فعالیتی نیست",
    emptyDescription: "به‌روزرسانی‌های کسب‌وکار، کانال و استراتژی اینجا ظاهر می‌شوند.",
  },
  "settings-workspace": {
    title: "تنظیمات ورک‌اسپیس",
    description: "نام و ترجیحات ورک‌اسپیس.",
    emptyTitle: "ورک‌اسپیس",
    emptyDescription: "جزئیات ورک‌اسپیس را ویرایش کنید.",
  },
  "settings-brands": {
    title: "برندها",
    description: "مدیریت برند.",
    emptyTitle: "برندها",
    emptyDescription: "برندها را از تنظیمات برند مدیریت کنید.",
  },
  "settings-billing": {
    title: "صورتحساب",
    description: "صورتحساب بعداً می‌آید.",
    emptyTitle: "پیکربندی نشده",
    emptyDescription: "صورتحساب بعداً عرضه می‌شود.",
  },
  "settings-notifications": {
    title: "اعلان‌ها",
    description: "ترجیحات اعلان.",
    emptyTitle: "پیش‌فرض فعال",
    emptyDescription: "کلیدهای بیشتر بعداً.",
  },
  "settings-security": {
    title: "امنیت",
    description: "کنترل‌های امنیتی.",
    emptyTitle: "امنیت",
    emptyDescription: "بعداً گسترش می‌یابد.",
  },
  "settings-api": {
    title: "API",
    description: "کلیدهای API بعداً.",
    emptyTitle: "کلیدی نیست",
    emptyDescription: "دسترسی API بعداً عرضه می‌شود.",
  },
};

export type PageCopyKey = keyof typeof pageCopy;

export function getPageCopy(
  locale: Locale,
  key: PageCopyKey,
): PageMeta {
  if (locale === "fa") return faPages[key] ?? pageCopy[key];
  return pageCopy[key];
}
