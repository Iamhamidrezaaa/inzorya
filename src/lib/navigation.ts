import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  BriefcaseBusiness,
  Brain,
  CalendarDays,
  Clapperboard,
  Compass,
  FolderKanban,
  Headphones,
  History,
  Home,
  ImageIcon,
  Inbox,
  LayoutGrid,
  Library,
  LineChart,
  ListTodo,
  Crosshair,
  GitBranch,
  Layers3,
  Network,
  PenLine,
  Radar,
  Radio,
  Settings,
  Sparkles,
  Users,
  Workflow,
  ClipboardCheck,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export type NavBadges = {
  inbox?: number;
  knowledge?: number;
  content?: number;
  media?: number;
};

export type PrimaryNavLabels = {
  home: string;
  aiAssistant: string;
  calendar: string;
  content: string;
  analytics: string;
  workspace: string;
  settings: string;
};

export type AdvancedNavLabels = {
  businessBrain: string;
  strategy: string;
  aiContentPlanner: string;
  aiContentCreator: string;
  opportunities: string;
  communityManager: string;
  decisionCenter: string;
  taskEngine: string;
  knowledgeGraph: string;
  matchingEngine: string;
  campaignRecommendations: string;
  executionPipeline: string;
  inbox: string;
  contacts: string;
  channels: string;
  automations: string;
  business: string;
  knowledge: string;
  contentStudio: string;
  campaigns: string;
  media: string;
  activity: string;
};

/** Primary AI-first sidebar — 7 items max. */
export function getNavGroups(
  workspaceSlug: string,
  brandSlug?: string | null,
  badges: NavBadges = {},
  labels?: PrimaryNavLabels & Partial<AdvancedNavLabels> & Record<string, string>,
): NavGroup[] {
  const base = `/w/${workspaceSlug}`;
  const b = brandSlug ? `${base}/b/${brandSlug}` : base;
  const t = {
    home: labels?.home ?? "Home",
    aiAssistant: labels?.aiAssistant ?? labels?.aiStrategist ?? "AI Assistant",
    calendar: labels?.calendar ?? labels?.calendarIntelligence ?? "Calendar",
    content: labels?.content ?? "Content",
    analytics: labels?.analytics ?? "Analytics",
    workspace: labels?.workspace ?? "Workspace",
    settings: labels?.settings ?? "Settings",
  };

  return [
    {
      label: "",
      items: [
        { title: t.home, href: `${base}/home`, icon: Home },
        { title: t.aiAssistant, href: `${b}/strategist`, icon: Sparkles },
        { title: t.calendar, href: `${b}/calendar`, icon: CalendarDays },
        {
          title: t.content,
          href: `${b}/content`,
          icon: LayoutGrid,
          badge: badges.content,
        },
        {
          title: "Content Workspace",
          href: `${b}/content-workspace`,
          icon: ClipboardCheck,
        },
        { title: t.analytics, href: `${b}/analytics`, icon: LineChart },
        { title: t.workspace, href: `${b}/workspace`, icon: Briefcase },
        { title: t.settings, href: `${base}/settings`, icon: Settings },
      ],
    },
  ];
}

/** Hidden architecture modules — command palette / Workspace Advanced. */
export function getAdvancedNavItems(
  workspaceSlug: string,
  brandSlug?: string | null,
  badges: NavBadges = {},
  labels?: Partial<AdvancedNavLabels> & Record<string, string>,
): NavItem[] {
  const base = `/w/${workspaceSlug}`;
  const b = brandSlug ? `${base}/b/${brandSlug}` : base;
  const t = {
    businessBrain: labels?.businessBrain ?? "Business profile depth",
    strategy: labels?.strategy ?? "Strategy",
    aiContentPlanner: labels?.aiContentPlanner ?? "Content planner",
    aiContentCreator: labels?.aiContentCreator ?? "Content creator",
    opportunities: labels?.opportunities ?? "Opportunities",
    communityManager: labels?.communityManager ?? "Community",
    decisionCenter: labels?.decisionCenter ?? "Decisions",
    taskEngine: labels?.taskEngine ?? "Tasks",
    knowledgeGraph: labels?.knowledgeGraph ?? "Knowledge graph",
    matchingEngine: labels?.matchingEngine ?? "Matching",
    campaignRecommendations: labels?.campaignRecommendations ?? "Campaign ideas",
    executionPipeline: labels?.executionPipeline ?? "Pipeline",
    inbox: labels?.inbox ?? "Inbox",
    contacts: labels?.contacts ?? "Contacts",
    channels: labels?.channels ?? "Channels",
    automations: labels?.automations ?? "Automations",
    business: labels?.business ?? "Business",
    knowledge: labels?.knowledge ?? "Knowledge",
    contentStudio: labels?.contentStudio ?? "Studio",
    campaigns: labels?.campaigns ?? "Campaigns",
    media: labels?.media ?? "Media",
    activity: labels?.activity ?? "Activity",
  };

  return [
    { title: t.business, href: `${b}/business`, icon: Briefcase },
    { title: t.channels, href: `${b}/channels`, icon: Radio },
    {
      title: t.inbox,
      href: `${b}/inbox`,
      icon: Inbox,
      badge: badges.inbox,
    },
    { title: t.communityManager, href: `${b}/community`, icon: Headphones },
    { title: t.businessBrain, href: `${b}/brain`, icon: Brain },
    { title: t.strategy, href: `${b}/strategy`, icon: Compass },
    { title: t.aiContentPlanner, href: `${b}/planner`, icon: CalendarDays },
    { title: t.aiContentCreator, href: `${b}/creator`, icon: PenLine },
    {
      title: t.contentStudio,
      href: `${b}/studio`,
      icon: Clapperboard,
      badge: badges.content,
    },
    { title: t.opportunities, href: `${b}/opportunities`, icon: Radar },
    { title: t.decisionCenter, href: `${b}/decisions`, icon: BriefcaseBusiness },
    { title: t.taskEngine, href: `${b}/work`, icon: ListTodo },
    { title: t.knowledgeGraph, href: `${b}/knowledge-graph`, icon: Network },
    { title: t.matchingEngine, href: `${b}/matching`, icon: Crosshair },
    {
      title: t.campaignRecommendations,
      href: `${b}/recommendations`,
      icon: Layers3,
    },
    { title: t.executionPipeline, href: `${b}/pipeline`, icon: GitBranch },
    { title: t.contacts, href: `${b}/contacts`, icon: Users },
    { title: t.automations, href: `${b}/automations`, icon: Workflow },
    {
      title: t.knowledge,
      href: `${b}/knowledge`,
      icon: Library,
      badge: badges.knowledge,
    },
    { title: t.campaigns, href: `${b}/campaigns`, icon: FolderKanban },
    {
      title: t.media,
      href: `${b}/media`,
      icon: ImageIcon,
      badge: badges.media,
    },
    { title: t.activity, href: `${base}/activity`, icon: History },
  ];
}

export type PageMeta = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
};

export const pageCopy = {
  home: {
    title: "Home",
    description: "Your AI marketing coworker — start with a goal.",
    emptyTitle: "Ready when you are",
    emptyDescription: "Tell Inzorya what you want to accomplish today.",
  },
  inbox: {
    title: "Inbox",
    description: "Customer conversations across connected channels.",
    emptyTitle: "No conversations yet",
    emptyDescription:
      "When customers message you, threads appear here. Create a contact to start one manually.",
  },
  contacts: {
    title: "Contacts",
    description: "People you talk to across Instagram and other channels.",
    emptyTitle: "No contacts yet",
    emptyDescription: "Add a customer to start tracking conversations.",
  },
  channels: {
    title: "Channels",
    description: "Connect Instagram Business, Facebook Pages, and Messenger.",
    emptyTitle: "No channels connected",
    emptyDescription: "Start OAuth or sandbox connect to link a Meta account.",
  },
  strategy: {
    title: "Strategy",
    description: "Business understanding and marketing strategy workspace.",
    emptyTitle: "Start your strategy",
    emptyDescription:
      "Capture goals, audience, competitors, and pillars before any content is generated.",
  },
  strategist: {
    title: "AI Assistant",
    description: "Your AI marketing coworker — grounded in your business.",
    emptyTitle: "Ask anything",
    emptyDescription:
      "Describe a goal in plain language. Inzorya plans the next steps with you.",
  },
  planner: {
    title: "Content planner",
    description: "Strategic publishing plans from your business context.",
    emptyTitle: "Build a plan",
    emptyDescription:
      "Calendar-ready content plans — slots and titles, not captions yet.",
  },
  creator: {
    title: "Content creator",
    description: "Generate posts, captions, and creatives from your plan.",
    emptyTitle: "Create content",
    emptyDescription: "Turn plans into publish-ready drafts.",
  },
  opportunities: {
    title: "Opportunities",
    description: "Seasonal moments and campaign openings matched to you.",
    emptyTitle: "No opportunities yet",
    emptyDescription: "Scan the calendar for moments worth acting on.",
  },
  community: {
    title: "Community",
    description: "Reply intelligence for inbox conversations.",
    emptyTitle: "Inbox is quiet",
    emptyDescription: "When messages arrive, assist drafts appear here.",
  },
  decisions: {
    title: "Decisions",
    description: "Prioritized marketing decisions and trade-offs.",
    emptyTitle: "No open decisions",
    emptyDescription: "Ask the AI Assistant when you need a call.",
  },
  work: {
    title: "Tasks",
    description: "Execution checklist derived from plans and decisions.",
    emptyTitle: "No tasks yet",
    emptyDescription: "Tasks appear when you approve plans and campaigns.",
  },
  calendar: {
    title: "Calendar",
    description: "Seasonal and cultural moments for your markets.",
    emptyTitle: "Calendar ready",
    emptyDescription: "Moments and planned content land here.",
  },
  "knowledge-graph": {
    title: "Knowledge graph",
    description: "Connected facts about your brand and market.",
    emptyTitle: "Graph is empty",
    emptyDescription: "Knowledge grows as you teach Inzorya.",
  },
  matching: {
    title: "Matching",
    description: "Match moments and offers to your brand.",
    emptyTitle: "No matches yet",
    emptyDescription: "Run matching after calendar and brain are ready.",
  },
  recommendations: {
    title: "Campaign ideas",
    description: "Recommended campaigns from your context.",
    emptyTitle: "No ideas yet",
    emptyDescription: "Ask the AI Assistant for campaign directions.",
  },
  pipeline: {
    title: "Pipeline",
    description: "From idea to publish in one flow.",
    emptyTitle: "Pipeline empty",
    emptyDescription: "Approved work appears here as it moves.",
  },
  analytics: {
    title: "Analytics",
    description: "Performance signals across channels and content.",
    emptyTitle: "No analytics yet",
    emptyDescription: "Connect channels and publish to see trends.",
  },
  business: {
    title: "Business",
    description: "Core business profile for this brand.",
    emptyTitle: "Add business details",
    emptyDescription: "Profile fields power every AI recommendation.",
  },
  knowledge: {
    title: "Knowledge",
    description: "Documents and facts Inzorya can cite.",
    emptyTitle: "No knowledge yet",
    emptyDescription: "Upload docs or notes to ground answers.",
  },
  studio: {
    title: "Studio",
    description: "Drafts and assets ready to refine.",
    emptyTitle: "Studio is empty",
    emptyDescription: "Generated content lands here for editing.",
  },
  campaigns: {
    title: "Campaigns",
    description: "Campaign briefs and status.",
    emptyTitle: "No campaigns yet",
    emptyDescription: "Start from the AI Assistant or Content hub.",
  },
  media: {
    title: "Media",
    description: "Brand assets and creative library.",
    emptyTitle: "No media yet",
    emptyDescription: "Upload logos and product shots.",
  },
  automations: {
    title: "Automations",
    description: "Rules that run without you watching.",
    emptyTitle: "No automations",
    emptyDescription: "Add rules when you trust a repeatable flow.",
  },
  activity: {
    title: "Activity",
    description: "Recent workspace events.",
    emptyTitle: "No activity yet",
    emptyDescription: "Actions across the workspace show up here.",
  },
  settings: {
    title: "Settings",
    description: "Workspace preferences and members.",
    emptyTitle: "Settings",
    emptyDescription: "Manage how this workspace runs.",
  },
  brain: {
    title: "Business depth",
    description: "Deep interview Inzorya uses behind the scenes.",
    emptyTitle: "Add more context",
    emptyDescription: "Optional depth — AI already uses what you shared.",
  },
  content: {
    title: "Content",
    description: "Plan, create, and ship content from one place.",
    emptyTitle: "Start with a goal",
    emptyDescription: "Plan the week, generate posts, or open the studio.",
  },
  "content-approvals": {
    title: "Approvals",
    description: "Content waiting for review.",
    emptyTitle: "Nothing to approve",
    emptyDescription: "Approvals stay secondary to the inbox.",
  },
  workspace: {
    title: "Workspace",
    description: "Everyday tools and advanced controls.",
    emptyTitle: "Workspace",
    emptyDescription: "Channels, inbox, and deeper setup live here.",
  },
  brand: {
    title: "Brand",
    description: "Brand identity for this workspace.",
    emptyTitle: "Brand",
    emptyDescription: "Edit brand details from settings.",
  },
  "settings-workspace": {
    title: "Workspace settings",
    description: "Workspace name and preferences.",
    emptyTitle: "Workspace",
    emptyDescription: "Edit workspace details.",
  },
  "settings-brands": {
    title: "Brands",
    description: "Brand management.",
    emptyTitle: "Brands",
    emptyDescription: "Manage brands from brand settings.",
  },
  "settings-billing": {
    title: "Billing",
    description: "Billing comes later.",
    emptyTitle: "Not configured",
    emptyDescription: "Billing ships later.",
  },
  "settings-notifications": {
    title: "Notifications",
    description: "Notification preferences.",
    emptyTitle: "Defaults on",
    emptyDescription: "More toggles later.",
  },
  "settings-security": {
    title: "Security",
    description: "Security controls.",
    emptyTitle: "Security",
    emptyDescription: "Expands later.",
  },
  "settings-api": {
    title: "API",
    description: "API keys later.",
    emptyTitle: "No keys",
    emptyDescription: "API access ships later.",
  },
  "knowledge-sources": {
    title: "Sources",
    description: "Imported knowledge sources.",
    emptyTitle: "No sources",
    emptyDescription: "Sources expand later.",
  },
  "knowledge-ask": {
    title: "Ask knowledge",
    description: "Retrieval with AI later.",
    emptyTitle: "Coming soon",
    emptyDescription: "Not in this sprint.",
  },
  "automation-runs": {
    title: "Runs",
    description: "Execution history for workflows.",
    emptyTitle: "No runs yet",
    emptyDescription: "Design flows today — execution comes later.",
  },
  agents: {
    title: "AI Agents",
    description: "Reserved. No agents in this sprint.",
    emptyTitle: "Not available yet",
    emptyDescription: "Agents come after the conversation foundation.",
  },
  tasks: {
    title: "Tasks",
    description: "Reserved.",
    emptyTitle: "Not available yet",
    emptyDescription: "Inbox is the priority.",
  },
  team: {
    title: "Team",
    description: "Members and roles.",
    emptyTitle: "Team",
    emptyDescription: "Invite flow comes later.",
  },
  "team-roles": {
    title: "Roles",
    description: "Permission roles.",
    emptyTitle: "Default roles",
    emptyDescription: "Custom roles later.",
  },
  "team-invites": {
    title: "Invites",
    description: "Pending invites.",
    emptyTitle: "No invites",
    emptyDescription: "Invites ship later.",
  },
  integrations: {
    title: "Integrations",
    description: "Moved to Channels.",
    emptyTitle: "Use Channels",
    emptyDescription: "Connect Instagram and other channels from Channels.",
  },
  "integrations-catalog": {
    title: "Catalog",
    description: "Use Channels instead.",
    emptyTitle: "Use Channels",
    emptyDescription: "Channel cards live under Channels.",
  },
} as const;
