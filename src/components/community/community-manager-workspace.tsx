"use client";

import { useT } from "@/i18n/use-t";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Headphones,
  Loader2,
  MessageSquareWarning,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CONVERSATION_STATUS_FA,
  INTENT_TYPE_FA,
  MESSAGE_DIR_FA,
  faLabel,
} from "@/i18n/display-labels";
import {
  COMMUNITY_TONES,
  INTENT_TYPES,
  QUALITY_DIMENSIONS,
  RESPONSE_MODES,
} from "@/lib/community";

const COMMUNITY_FA: Record<string, string> = {
  PROFESSIONAL: "حرفه‌ای",
  FRIENDLY: "صمیمی",
  LUXURY: "لوکس",
  MINIMAL: "مینیمال",
  CORPORATE: "سازمانی",
  FUNNY: "طنز",
  YOUTH: "جوان‌پسند",
  PREMIUM: "پریمیوم",
  EDUCATIONAL: "آموزشی",
  Questions: "سؤال‌ها",
  Complaints: "شکایت‌ها",
  "Sales Leads": "سرنخ‌های فروش",
  "Support Requests": "درخواست‌های پشتیبانی",
  Compliments: "تعریف‌ها",
  Spam: "اسپم",
  "VIP Customers": "مشتریان VIP",
  "Returning Customers": "مشتریان بازگشتی",
  "Potential Influencers": "اینفلوئنسرهای بالقوه",
  Other: "سایر",
  "Brand Consistency": "هماهنگی با برند",
  Clarity: "شفافیت",
  Professionalism: "حرفه‌ای‌بودن",
  Empathy: "همدلی",
  Actionability: "قابلیت اقدام",
  Confidence: "اطمینان",
  "FAQ assist": "کمک FAQ",
  "Lead capture": "جمع‌آوری سرنخ",
  "Complaint escalate": "ارجاع شکایت",
  "VIP notify": "اطلاع VIP",
  "VIP inquiry": "درخواست VIP",
  "Order issue": "مشکل سفارش",
  "Pricing interest": "علاقه به قیمت‌گذاری",
  "Shipping question": "سؤال ارسال",
  // Mock contact names & subjects
  "VIP Patron": "مشتری ویژه",
  "Jordan Lee": "جردن لی",
  "Alex Chen": "الکس چن",
  "Sara M": "سارا م.",
  "Sara M.": "سارا م.",
  "Sara Mohammadi": "سارا محمدی",
  "Mina Far": "مینا فر",
  "Omar Khalid": "عمر خالد",
  "Nora Aziz": "نورا عزیز",
  "Spam Bot": "ربات اسپم",
  // Mock conversation subjects
  "Chat with Sara Mohammadi": "گفتگو با سارا محمدی",
  "Chat with Alex Chen": "گفتگو با الکس چن",
  "Chat with Jordan Lee": "گفتگو با جردن لی",
  "Chat with Mina Far": "گفتگو با مینا فر",
  "Chat with Omar Khalid": "گفتگو با عمر خالد",
  "Chat with Nora Aziz": "گفتگو با نورا عزیز",
  "Chat with Spam Bot": "گفتگو با ربات اسپم",
  "Chat with VIP Patron": "گفتگو با مشتری ویژه",
  // Mock message bodies for display-time localization
  "Love the new collection. Can I get early access to the next drop?":
    "مجموعه جدید عالیه. میشه زودتر از بقیه به محصول بعدی دسترسی داشته باشم؟",
  "My last order arrived damaged. This is really disappointing — please help":
    "سفارش آخرم آسیب‌دیده رسید. واقعاً ناامیدکننده‌ست — لطفاً کمکم کنید",
  "I'm interested in your premium plan for my team — can someone share pricing options?":
    "به پلن ویژه برای تیمم علاقه‌مندم — کسی میتونه گزینه‌های قیمتی رو بفرسته؟",
  "Hi! Do you ship internationally and how long does delivery usually take?":
    "سلام! ارسال بین‌المللی دارید و معمولاً چقدر طول می‌کشه؟",
  "Hi! Do you ship to Tehran?": "سلام! به تهران ارسال دارید؟",
  "Yes we do — usually 2–3 days.": "بله — معمولاً ۲ تا ۳ روز.",
  "Perfect. Can I get the price list?": "عالی. لیست قیمت رو میشه برام بفرستید؟",
  "Also interested in the spring collection 👀": "مجموعه بهاری هم جالبه 👀",
  "Order #4821 still processing?": "سفارش #۴۸۲۱ هنوز در حال پردازشه؟",
  "Checking with ops — one moment.": "دارم با بخش عملیات چک می‌کنم — لحظه‌ای.",
  "Thanks, waiting here.": "ممنون، منتظرم.",
  "Saw your ad. Is this available in Dubai?": "تبلیغتون رو دیدم. در دبی موجوده؟",
  "Collab rates for next month?": "نرخ همکاری ماه بعد؟",
  "Sending a deck shortly.": "به‌زودی ارسال می‌کنم.",
  "Received, looks good!": "دریافت شد، عالیه!",
  "Can we book a demo for Friday?": "برای جمعه یک دمو رزرو کنیم؟",
  "Friday 11am works. Calendar invite sent.": "جمعه ساعت ۱۱ اوکیه. دعوت‌نامه تقویم ارسال شد.",
  "Buy followers cheap!!!": "فالوور ارزان بخرید!!!",
  "Loved the last reel 🔥": "آخرین ریلز فوق‌العاده بود 🔥",
  "Do you have a size guide?": "راهنمای سایز دارید؟",
  "Also need gift wrapping": "بسته‌بندی هدیه هم لازمه",
  "Shared a lookbook image": "تصویر لوک‌بوک به اشتراک گذاشته شد",
  "VIP customer — answer first.": "مشتری VIP — اول پاسخ بدید.",
  "Negative sentiment and urgency elevate priority.":
    "احساس منفی و فوریت اولویت را بالا می‌برد.",
  "High revenue potential lead.": "سرنخ با پتانسیل درآمد بالا.",
  "Unanswered inbound needs a timely reply.":
    "پیام ورودی بدون پاسخ نیاز به پاسخ به‌موقع دارد.",
  REPLY: "پاسخ",
  FOLLOW_UP: "پیگیری",
  OFFER: "پیشنهاد",
  DISCOUNT: "تخفیف",
  CTA: "دعوت به اقدام",
  KNOWLEDGE: "دانش",
  ESCALATE: "ارجاع",
  negative: "منفی",
  neutral: "خنثی",
  positive: "مثبت",
};

type SuggestedReply = {
  id: string;
  kind: string;
  status: string;
  body: string;
  confidence: number;
  qualityScore: number | null;
  qualityBreakdown: Record<string, number> | null;
  explanation: string | null;
};

type QueueItem = {
  id: string;
  subject: string | null;
  status: string;
  lastMessageAt: string;
  contact: { id: string; name: string | null; tags: string[] };
  assignee: { id: string; name: string | null; email: string } | null;
  intent: {
    type: string;
    confidence: number;
    explanation: string | null;
  } | null;
  priority: {
    score: number;
    rankReason: string;
    vip: boolean;
    urgent: boolean;
    negativeSentiment?: boolean;
  } | null;
  sentiment: {
    label: string;
    score: number;
    buyingIntent: number;
    urgency: number;
    salesOpportunity: number;
    retentionRisk: number;
    explanation: string | null;
  } | null;
  suggestedReplies: SuggestedReply[];
  messages: Array<{ id: string; body: string; direction: string; createdAt: string }>;
};

type Member = { id: string; name: string | null; email: string };

type Props = {
  workspaceSlug: string;
  brandSlug: string;
};

export function CommunityManagerWorkspace({
  workspaceSlug,
  brandSlug,
}: Props) {
  const page = usePageCopy("community");
  const t = useT();
  const locale = t.locale;
  const tr = useCallback((value: string) => faLabel(locale, value, COMMUNITY_FA), [locale]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [dashboard, setDashboard] = useState({
    inboxHealth: 0,
    averageResponseMinutes: null as number | null,
    pendingReplies: 0,
    vipQueue: 0,
    negativeSentiment: 0,
    resolvedToday: 0,
    leadOpportunities: 0,
    unanswered: 0,
  });
  const [responseMode, setResponseMode] = useState("APPROVAL_REQUIRED");
  const [tone, setTone] = useState("FRIENDLY");
  const [autoCategories, setAutoCategories] = useState<string[]>([
    "QUESTION",
    "COMPLIMENT",
  ]);
  const [autoRules, setAutoRules] = useState<
    Array<{ id: string; name: string; intentType: string; enabled: boolean; autoSend: boolean }>
  >([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | "vip" | "negative" | "leads">("all");

  const qs = useMemo(
    () => new URLSearchParams({ workspaceSlug, brandSlug }).toString(),
    [workspaceSlug, brandSlug],
  );

  const apply = (data: Record<string, unknown>) => {
    setQueue((data.queue as QueueItem[]) || []);
    setDashboard((data.dashboard as typeof dashboard) || dashboard);
    setMembers((data.members as Member[]) || []);
    setAutoRules((data.autoRules as typeof autoRules) || []);
    const rule = data.rule as {
      responseMode?: string;
      tone?: string;
      autoCategories?: string[];
    } | null;
    if (rule?.responseMode) setResponseMode(rule.responseMode);
    if (rule?.tone) setTone(rule.tone);
    if (rule?.autoCategories) setAutoCategories(rule.autoCategories);
    if (!activeId && (data.queue as QueueItem[])?.[0]?.id) {
      setActiveId((data.queue as QueueItem[])[0].id);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/community?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      apply(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Unable to load", "بارگذاری ممکن نشد"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, brandSlug, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const scan = async () => {
    setBusy(true);
    try {
      const data = await post({ intent: "scan", language: locale });
      apply(data.dashboard);
      toast.success(t("Inbox intelligence updated", "هوش اینباکس به‌روزرسانی شد"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Scan failed", "اسکن ناموفق بود"));
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    try {
      await post({
        intent: "settings",
        responseMode,
        tone,
        autoCategories,
      });
      toast.success(t("Community settings saved", "تنظیمات مدیریت جامعه ذخیره شد"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Save failed", "ذخیره ناموفق بود"));
    }
  };

  const active = queue.find((q) => q.id === activeId) || null;
  const primaryReply = active?.suggestedReplies?.[0] || null;

  useEffect(() => {
    if (primaryReply) setEditBody(primaryReply.body);
  }, [primaryReply?.id]);

  const filtered = queue.filter((q) => {
    if (filter === "vip") return q.priority?.vip || q.intent?.type === t("VIP", "VIP");
    if (filter === "negative")
      return q.sentiment?.label === "negative" || q.priority?.negativeSentiment;
    if (filter === "leads") return q.intent?.type === "SALES_LEAD";
    return true;
  });

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="h-full rounded-2xl" />
        <Skeleton className="hidden h-full rounded-2xl lg:block" />
      </div>
    );
  }

  return (
    <div
      dir={locale === "fa" ? "rtl" : "ltr"}
      className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/8 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.08),_transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]"
    >
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
            <Headphones className="size-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              {page.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t(
                "Prioritize, draft, and assist — never a blind auto-reply bot",
                "اولویت‌بندی، پیش‌نویس و کمک — هرگز ربات پاسخ‌گوی کور",
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/w/${workspaceSlug}/b/${brandSlug}/inbox`}>{t("Open Inbox", "باز کردن اینباکس")}</Link>
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void scan()}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {t("Scan inbox", "اسکن اینباکس")}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* LEFT — health + settings */}
        <aside className="hidden min-h-0 flex-col border-r border-white/6 lg:flex">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                [t("Inbox health", "سلامت اینباکس"), dashboard.inboxHealth],
                [t("Pending", "در انتظار"), dashboard.pendingReplies],
                [t("VIP queue", "صف VIP"), dashboard.vipQueue],
                [t("Negative", "منفی"), dashboard.negativeSentiment],
                [t("Leads", "سرنخ‌ها"), dashboard.leadOpportunities],
                [t("Resolved today", "حل‌شده امروز"), dashboard.resolvedToday],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-xl border border-white/8 bg-black/20 px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-xl tracking-tight">{value as number}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("Avg response:", "میانگین پاسخ:")}{" "}
              {dashboard.averageResponseMinutes != null
                ? `${dashboard.averageResponseMinutes} ${t("min", "دقیقه")}`
                : "—"}{" "}
              · {t("Unanswered:", "بدون پاسخ:")} {dashboard.unanswered}
            </p>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("Response mode", "حالت پاسخ")}
              </p>
              {RESPONSE_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setResponseMode(m.key)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2",
                    responseMode === m.key
                      ? "border-teal-500/40 bg-teal-500/10"
                      : "border-white/8 hover:bg-white/4",
                  )}
                >
                  <p className="text-sm font-medium">
                    {t(
                      m.label,
                      (
                        {
                          Manual: "دستی",
                          "Approval Required": "نیاز به تأیید",
                          "Semi-Automatic": "نیمه‌خودکار",
                          Automatic: "خودکار",
                        } as Record<string, string>
                      )[m.label] ?? m.label,
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      m.description,
                      (
                        {
                          "AI drafts only — nothing sends without you.":
                            "فقط پیش‌نویس هوش مصنوعی — بدون شما چیزی ارسال نمی‌شود.",
                          "AI prepares replies waiting for confirmation.":
                            "هوش مصنوعی پاسخ‌ها را برای تأیید آماده می‌کند.",
                          "Trusted categories can be auto-queued.":
                            "دسته‌های مورد اعتماد می‌توانند خودکار در صف قرار گیرند.",
                          "Pre-approved scenarios can auto-queue replies.":
                            "سناریوهای ازپیش‌تأییدشده می‌توانند پاسخ را خودکار صف کنند.",
                        } as Record<string, string>
                      )[m.description] ?? m.description,
                    )}
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{t("Tone engine", "موتور لحن")}</Label>
              <select
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                {COMMUNITY_TONES.map((t) => (
                  <option key={t} value={t}>
                    {tr(t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("Semi-auto categories", "دسته‌های نیمه‌خودکار")}</Label>
              <div className="flex flex-wrap gap-1">
                {INTENT_TYPES.filter((i) => i.key !== "OTHER").map((i) => {
                  const on = autoCategories.includes(i.key);
                  return (
                    <button
                      key={i.key}
                      type="button"
                      onClick={() =>
                        setAutoCategories((prev) =>
                          on ? prev.filter((x) => x !== i.key) : [...prev, i.key],
                        )
                      }
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px]",
                        on
                          ? "border-teal-500/40 bg-teal-500/10"
                          : "border-white/10 text-muted-foreground",
                      )}
                    >
                      {tr(i.label)}
                    </button>
                  );
                })}
              </div>
              <Button size="sm" className="w-full" onClick={() => void saveSettings()}>
                {t("Save settings", "ذخیره تنظیمات")}
              </Button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("Auto-reply rules", "قوانین پاسخ خودکار")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "Auto-send stays off unless you explicitly enable it — never outside approved rules.",
                  "ارسال خودکار خاموش می‌ماند مگر اینکه خودتان صریحاً فعالش کنید — هرگز خارج از قوانین تأییدشده.",
                )}
              </p>
              {autoRules.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-white/8 px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{tr(r.name)}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        void post({
                          intent: "auto_rule",
                          ruleId: r.id,
                          enabled: !r.enabled,
                        }).then(() => load())
                      }
                    >
                      {r.enabled ? t("On", "روشن") : t("Off", "خاموش")}
                    </button>
                  </div>
                  <p className="text-muted-foreground">
                    {faLabel(locale, r.intentType, INTENT_TYPE_FA)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER — priority queue */}
        <section className="flex min-h-0 flex-col">
          <div className="flex gap-1 border-b border-white/6 px-3 py-2">
            {(
              [
                ["all", t("Priority queue", "صف اولویت")],
                ["vip", t("VIP", "VIP")],
                ["negative", t("Negative", "منفی")],
                ["leads", t("Leads", "سرنخ‌ها")],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs",
                  filter === key
                    ? "bg-white/8 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {!filtered.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <Users className="size-8 text-muted-foreground" />
                <div>
                  <h2 className="text-2xl tracking-tight">
                    {t(
                      "Scan to prioritize conversations",
                      "اسکن کنید تا گفتگوها اولویت‌بندی شوند",
                    )}
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {t(
                      "AI classifies intent, ranks urgency, and drafts brand-safe suggestions grounded in Business Brain and Knowledge Base.",
                      "هوش مصنوعی نیت را طبقه‌بندی می‌کند، فوریت را رتبه‌بندی می‌کند و پیشنهادهای امن برای برند بر پایه مغز کسب‌وکار و پایگاه دانش می‌سازد.",
                    )}
                  </p>
                </div>
                <Button disabled={busy} onClick={() => void scan()}>
                  <Sparkles className="size-3.5" />
                  {t("Run first scan", "اولین اسکن را اجرا کنید")}
                </Button>
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3",
                    activeId === c.id
                      ? "border-teal-500/40 bg-teal-500/10"
                      : "border-white/8 bg-black/15 hover:bg-white/[0.03]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        {c.intent ? (
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            {faLabel(locale, c.intent.type, INTENT_TYPE_FA)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-md text-[10px]">
                            {t("Unscanned", "اسکن‌نشده")}
                          </Badge>
                        )}
                        {c.priority?.vip ? (
                          <Badge variant="secondary" className="rounded-md text-[10px]">
                            {t("VIP", "وی‌آی‌پی")}
                          </Badge>
                        ) : null}
                        {c.priority?.urgent ? (
                          <Badge
                            variant="secondary"
                            className="rounded-md bg-amber-500/20 text-[10px]"
                          >
                            {t("Urgent", "فوری")}
                          </Badge>
                        ) : null}
                        {c.sentiment?.label === "negative" ? (
                          <MessageSquareWarning className="size-3.5 text-amber-400" />
                        ) : null}
                      </div>
                      <p className="truncate text-sm font-medium">
                        {tr(c.contact.name || "") || t("Unknown", "ناشناس")} ·{" "}
                        {c.subject ? tr(c.subject) : t("Conversation", "گفتگو")}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {tr(c.priority?.rankReason || "") ||
                          tr(c.messages[0]?.body || "") ||
                          t("Awaiting intelligence scan", "در انتظار اسکن هوشمندی")}
                      </p>
                    </div>
                    <p className="text-xl tracking-tight">
                      {Math.round(c.priority?.score || 0)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* RIGHT — detail + suggestions */}
        <aside className="hidden min-h-0 flex-col border-l border-white/6 lg:flex">
          <div className="border-b border-white/6 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("Assist panel", "پنل کمک")}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            {!active ? (
              <p className="text-xs text-muted-foreground">
                {t(
                  "Select a conversation to review insights and reply drafts.",
                  "یک گفتگو را انتخاب کنید تا بینش‌ها و پیش‌نویس پاسخ را ببینید.",
                )}
              </p>
            ) : (
              <>
                <div>
                  <h2 className="text-xl tracking-tight">
                    {tr(active.contact.name || "") || t("Customer", "مشتری")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                      {active.subject ? tr(active.subject) : t("Conversation", "گفتگو")} ·{" "}
                    {faLabel(locale, active.status, CONVERSATION_STATUS_FA)}
                  </p>
                </div>

                {active.intent ? (
                  <div className="rounded-xl border border-white/8 px-3 py-2 text-xs">
                    <p className="font-medium">
                      {t("Intent", "نیت")} ·{" "}
                      {faLabel(locale, active.intent.type, INTENT_TYPE_FA)} (
                      {Math.round(active.intent.confidence * 100)}%{" "}
                      {t("confidence", "اطمینان")})
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {tr(active.intent.explanation || "")}
                    </p>
                  </div>
                ) : null}

                {active.sentiment ? (
                  <div className="space-y-1 text-xs">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t("Conversation insights", "بینش گفتگو")}
                    </p>
                    <p>
                      {t("Sentiment:", "احساس:")} {tr(active.sentiment.label)}
                    </p>
                    <p>
                      {t("Buying intent:", "نیت خرید:")}{" "}
                      {Math.round(active.sentiment.buyingIntent)}
                    </p>
                    <p>
                      {t("Sales opportunity:", "فرصت فروش:")}{" "}
                      {Math.round(active.sentiment.salesOpportunity)}
                    </p>
                    <p>
                      {t("Retention risk:", "ریسک نگهداشت:")}{" "}
                      {Math.round(active.sentiment.retentionRisk)}
                    </p>
                    <p className="text-muted-foreground">{tr(active.sentiment.explanation || "")}</p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t("Recent messages", "پیام‌های اخیر")}
                  </p>
                  {[...active.messages].reverse().map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs",
                        m.direction === "INBOUND"
                          ? "bg-white/5"
                          : "border border-teal-500/20 bg-teal-500/5",
                      )}
                    >
                      <span className="text-[10px] text-muted-foreground">
                        {faLabel(locale, m.direction, MESSAGE_DIR_FA)}
                      </span>
                      <p>{tr(m.body)}</p>
                    </div>
                  ))}
                </div>

                {primaryReply ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {t("Suggested", "پیشنهادی")}{" "}
                        {tr(primaryReply.kind.replaceAll("_", " "))}
                      </p>
                      <Badge variant="outline" className="rounded-md text-[10px]">
                        {Math.round(primaryReply.confidence * 100)}%{" "}
                        {t("conf · score", "اطمینان · امتیاز")}{" "}
                        {Math.round(primaryReply.qualityScore || 0)}
                      </Badge>
                    </div>
                    {primaryReply.explanation ? (
                      <p className="text-[11px] text-muted-foreground">
                        {primaryReply.explanation}
                      </p>
                    ) : null}
                    {primaryReply.qualityBreakdown ? (
                      <div className="space-y-1">
                        {QUALITY_DIMENSIONS.map((d) => {
                          const v = Number(
                            primaryReply.qualityBreakdown?.[d.key] ?? 0,
                          );
                          return (
                            <div key={d.key}>
                              <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                                <span>{tr(d.label)}</span>
                                <span>{Math.round(v)}</span>
                              </div>
                              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                                <div
                                  className="h-full rounded-full bg-teal-400/80"
                                  style={{ width: `${Math.min(100, v)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <Textarea
                      className="min-h-[120px]"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void post({
                            intent: "review_reply",
                            replyId: primaryReply.id,
                            action:
                              editBody.trim() !== primaryReply.body
                                ? "edit_send"
                                : "approve",
                            editedBody: editBody,
                          }).then(() => {
                            toast.success(t("Reply sent to conversation", "پاسخ به گفتگو ارسال شد"));
                            return load();
                          })
                        }
                      >
                        <Check className="size-3.5" />
                        {t("Approve & send", "تأیید و ارسال")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void post({
                            intent: "review_reply",
                            replyId: primaryReply.id,
                            action: "reject",
                          }).then(() => {
                            toast.success(t("Rejected — learning updated", "رد شد — یادگیری به‌روزرسانی شد"));
                            return load();
                          })
                        }
                      >
                        <X className="size-3.5" />
                        {t("Reject", "رد")}
                      </Button>
                    </div>
                    {active.suggestedReplies.length > 1 ? (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">
                          {t("More suggestions", "پیشنهادهای بیشتر")}
                        </p>
                        {active.suggestedReplies.slice(1).map((s) => (
                          <p
                            key={s.id}
                            className="rounded-lg border border-white/8 px-2 py-1.5 text-[11px] text-muted-foreground"
                          >
                            <span className="font-medium text-foreground/80">
                              {tr(s.kind)}:{" "}
                            </span>
                            {s.body}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-muted-foreground">
                    <AlertTriangle className="mx-auto mb-2 size-4" />
                    {t(
                      "No drafts yet — run Scan inbox.",
                      "هنوز پیش‌نویسی نیست — اسکن اینباکس را اجرا کنید.",
                    )}
                  </div>
                )}

                <div className="space-y-2 border-t border-white/6 pt-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t("Team collaboration", "همکاری تیمی")}
                  </p>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                    value={active.assignee?.id || ""}
                    onChange={(e) =>
                      void post({
                        intent: "collaborate",
                        conversationId: active.id,
                        assigneeId: e.target.value || null,
                      }).then(() => load())
                    }
                  >
                    <option value="">{t("Unassigned", "اختصاص‌نیافته")}</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    {(["OPEN", "WAITING", "RESOLVED"] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="ghost"
                        className="text-[11px]"
                        onClick={() =>
                          void post({
                            intent: "collaborate",
                            conversationId: active.id,
                            status: s,
                          }).then(() => load())
                        }
                      >
                        {faLabel(locale, s, CONVERSATION_STATUS_FA)}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    placeholder={t("Internal note / @mention…", "یادداشت داخلی / @منشن…")}
                    className="min-h-[64px]"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!note.trim()}
                    onClick={() =>
                      void post({
                        intent: "collaborate",
                        conversationId: active.id,
                        note,
                      }).then(() => {
                        setNote("");
                        toast.success(t("Note added", "یادداشت اضافه شد"));
                        return load();
                      })
                    }
                  >
                    {t("Add note", "افزودن یادداشت")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
