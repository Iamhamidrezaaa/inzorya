export const CAMPAIGN_STRATEGIES = [
  { key: "AWARENESS", label: "Awareness" },
  { key: "SALES", label: "Sales" },
  { key: "RETENTION", label: "Retention" },
  { key: "LAUNCH", label: "Launch" },
  { key: "PROMOTION", label: "Promotion" },
  { key: "COMMUNITY", label: "Community" },
  { key: "EDUCATION", label: "Education" },
  { key: "BRANDING", label: "Branding" },
  { key: "REFERRAL", label: "Referral" },
  { key: "SEASONAL", label: "Seasonal" },
] as const;

export const CAMPAIGN_SCENARIOS = [
  { key: "CONSERVATIVE", label: "Conservative" },
  { key: "BALANCED", label: "Balanced" },
  { key: "AGGRESSIVE", label: "Aggressive" },
] as const;

export const CAMPAIGN_REC_STATUSES = [
  { key: "PENDING", label: "Pending approval" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ARCHIVED", label: "Archived" },
  { key: "SENT_TO_PLANNER", label: "Sent to planner" },
] as const;

export const CAMPAIGN_REC_ACTIONS = [
  { key: "APPROVE", label: "Approve Campaign" },
  { key: "SEND_TO_PLANNER", label: "Send to Planner" },
  { key: "CREATE_TASKS", label: "Create Tasks" },
  { key: "SCHEDULE_REVIEW", label: "Schedule Review" },
  { key: "ARCHIVE", label: "Archive" },
  { key: "REJECT", label: "Reject" },
] as const;

/** Default eligibility — only high-value opportunities become proposals */
export const DEFAULT_ELIGIBILITY = {
  minScore: 61,
  minConfidence: 55,
  requirePreparationWindow: true,
  requireBusinessReady: true,
} as const;

export const COMPONENT_LABELS = [
  { key: "suggestedOffer", label: "Suggested Offer" },
  { key: "suggestedTheme", label: "Suggested Theme" },
  { key: "suggestedVisualDirection", label: "Visual Direction" },
  { key: "suggestedMessaging", label: "Messaging Direction" },
  { key: "suggestedCta", label: "CTA Direction" },
  { key: "suggestedLandingPage", label: "Landing Page" },
  { key: "suggestedEmail", label: "Email Structure" },
] as const;

export function strategyLabel(key: string) {
  return CAMPAIGN_STRATEGIES.find((s) => s.key === key)?.label || key;
}

export function scenarioLabel(key: string) {
  return CAMPAIGN_SCENARIOS.find((s) => s.key === key)?.label || key;
}
