export const TASK_TYPES = [
  { key: "CONTENT_CREATION", label: "Content Creation" },
  { key: "DESIGN", label: "Design" },
  { key: "VIDEO_EDITING", label: "Video Editing" },
  { key: "COPYWRITING", label: "Copywriting" },
  { key: "APPROVAL", label: "Approval" },
  { key: "PUBLISHING", label: "Publishing" },
  { key: "CAMPAIGN_SETUP", label: "Campaign Setup" },
  { key: "FOLLOW_UP", label: "Follow-up" },
  { key: "MEETING", label: "Meeting" },
  { key: "RESEARCH", label: "Research" },
  { key: "CUSTOMER_RESPONSE", label: "Customer Response" },
  { key: "CUSTOM", label: "Custom" },
] as const;

export const TASK_STATUSES = [
  { key: "TODO", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "BLOCKED", label: "Blocked" },
  { key: "IN_REVIEW", label: "In review" },
  { key: "DONE", label: "Done" },
  { key: "ARCHIVED", label: "Archived" },
] as const;

export const TASK_PRIORITIES = [
  { key: "LOW", label: "Low" },
  { key: "MEDIUM", label: "Medium" },
  { key: "HIGH", label: "High" },
  { key: "URGENT", label: "Urgent" },
] as const;

export const TASK_SOURCES = [
  { key: "STRATEGIST", label: "AI Strategist" },
  { key: "PLANNER", label: "Content Planner" },
  { key: "CREATOR", label: "Content Creator" },
  { key: "OPPORTUNITY", label: "Opportunity Engine" },
  { key: "COMMUNITY", label: "Community Manager" },
  { key: "CRM", label: "CRM" },
  { key: "ANALYTICS", label: "Analytics" },
  { key: "DECISION_CENTER", label: "Decision Center" },
  { key: "MANUAL", label: "Manual" },
] as const;

export const PROJECT_HEALTH = [
  { key: "HEALTHY", label: "Healthy" },
  { key: "AT_RISK", label: "At Risk" },
  { key: "DELAYED", label: "Delayed" },
  { key: "BLOCKED", label: "Blocked" },
  { key: "COMPLETED", label: "Completed" },
] as const;

export const WORK_VIEWS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "list", label: "List" },
  { key: "kanban", label: "Kanban" },
  { key: "table", label: "Table" },
] as const;

export const KANBAN_COLUMNS = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
] as const;

export function taskTypeLabel(key: string) {
  return TASK_TYPES.find((t) => t.key === key)?.label || key;
}

export function taskStatusLabel(key: string) {
  return TASK_STATUSES.find((t) => t.key === key)?.label || key;
}

export function priorityRank(p: string) {
  switch (p) {
    case "URGENT":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    default:
      return 1;
  }
}
