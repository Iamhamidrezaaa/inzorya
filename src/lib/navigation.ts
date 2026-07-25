import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  FileText,
  FolderKanban,
  Home,
  ImageIcon,
  Library,
  ListTodo,
  Plug,
  Settings,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  brandScoped?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export function getNavGroups(
  workspaceSlug: string,
  brandSlug?: string | null,
): NavGroup[] {
  const base = `/w/${workspaceSlug}`;
  const brandBase = brandSlug ? `${base}/b/${brandSlug}` : null;

  return [
    {
      label: "Home",
      items: [{ title: "Home", href: `${base}/home`, icon: Home }],
    },
    {
      label: "Operate",
      items: [
        { title: "Workspace", href: `${base}/workspace`, icon: Building2 },
        {
          title: "Brand",
          href: brandBase ? `${brandBase}/brand` : `${base}/workspace`,
          icon: Sparkles,
          brandScoped: true,
        },
        {
          title: "Knowledge",
          href: brandBase ? `${brandBase}/knowledge` : `${base}/workspace`,
          icon: Library,
          brandScoped: true,
        },
        {
          title: "Campaigns",
          href: brandBase ? `${brandBase}/campaigns` : `${base}/workspace`,
          icon: FolderKanban,
          brandScoped: true,
        },
        {
          title: "Content",
          href: brandBase ? `${brandBase}/content` : `${base}/workspace`,
          icon: FileText,
          brandScoped: true,
        },
        {
          title: "Media",
          href: brandBase ? `${brandBase}/media` : `${base}/workspace`,
          icon: ImageIcon,
          brandScoped: true,
        },
        {
          title: "Calendar",
          href: brandBase ? `${brandBase}/calendar` : `${base}/workspace`,
          icon: CalendarDays,
          brandScoped: true,
        },
      ],
    },
    {
      label: "Intelligence",
      items: [
        {
          title: "Analytics",
          href: brandBase ? `${brandBase}/analytics` : `${base}/workspace`,
          icon: BarChart3,
          brandScoped: true,
        },
        {
          title: "Automations",
          href: brandBase ? `${brandBase}/automations` : `${base}/workspace`,
          icon: Workflow,
          brandScoped: true,
        },
        {
          title: "AI Agents",
          href: brandBase ? `${brandBase}/agents` : `${base}/workspace`,
          icon: Bot,
          brandScoped: true,
        },
        {
          title: "Tasks",
          href: brandBase ? `${brandBase}/tasks` : `${base}/workspace`,
          icon: ListTodo,
          brandScoped: true,
        },
      ],
    },
    {
      label: "Organize",
      items: [
        { title: "Team", href: `${base}/team`, icon: Users },
        { title: "Integrations", href: `${base}/integrations`, icon: Plug },
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
    description: "What needs attention across your workspace today.",
    emptyTitle: "Your operating overview is ready",
    emptyDescription:
      "Focus items, approvals, and automation health will appear here as you build campaigns and content.",
  },
  workspace: {
    title: "Workspace",
    description: "Health, brands, and collaboration for this workspace.",
    emptyTitle: "Workspace is set up",
    emptyDescription:
      "Add brands, invite teammates, and connect channels to populate workspace health.",
  },
  brand: {
    title: "Brand",
    description: "Identity, voice, channels, and guidelines for this brand.",
    emptyTitle: "Define this brand",
    emptyDescription:
      "Brand profile, channels, and guidelines will live here so every surface stays on-message.",
  },
  knowledge: {
    title: "Knowledge",
    description: "The source of truth your operating system will run on.",
    emptyTitle: "No knowledge yet",
    emptyDescription:
      "Add documents and sources so Inzorya stays aligned with your brand facts and claims.",
  },
  "knowledge-sources": {
    title: "Sources",
    description: "Imported and linked knowledge sources for this brand.",
    emptyTitle: "No sources connected",
    emptyDescription: "Import docs, URLs, and files that ground brand knowledge.",
  },
  "knowledge-ask": {
    title: "Ask Knowledge",
    description: "Query your brand knowledge base. AI responses ship in a later sprint.",
    emptyTitle: "Ask is reserved",
    emptyDescription:
      "This surface is ready for retrieval once knowledge and AI foundations are connected.",
  },
  campaigns: {
    title: "Campaigns",
    description: "Plan and operate marketing campaigns as first-class projects.",
    emptyTitle: "No campaigns yet",
    emptyDescription:
      "Create a campaign to turn strategy into scheduled work across channels.",
  },
  content: {
    title: "Content",
    description: "Library of drafts, approvals, scheduled, and published pieces.",
    emptyTitle: "No content yet",
    emptyDescription: "Create your first piece or open the approvals queue when work arrives.",
  },
  "content-approvals": {
    title: "Approvals",
    description: "Content waiting for review before it can move forward.",
    emptyTitle: "Nothing to approve",
    emptyDescription: "When teammates submit content for review, it will appear here.",
  },
  media: {
    title: "Media",
    description: "Images, video, audio, and brand files for this brand.",
    emptyTitle: "Media library is empty",
    emptyDescription: "Upload assets once. Reuse them across campaigns and content.",
  },
  calendar: {
    title: "Calendar",
    description: "Time view of scheduled content and campaign milestones.",
    emptyTitle: "Nothing scheduled",
    emptyDescription: "Scheduled content will appear on this calendar as you publish plans.",
  },
  analytics: {
    title: "Analytics",
    description: "Performance across campaigns, content, and channels.",
    emptyTitle: "No analytics yet",
    emptyDescription:
      "Connect channels and publish content to unlock performance views. No placeholder charts.",
  },
  automations: {
    title: "Automations",
    description: "Workflows that move work from trigger to action.",
    emptyTitle: "No automations yet",
    emptyDescription: "Define triggers and actions when you are ready to operationalize marketing.",
  },
  "automation-runs": {
    title: "Automation runs",
    description: "Operational history for automation executions.",
    emptyTitle: "No runs yet",
    emptyDescription: "Run history will appear here once automations execute.",
  },
  agents: {
    title: "AI Agents",
    description: "Agent roster and workspaces. Inference ships in a later epic.",
    emptyTitle: "Agents are reserved",
    emptyDescription:
      "This route is part of the operating system shell. Agent logic will plug in without reshaping navigation.",
  },
  tasks: {
    title: "Tasks",
    description: "Human work queue tied to campaigns, content, and approvals.",
    emptyTitle: "No tasks yet",
    emptyDescription: "Capture work so nothing lives only in chat or email.",
  },
  team: {
    title: "Team",
    description: "Members, roles, and invites for this workspace.",
    emptyTitle: "You are the first member",
    emptyDescription: "Invite editors and viewers when you are ready to collaborate.",
  },
  "team-roles": {
    title: "Roles",
    description: "Permissions for owners, admins, editors, and viewers.",
    emptyTitle: "Default roles are active",
    emptyDescription: "Custom role matrices can expand here without changing the shell.",
  },
  "team-invites": {
    title: "Invites",
    description: "Pending invitations to this workspace.",
    emptyTitle: "No pending invites",
    emptyDescription: "Invites you send will appear here until they are accepted.",
  },
  integrations: {
    title: "Integrations",
    description: "Connected apps and channel health for this workspace.",
    emptyTitle: "No integrations connected",
    emptyDescription: "Browse the catalog and connect the channels your brands publish to.",
  },
  "integrations-catalog": {
    title: "Catalog",
    description: "Available integrations you can connect.",
    emptyTitle: "Catalog will grow here",
    emptyDescription:
      "Integration cards will list available connectors. Connection flows ship with the integrations epic.",
  },
  settings: {
    title: "Settings",
    description: "Workspace configuration, brands, billing, and security.",
    emptyTitle: "Settings are available",
    emptyDescription: "Choose a settings section to configure this workspace.",
  },
  "settings-workspace": {
    title: "Workspace settings",
    description: "Name, slug, and workspace-level preferences.",
    emptyTitle: "Workspace settings",
    emptyDescription: "Editable workspace fields will live in this form surface.",
  },
  "settings-brands": {
    title: "Brand management",
    description: "Create, archive, and organize brands in this workspace.",
    emptyTitle: "Manage brands here",
    emptyDescription: "Brand list management expands from the onboarding create flow.",
  },
  "settings-billing": {
    title: "Billing",
    description: "Plans and invoices. Billing providers connect later.",
    emptyTitle: "Billing is not configured",
    emptyDescription: "Seat-based billing will attach to the workspace tenant boundary.",
  },
  "settings-notifications": {
    title: "Notification preferences",
    description: "Choose which workspace events reach you.",
    emptyTitle: "Defaults are on",
    emptyDescription: "Granular notification toggles will appear in this settings section.",
  },
  "settings-security": {
    title: "Security",
    description: "Sessions, password, and access controls.",
    emptyTitle: "Security controls",
    emptyDescription: "Session management and security options expand here.",
  },
  "settings-api": {
    title: "API",
    description: "API keys and webhooks for programmatic access.",
    emptyTitle: "No API keys yet",
    emptyDescription: "Keys and webhook endpoints will be issued from this surface.",
  },
} as const satisfies Record<string, PageMeta>;
