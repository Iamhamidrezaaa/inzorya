export const COMMUNITY_CHANNELS = [
  "INSTAGRAM",
  "FACEBOOK",
  "MESSENGER",
  "WHATSAPP",
  "LINKEDIN",
  "X",
  "TELEGRAM",
  "EMAIL",
  "LIVE_CHAT",
] as const;

export const RESPONSE_MODES = [
  {
    key: "MANUAL",
    label: "Manual",
    description: "AI drafts only — nothing sends without you.",
  },
  {
    key: "APPROVAL_REQUIRED",
    label: "Approval Required",
    description: "AI prepares replies waiting for confirmation.",
  },
  {
    key: "SEMI_AUTOMATIC",
    label: "Semi-Automatic",
    description: "Trusted categories can be auto-queued.",
  },
  {
    key: "AUTOMATIC",
    label: "Automatic",
    description: "Pre-approved scenarios can auto-queue replies.",
  },
] as const;

export const COMMUNITY_TONES = [
  "PROFESSIONAL",
  "FRIENDLY",
  "LUXURY",
  "MINIMAL",
  "CORPORATE",
  "FUNNY",
  "YOUTH",
  "PREMIUM",
  "EDUCATIONAL",
] as const;

export const INTENT_TYPES = [
  { key: "QUESTION", label: "Questions" },
  { key: "COMPLAINT", label: "Complaints" },
  { key: "SALES_LEAD", label: "Sales Leads" },
  { key: "SUPPORT", label: "Support Requests" },
  { key: "COMPLIMENT", label: "Compliments" },
  { key: "SPAM", label: "Spam" },
  { key: "VIP", label: "VIP Customers" },
  { key: "RETURNING", label: "Returning Customers" },
  { key: "INFLUENCER", label: "Potential Influencers" },
  { key: "OTHER", label: "Other" },
] as const;

export const SUGGESTION_KINDS = [
  { key: "REPLY", label: "Reply" },
  { key: "FOLLOW_UP", label: "Follow-up Question" },
  { key: "OFFER", label: "Offer" },
  { key: "DISCOUNT", label: "Discount Suggestion" },
  { key: "CTA", label: "CTA" },
  { key: "KNOWLEDGE", label: "Knowledge Base Answer" },
  { key: "ESCALATE", label: "Escalate to Human" },
] as const;

export const QUALITY_DIMENSIONS = [
  { key: "brandConsistency", label: "Brand Consistency" },
  { key: "clarity", label: "Clarity" },
  { key: "professionalism", label: "Professionalism" },
  { key: "empathy", label: "Empathy" },
  { key: "actionability", label: "Actionability" },
  { key: "confidence", label: "Confidence" },
] as const;

export const DEFAULT_AUTO_RULES = [
  {
    name: "FAQ assist",
    intentType: "QUESTION" as const,
    autoSend: false,
    template: "Acknowledge the question and answer only from Knowledge Base facts.",
  },
  {
    name: "Lead capture",
    intentType: "SALES_LEAD" as const,
    autoSend: false,
    template: "Qualify interest and offer a clear next step — never invent pricing.",
  },
  {
    name: "Complaint escalate",
    intentType: "COMPLAINT" as const,
    autoSend: false,
    template: "Empathize, avoid promises, escalate if unresolved.",
  },
  {
    name: "VIP notify",
    intentType: "VIP" as const,
    autoSend: false,
    template: "Prioritize with premium tone and notify the team.",
  },
];
