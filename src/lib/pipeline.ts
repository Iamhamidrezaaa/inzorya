export const WORKFLOW_STATUSES = [
  { key: "DRAFT", label: "Draft" },
  { key: "PLANNING", label: "Planning" },
  { key: "READY", label: "Ready" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "WAITING_APPROVAL", label: "Waiting Approval" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "PUBLISHED", label: "Published" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ARCHIVED", label: "Archived" },
] as const;

export const WORKFLOW_TIMELINE_KINDS = [
  { key: "PLANNING", label: "Planning" },
  { key: "PUBLISHING", label: "Publishing" },
  { key: "REVIEW", label: "Review" },
  { key: "APPROVAL", label: "Approval" },
  { key: "REMINDER", label: "Reminder" },
] as const;

export const PIPELINE_STAGES = [
  { key: "event", label: "Marketing Event" },
  { key: "graph", label: "Knowledge Graph" },
  { key: "match", label: "Opportunity Matching" },
  { key: "recommend", label: "Campaign Recommendation" },
  { key: "planner", label: "Planner" },
  { key: "content_plan", label: "Content Plan" },
  { key: "creator", label: "Content Creator" },
  { key: "approval", label: "Approval" },
  { key: "tasks", label: "Task Engine" },
  { key: "publishing", label: "Publishing" },
  { key: "analytics", label: "Analytics" },
] as const;

export function workflowStatusLabel(key: string) {
  return WORKFLOW_STATUSES.find((s) => s.key === key)?.label || key;
}

export function addUtcDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
