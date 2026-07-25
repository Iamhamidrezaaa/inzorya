import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  FileText,
  FolderKanban,
  Home,
  ImageIcon,
  Inbox,
  Library,
  Radio,
  Settings,
  Users,
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
        {
          title: "Inbox",
          href: `${b}/inbox`,
          icon: Inbox,
          badge: badges.inbox,
        },
        { title: "Contacts", href: `${b}/contacts`, icon: Users },
        { title: "Channels", href: `${b}/channels`, icon: Radio },
        { title: "Business", href: `${b}/business`, icon: Briefcase },
        {
          title: "Knowledge",
          href: `${b}/knowledge`,
          icon: Library,
          badge: badges.knowledge,
        },
        {
          title: "Content",
          href: `${b}/content`,
          icon: FileText,
          badge: badges.content,
        },
        { title: "Campaigns", href: `${b}/campaigns`, icon: FolderKanban },
        {
          title: "Media",
          href: `${b}/media`,
          icon: ImageIcon,
          badge: badges.media,
        },
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
    description: "Connect the places customers reach you.",
    emptyTitle: "No channels connected",
    emptyDescription: "Mark a channel as connected to prepare for inbox routing.",
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
    description: "Supporting content library — secondary to conversations.",
    emptyTitle: "No content yet",
    emptyDescription: "Create drafts when you need them. Inbox comes first.",
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
    description: "Reserved. Not part of this sprint.",
    emptyTitle: "Not available yet",
    emptyDescription: "Focus on inbox first.",
  },
  automations: {
    title: "Automations",
    description: "Reserved. No automation logic yet.",
    emptyTitle: "Not available yet",
    emptyDescription: "Automations ship later.",
  },
  "automation-runs": {
    title: "Runs",
    description: "Reserved.",
    emptyTitle: "Not available yet",
    emptyDescription: "No runs yet.",
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
