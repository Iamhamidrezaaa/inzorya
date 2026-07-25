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
  Library,
  LineChart,
  PenLine,
  Radar,
  Radio,
  Settings,
  Sparkles,
  Users,
  Workflow,
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

export function getNavGroups(
  workspaceSlug: string,
  brandSlug?: string | null,
  badges: NavBadges = {},
): NavGroup[] {
  const base = `/w/${workspaceSlug}`;
  const b = brandSlug ? `${base}/b/${brandSlug}` : base;

  return [
    {
      label: "Operate",
      items: [
        { title: "Home", href: `${base}/home`, icon: Home },
        { title: "Business Brain", href: `${b}/brain`, icon: Brain },
        { title: "Strategy", href: `${b}/strategy`, icon: Compass },
        { title: "AI Strategist", href: `${b}/strategist`, icon: Sparkles },
        { title: "AI Content Planner", href: `${b}/planner`, icon: CalendarDays },
        { title: "AI Content Creator", href: `${b}/creator`, icon: PenLine },
        { title: "Opportunities", href: `${b}/opportunities`, icon: Radar },
        { title: "Community Manager", href: `${b}/community`, icon: Headphones },
        {
          title: "Decision Center",
          href: `${b}/decisions`,
          icon: BriefcaseBusiness,
        },
        {
          title: "Inbox",
          href: `${b}/inbox`,
          icon: Inbox,
          badge: badges.inbox,
        },
        { title: "Contacts", href: `${b}/contacts`, icon: Users },
        { title: "Channels", href: `${b}/channels`, icon: Radio },
        { title: "Automations", href: `${b}/automations`, icon: Workflow },
        { title: "Analytics", href: `${b}/analytics`, icon: LineChart },
      ],
    },
    {
      label: "Brand",
      items: [
        { title: "Business", href: `${b}/business`, icon: Briefcase },
        {
          title: "Knowledge",
          href: `${b}/knowledge`,
          icon: Library,
          badge: badges.knowledge,
        },
        {
          title: "Content Studio",
          href: `${b}/studio`,
          icon: Clapperboard,
          badge: badges.content,
        },
        { title: "Campaigns", href: `${b}/campaigns`, icon: FolderKanban },
        {
          title: "Media",
          href: `${b}/media`,
          icon: ImageIcon,
          badge: badges.media,
        },
      ],
    },
    {
      label: "System",
      items: [
        { title: "Activity", href: `${base}/activity`, icon: History },
        { title: "Settings", href: `${base}/settings`, icon: Settings },
      ],
    },
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
    description: "Conversation overview for this workspace.",
    emptyTitle: "Your inbox is ready",
    emptyDescription: "Connect a channel and conversations will land here.",
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
    title: "AI Strategist",
    description: "Senior marketing strategist grounded in your business context.",
    emptyTitle: "Ask your strategist",
    emptyDescription:
      "Skip prompt engineering — ask in plain language and decide with structured advice.",
  },
  planner: {
    title: "AI Content Planner",
    description: "Strategic publishing plans from business intelligence.",
    emptyTitle: "Generate a plan",
    emptyDescription:
      "Build calendar-ready content plans — titles and slots only, never captions.",
  },
  creator: {
    title: "AI Content Creator",
    description: "Context-aware content production with scored variations.",
    emptyTitle: "Generate content",
    emptyDescription:
      "Choose platform, objective, campaign and type — business context does the rest.",
  },
  opportunities: {
    title: "Opportunity Intelligence",
    description: "Proactive marketing opportunities matched to your business.",
    emptyTitle: "Scan for opportunities",
    emptyDescription:
      "Discover high-signal moments before they arrive — never a raw holiday dump.",
  },
  community: {
    title: "AI Community Manager",
    description: "Prioritized conversations with brand-safe reply assistance.",
    emptyTitle: "Scan your inbox",
    emptyDescription:
      "Classify intent, rank urgency, and draft replies — never blind auto-send.",
  },
  decisions: {
    title: "AI Marketing Decision Center",
    description: "Morning executive brain — only the decisions that matter today.",
    emptyTitle: "Generate today's brief",
    emptyDescription:
      "Surface priorities, risks, and recommended actions — not another metrics dump.",
  },
  brain: {
    title: "Business Brain",
    description: "Structured business knowledge captured through interview.",
    emptyTitle: "Start the interview",
    emptyDescription:
      "Teach Inzorya who you are — one question at a time.",
  },
  knowledge: {
    title: "Knowledge",
    description: "The source of truth your team (and future AI) will use.",
    emptyTitle: "No knowledge yet",
    emptyDescription: "Add documents so replies stay on-brand.",
  },
  "knowledge-sources": {
    title: "Sources",
    description: "Imported knowledge sources.",
    emptyTitle: "No sources",
    emptyDescription: "Sources can expand later.",
  },
  "knowledge-ask": {
    title: "Ask Knowledge",
    description: "Reserved for later AI retrieval.",
    emptyTitle: "Coming later",
    emptyDescription: "No AI in this sprint.",
  },
  content: {
    title: "Content",
    description: "Redirects to Content Studio.",
    emptyTitle: "Open Content Studio",
    emptyDescription: "Manage the full content pipeline in Studio.",
  },
  studio: {
    title: "Content Studio",
    description: "Ideas to published — production workflow for content.",
    emptyTitle: "Capture your first idea",
    emptyDescription:
      "Move content through research, brief, draft, review, and publish.",
  },
  "content-approvals": {
    title: "Approvals",
    description: "Content waiting for review.",
    emptyTitle: "Nothing to approve",
    emptyDescription: "Approvals stay secondary to inbox.",
  },
  campaigns: {
    title: "Campaigns",
    description: "Campaign shells for later outreach work.",
    emptyTitle: "No campaigns yet",
    emptyDescription: "Campaigns are secondary. Conversations are the product.",
  },
  media: {
    title: "Media",
    description: "Images for replies and content.",
    emptyTitle: "Media library is empty",
    emptyDescription: "Upload images to reuse in conversations and content.",
  },
  analytics: {
    title: "Analytics",
    description: "KPIs, engagement, audience, content, and campaign performance.",
    emptyTitle: "No analytics yet",
    emptyDescription: "Connect channels later — mock analytics are available today.",
  },
  automations: {
    title: "Automations",
    description: "Visual marketing workflows — triggers, conditions, and actions.",
    emptyTitle: "No automations yet",
    emptyDescription: "Create a workflow or start from a template.",
  },
  "automation-runs": {
    title: "Runs",
    description: "Mocked execution history for designed workflows.",
    emptyTitle: "No runs yet",
    emptyDescription: "Execution engine ships later — design flows today.",
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
  calendar: {
    title: "Calendar",
    description: "Reserved.",
    emptyTitle: "Not available yet",
    emptyDescription: "Conversations first.",
  },
  brand: {
    title: "Brand",
    description: "Identity and voice for this brand.",
    emptyTitle: "Define brand",
    emptyDescription: "Complete brand profile.",
  },
  workspace: {
    title: "Workspace",
    description: "Workspace overview.",
    emptyTitle: "Workspace ready",
    emptyDescription: "Use Settings for workspace configuration.",
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
  settings: {
    title: "Settings",
    description: "Profile, workspace, and brand.",
    emptyTitle: "Settings",
    emptyDescription: "Manage how Inzorya is configured for your team.",
  },
  activity: {
    title: "Activity",
    description: "Workspace timeline of meaningful changes.",
    emptyTitle: "No activity yet",
    emptyDescription: "Updates across business, channels, and strategy appear here.",
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
    emptyDescription: "Manage brands from Brand settings.",
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
    emptyDescription: "Expand later.",
  },
  "settings-api": {
    title: "API",
    description: "API keys later.",
    emptyTitle: "No keys",
    emptyDescription: "API access ships later.",
  },
} as const satisfies Record<string, PageMeta>;
