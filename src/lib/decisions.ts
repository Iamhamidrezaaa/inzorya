export const DECISION_TYPES = [
  { key: "INCREASE_BUDGET", label: "Increase Budget" },
  { key: "PAUSE_CAMPAIGN", label: "Pause Campaign" },
  { key: "PUBLISH_EARLIER", label: "Publish Earlier" },
  { key: "DELAY_CAMPAIGN", label: "Delay Campaign" },
  { key: "CREATE_PROMOTION", label: "Create Promotion" },
  { key: "LAUNCH_GIVEAWAY", label: "Launch Giveaway" },
  { key: "ANSWER_VIP", label: "Answer VIP Customers" },
  { key: "BOOST_CONTENT", label: "Boost High Performing Content" },
  { key: "ARCHIVE_CONTENT", label: "Archive Low Performing Content" },
  { key: "UPDATE_LANDING_PAGE", label: "Update Landing Page" },
  { key: "RUN_AB_TEST", label: "Run A/B Test" },
  { key: "CREATE_REEL", label: "Create New Reel" },
  { key: "PUBLISH_STORY", label: "Publish Story" },
  { key: "OTHER", label: "Other" },
] as const;

export const DECISION_STATUSES = [
  { key: "PENDING", label: "Needs attention" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "POSTPONED", label: "Postponed" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "COMPLETED", label: "Completed" },
] as const;

export const DECISION_ACTIONS = [
  { key: "APPROVE", label: "Approve" },
  { key: "REJECT", label: "Reject" },
  { key: "POSTPONE", label: "Postpone" },
  { key: "ASSIGN", label: "Assign" },
  { key: "CONVERT_CAMPAIGN", label: "Convert to Campaign" },
  { key: "GENERATE_CONTENT", label: "Generate Content" },
  { key: "GENERATE_BRIEF", label: "Generate Brief" },
  { key: "SCHEDULE", label: "Schedule" },
  { key: "CREATE_TASK", label: "Create Task" },
] as const;

export const SCORE_KEYS = [
  { key: "priority", label: "Priority" },
  { key: "confidence", label: "Confidence" },
  { key: "businessImpact", label: "Business Impact" },
  { key: "expectedRoi", label: "Expected ROI" },
  { key: "effort", label: "Effort" },
  { key: "urgency", label: "Urgency" },
] as const;

export const FOCUS_BUCKETS = [
  { key: "attention", label: "Needs attention" },
  { key: "wait", label: "Can wait" },
  { key: "blocked", label: "Blocked" },
  { key: "next", label: "Should happen next" },
] as const;

export function decisionTypeLabel(type: string) {
  return DECISION_TYPES.find((t) => t.key === type)?.label || type;
}

export function focusBucket(rec: {
  status: string;
  urgency: number;
  priority: number;
  postponedUntil?: string | Date | null;
}) {
  if (rec.status === "POSTPONED" || rec.postponedUntil) return "wait" as const;
  if (rec.status === "ASSIGNED") return "blocked" as const;
  if (rec.urgency >= 80 || rec.priority >= 85) return "attention" as const;
  if (rec.urgency >= 60 || rec.priority >= 65) return "next" as const;
  return "wait" as const;
}
