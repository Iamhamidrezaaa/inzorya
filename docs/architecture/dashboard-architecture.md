# Inzorya Dashboard Architecture

**Status:** Foundation design — v1 (pre-implementation)  
**Product:** Inzorya — AI Marketing Operating System  
**Audience:** Product, Design, Engineering  
**Scope:** Authenticated dashboard IA, layout system, page contracts, technical skeleton  
**Out of scope:** AI agent logic, marketing automation business rules, integrations implementations

---

## 0. Product Positioning (Design North Star)

Inzorya is **not** a social scheduler. It is an **AI Marketing Operating System**.

| Inzorya is like | Inzorya is not like |
|-----------------|---------------------|
| Notion (workspace + knowledge) | Hootsuite |
| Linear (speed + keyboard + clarity) | Buffer |
| Stripe Dashboard (trust + density with calm) | Later |
| Cursor (AI as first-class surface) | Generic “posts calendar” tools |
| Vercel (ops clarity, empty states, polish) | Feature-farm marketing SaaS |

**Implication for IA:** Navigation is organized around *operating a marketing system* (brand, knowledge, campaigns, content, automations, agents, analytics) — not around “schedule a post.”

**Landing page:** Intentionally minimal. The product lives inside the authenticated app.

---

## 1. Design Principles (Non-Negotiable)

| Principle | Product meaning |
|-----------|-----------------|
| Minimal | One primary job per page. No decorative chrome. |
| Premium | Quiet typography, generous spacing, restrained accent. Dark-first. |
| Functional | Every control exists to complete a job. |
| AI-first | AI surfaces are first-class routes and panels — not a bolted chatbot. |
| Workspace-first | All data is scoped to Workspace → Brand. |
| Keyboard friendly | Command palette, shortcuts, focus rings, list navigation. |
| Responsive | Desktop-primary density; tablet/mobile keep core flows usable. |
| Beautiful empty states | Empty = onboarding, not failure. |
| Skeleton loading | Prefer skeletons over spinners for layout stability. |
| Accessible | WCAG 2.2 AA target; keyboard + screen reader first-class. |
| Production ready | Typed routes, error boundaries, optimistic UX, undo where safe. |

### UX Rules (Interaction Contract)

1. **No unnecessary modals.** Confirm destructive actions only. Prefer **side panels** (Sheet) for create/edit/detail.
2. **Prefer inline editing** for names, status, assignees, dates.
3. **Optimistic updates** for toggles, renames, status changes; roll back on error.
4. **Keyboard shortcuts** documented in Command Palette (`⌘K` / `Ctrl+K`).
5. **Command palette** is the universal router + action runner.
6. **Undo** via toast action for reversible mutations (archive, move, status change).

---

## 2. Mental Model & Domain Hierarchy

```
Organization (billing / seats — future)
  └── Workspace (primary tenant boundary for v1)
        └── Brand(s) (identity, voice, assets, channels)
              ├── Knowledge
              ├── Campaigns
              ├── Content
              ├── Media
              ├── Calendar
              ├── Analytics
              ├── Automations
              ├── AI Agents
              └── Tasks
```

**Why Workspace-first, not Brand-first in nav root?**  
Operators often manage multiple brands inside one agency or company. Workspace is the collaboration + billing + members boundary. Brand is the *operating context* selected inside a workspace (sticky in URL + switcher).

**URL truth:** Brand context is always reflected in the path or a stable search param. Prefer path for shareability:

```
/w/[workspaceSlug]/b/[brandSlug]/...
```

Legacy-friendly alternate (if multi-brand overview needed):

```
/w/[workspaceSlug]/home          → cross-brand executive view
/w/[workspaceSlug]/b/[brandSlug]/campaigns
```

---

## 3. Dashboard Shell Layout

### 3.1 Frame Composition

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOP BAR                                                                   │
│ [Workspace Switcher] [Brand Switcher]  [Breadcrumbs]   [Search] [Bell] [User] │
├────────────┬─────────────────────────────────────────────────────────────┤
│ SIDEBAR    │ MAIN                                                         │
│            │  ┌─ Page Header (title + primary/secondary actions) ───────┐ │
│  Nav       │  │                                                         │ │
│  groups    │  │  Page content                                            │ │
│            │  │                                                         │ │
│            │  └─────────────────────────────────────────────────────────┘ │
│            │                                                              │
│  ────────  │  RIGHT PANEL (optional, route-driven or ephemeral)           │
│  Settings  │  width: 360–480px                                            │
│  Collapse  │                                                              │
└────────────┴──────────────────────────────────────────────────────────────┘
│ COMMAND PALETTE (overlay) · TOASTS · UNDO STACK                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Regions & Responsibilities

| Region | Responsibility | Must not |
|--------|----------------|----------|
| **Sidebar** | Primary IA navigation | Show feature ads, badges spam, nested 4-level trees |
| **Top bar** | Context (workspace/brand), location (breadcrumbs), global utilities | Become a second nav with feature links |
| **Page header** | Page purpose + actions | Duplicate sidebar items |
| **Main** | Single job | Mix unrelated widgets without hierarchy |
| **Side panel** | Detail / create / edit without route loss | Replace full-page for deep multi-step wizards when a dedicated route is clearer |
| **Command palette** | Global search + actions + navigation | Become a dumping ground for every obscure setting |

### 3.3 Top Bar Spec

| Element | Behavior | Decision rationale |
|---------|----------|--------------------|
| **Workspace switcher** | Dropdown / popover; recent workspaces; “Create workspace” | Tenant boundary must be 1 click away (Linear/Vercel pattern) |
| **Brand switcher** | Adjacent to workspace; scoped to current workspace | Brand is operating context, not a buried settings field |
| **Breadcrumbs** | Workspace › Brand › Section › Entity | Orientation for deep entities (campaign → content piece) |
| **Search** | Opens Command Palette focused on search mode | One search surface — don’t maintain two search UIs |
| **Notifications** | Bell → panel (not modal); unread count | Side panel keeps user in context |
| **User menu** | Profile, preferences, theme, keyboard shortcuts, sign out | Account concerns stay out of product nav |

### 3.4 Sidebar Spec

- **Collapsed** (icon-only) and **expanded** (label) modes; persist preference per user.
- **Mobile:** drawer overlay; top bar hamburger.
- **Sections** (visual grouping, not nested routes):

```
HOME
  Home

OPERATE
  Workspace
  Brand
  Knowledge
  Campaigns
  Content
  Media
  Calendar

INTELLIGENCE
  Analytics
  Automations
  AI Agents
  Tasks

ORGANIZE
  Team
  Integrations
  Settings
```

**Why grouped?** Fifteen flat items without grouping become noise. Three named bands match operator mental models: *run work*, *run systems*, *run the company*.

**Active state:** Exact match for leaf routes; section highlight for nested children.

**Badges:** Only for *actionable* counts (Pending approvals, Failed automations). Never decorative.

---

## 4. Navigation Tree (Canonical)

```
/w/[workspaceSlug]
├── /home                              Home (executive overview)
├── /workspace                         Workspace overview & health
├── /b/[brandSlug]
│   ├── /                              Brand overview (redirect or overview)
│   ├── /brand                         Brand identity & channels
│   ├── /knowledge
│   │   ├── /                          Knowledge hub
│   │   ├── /sources                   Sources library
│   │   ├── /[docId]                   Document
│   │   └── /ask                       Ask knowledge (UI shell only — no AI impl yet)
│   ├── /campaigns
│   │   ├── /                          Campaign list
│   │   ├── /new                       Create (or panel)
│   │   └── /[campaignId]
│   │       ├── /                      Overview
│   │       ├── /content               Campaign content
│   │       ├── /timeline              Timeline
│   │       └── /settings              Campaign settings
│   ├── /content
│   │   ├── /                          Content library
│   │   ├── /[contentId]               Editor / detail
│   │   └── /approvals                 Approval queue
│   ├── /media
│   │   ├── /                          Media library
│   │   ├── /folders/[folderId]
│   │   └── /[assetId]
│   ├── /calendar                      Content calendar
│   ├── /analytics
│   │   ├── /                          Overview
│   │   ├── /campaigns
│   │   ├── /content
│   │   └── /channels
│   ├── /automations
│   │   ├── /                          Automation list
│   │   ├── /[automationId]            Detail / runs
│   │   └── /runs                      Global runs
│   ├── /agents
│   │   ├── /                          Agent roster (shell)
│   │   └── /[agentId]                 Agent workspace (shell)
│   └── /tasks
│       ├── /                          Task board / list
│       └── /[taskId]                  Task detail (panel preferred)
├── /team
│   ├── /                              Members
│   ├── /roles                         Roles & permissions
│   └── /invites                       Pending invites
├── /integrations
│   ├── /                              Connected apps
│   ├── /catalog                       Available integrations
│   └── /[integrationId]               Integration detail
└── /settings
    ├── /                              General
    ├── /workspace                     Workspace settings
    ├── /brands                        Brand management
    ├── /billing                       Billing (placeholder ok)
    ├── /notifications                 Notification preferences
    ├── /security                      Security & sessions
    └── /api                           API keys / webhooks (future)
```

### Global overlays (not routes, but first-class surfaces)

| Surface | Trigger | Notes |
|---------|---------|-------|
| Command Palette | `⌘K` | Nav + actions + entity search |
| Notifications Panel | Bell | Filter: All / Mentions / Approvals / System |
| Quick Create | `C` then type | Content, Campaign, Task, Automation |
| Shortcuts Help | `?` | Cheat sheet sheet |

---

## 5. Page Hierarchy & Contracts

Every page implements the **Page Contract**:

| Field | Description |
|-------|-------------|
| **Purpose** | One sentence: what job this page owns |
| **Primary actions** | 1–2 dominant CTAs |
| **Secondary actions** | Overflow / toolbar |
| **Future expansion** | Deliberate placeholders — not fake features |
| **Empty state** | Copy + single CTA |
| **Loading state** | Skeleton matching final layout |
| **Error state** | Inline error + retry; boundary for hard crashes |

---

### 5.1 Home — `/w/[ws]/home`

| | |
|--|--|
| **Purpose** | Executive overview of what needs attention *today* across the workspace (optionally filtered by active brand). |
| **Primary** | Open pending approvals; Continue today’s focus item |
| **Secondary** | Quick create; Jump to calendar; View all notifications |
| **Future** | Personalized briefing; cross-workspace rollup (org tier) |
| **Empty** | “Set up your first brand to unlock Home.” → Create brand |
| **Loading** | 8-card skeleton grid |
| **Error** | “Couldn’t load overview.” → Retry |

**Home modules (cards) — fixed order for cognitive stability:**

1. **Today’s focus** — prioritized list (tasks + approvals + failing runs), max 5  
2. **Recent AI activity** — last agent/automation events (read-only shell until AI ships)  
3. **Running automations** — live/queued count + deep link  
4. **Pending approvals** — content awaiting review  
5. **Campaign health** — sparkline / status chips for active campaigns  
6. **Quick actions** — Create content, New campaign, Upload media, Ask knowledge  
7. **Recent content** — last edited items  
8. **Notifications** — truncated feed → full panel  

**Decision:** Home is an *attention router*, not a analytics dump. Metrics-heavy views live under Analytics.

---

### 5.2 Workspace — `/w/[ws]/workspace`

| | |
|--|--|
| **Purpose** | Workspace health: brands, members activity, integrations status, usage. |
| **Primary** | Add brand; Invite member |
| **Secondary** | Open settings; View audit log (future) |
| **Future** | Org chart, SSO status, usage metering charts |
| **Empty** | First-run checklist (Brand → Integration → Knowledge → Campaign) |
| **Loading** | Stat row + list skeletons |
| **Error** | Retry |

---

### 5.3 Brand — `/w/[ws]/b/[brand]/brand`

| | |
|--|--|
| **Purpose** | Single source of truth for brand identity: voice, positioning, channels, guidelines. |
| **Primary** | Edit brand profile; Add channel |
| **Secondary** | Duplicate brand; Archive brand |
| **Future** | Brand kits, competitor notes, voice samples for AI |
| **Empty** | Guided brand setup wizard (full page — rare exception to “no modal”) |
| **Loading** | Profile skeleton |
| **Error** | Retry |

---

### 5.4 Knowledge — `/w/[ws]/b/[brand]/knowledge`

| | |
|--|--|
| **Purpose** | Curated knowledge base the OS (and future AI) uses: docs, sources, FAQs, claims. |
| **Primary** | New document; Import source |
| **Secondary** | Organize folders; Bulk tag |
| **Future** | Ask Knowledge (RAG UI); freshness scoring; citations |
| **Empty** | “Knowledge is how Inzorya stays on-brand.” → Add first doc |
| **Loading** | List/table skeleton |
| **Error** | Retry |

**Subpages:** Sources, Document detail (Notion-like canvas), Ask (shell).

---

### 5.5 Campaigns — `/w/[ws]/b/[brand]/campaigns`

| | |
|--|--|
| **Purpose** | Plan and operate marketing campaigns as first-class projects. |
| **Primary** | New campaign |
| **Secondary** | Filters (status, date); Export (future) |
| **Future** | Templates, multi-brand campaigns, budget objects |
| **Empty** | “Campaigns turn strategy into scheduled work.” → Create campaign |
| **Loading** | Table/board skeleton |
| **Error** | Retry |

**Campaign detail tabs:** Overview · Content · Timeline · Settings  
**Panel:** Create campaign; edit metadata inline on overview.

---

### 5.6 Content — `/w/[ws]/b/[brand]/content`

| | |
|--|--|
| **Purpose** | Library of all content pieces (draft → approved → scheduled → published). |
| **Primary** | New content |
| **Secondary** | Filters, views (list/board), bulk status, Open approvals |
| **Future** | Variants, localization, AI rewrite actions |
| **Empty** | Create first piece or import |
| **Loading** | Table skeleton |
| **Error** | Retry |

**Approvals** is a first-class sub-route (high-frequency job).

**Editor:** Full route for deep editing; metadata in side panel.

---

### 5.7 Media — `/w/[ws]/b/[brand]/media`

| | |
|--|--|
| **Purpose** | Asset library: images, video, audio, brand files. |
| **Primary** | Upload |
| **Secondary** | New folder; Bulk tag; Download |
| **Future** | Generative media slots, usage tracking per asset |
| **Empty** | Drag-drop upload empty state |
| **Loading** | Grid skeleton |
| **Error** | Retry + per-item failure chips |

---

### 5.8 Calendar — `/w/[ws]/b/[brand]/calendar`

| | |
|--|--|
| **Purpose** | Time-based view of scheduled content and campaign milestones. |
| **Primary** | Create scheduled content (panel) |
| **Secondary** | View switch (month/week/day); Filter by channel/campaign |
| **Future** | Drag reschedule with undo; multi-timezone |
| **Empty** | “Nothing scheduled” + CTA |
| **Loading** | Calendar chrome + cell skeletons |
| **Error** | Retry |

**Decision:** Calendar is a *view* over Content + Campaigns, not a separate content store.

---

### 5.9 Analytics — `/w/[ws]/b/[brand]/analytics`

| | |
|--|--|
| **Purpose** | Performance truth: campaigns, content, channels. |
| **Primary** | Date range; Compare |
| **Secondary** | Export; Saved views (future) |
| **Future** | Attribution, AI insights panel |
| **Empty** | Connect channel / wait for data |
| **Loading** | Chart skeletons |
| **Error** | Partial failure per widget |

---

### 5.10 Automations — `/w/[ws]/b/[brand]/automations`

| | |
|--|--|
| **Purpose** | Define and monitor marketing workflows (triggers → actions). |
| **Primary** | New automation |
| **Secondary** | Pause all; Filter by status |
| **Future** | Visual builder, templates marketplace |
| **Empty** | Explain trigger/action model simply |
| **Loading** | List skeleton |
| **Error** | Retry |

**Runs** sub-route for operational debugging (Stripe-like clarity).

---

### 5.11 AI Agents — `/w/[ws]/b/[brand]/agents`

| | |
|--|--|
| **Purpose** | Roster and workspaces for AI agents (architecture reserved; **no AI implementation in v1 foundation**). |
| **Primary** | Create agent (shell) |
| **Secondary** | Enable/disable (optimistic) |
| **Future** | Tools, memory, evals, run consoles |
| **Empty** | “Agents will operate on your Knowledge and Brand.” — educate, don’t fake |
| **Loading** | Card grid skeleton |
| **Error** | Retry |

**Critical decision:** Ship the **route + empty/shell UI** so IA doesn’t thrash later. Do not implement inference, tools, or agent loops yet.

---

### 5.12 Tasks — `/w/[ws]/b/[brand]/tasks`

| | |
|--|--|
| **Purpose** | Human work queue tied to campaigns/content/approvals. |
| **Primary** | New task |
| **Secondary** | Views: list / board; Filter assignee/status |
| **Future** | SLA, recurring tasks, automation-created tasks |
| **Empty** | “Capture work so nothing lives only in chat.” |
| **Loading** | Board skeleton |
| **Error** | Retry |

**Detail:** Side panel by default; deep-linkable via `?taskId=` or `/tasks/[id]`.

---

### 5.13 Team — `/w/[ws]/team`

| | |
|--|--|
| **Purpose** | People, roles, invites for the workspace. |
| **Primary** | Invite |
| **Secondary** | Manage roles |
| **Future** | SCIM, SSO, guest access |
| **Empty** | Invite teammates |
| **Loading** | Table skeleton |
| **Error** | Retry |

---

### 5.14 Integrations — `/w/[ws]/integrations`

| | |
|--|--|
| **Purpose** | Connect channels and tools; monitor connection health. |
| **Primary** | Browse catalog / Connect |
| **Secondary** | Reconnect; Disconnect |
| **Future** | Custom webhooks, transformation rules |
| **Empty** | Catalog-first empty (show value, not blank) |
| **Loading** | Catalog skeleton |
| **Error** | Per-integration error + retry |

---

### 5.15 Settings — `/w/[ws]/settings/*`

| | |
|--|--|
| **Purpose** | Durable configuration: workspace, brands, billing, security, notifications. |
| **Primary** | Save (explicit for forms; inline for toggles) |
| **Secondary** | Danger zone actions |
| **Future** | API keys, audit log, data export |
| **Empty** | N/A (always has defaults) |
| **Loading** | Form skeletons |
| **Error** | Field-level + form-level |

**Decision:** Settings is **workspace-scoped** in the sidebar. Brand-specific settings live under Brand + Campaign settings to avoid a settings maze.

---

## 6. User Flows (Core)

### 6.1 First-run (workspace created)

```
Sign in → Create/Join workspace → Create first brand
  → Connect one integration (skippable)
  → Add first knowledge doc (skippable)
  → Land on Home with checklist card
```

**Decision:** Checklist on Home beats a multi-step modal onboarding.

### 6.2 Daily operator loop

```
Open Home → Triage Today’s focus
  → Clear approvals (Content/Approvals)
  → Check failing automations
  → Edit content / schedule on Calendar
  → Review Analytics weekly (not daily)
```

### 6.3 Campaign creation

```
Campaigns → New (side panel)
  → Name, objective, dates, channels
  → Save → Campaign overview
  → Add content (panel or Content library link)
  → Schedule on Calendar
```

### 6.4 Approval flow

```
Notification / Home card → Content Approvals
  → Open piece in panel or editor
  → Approve / Request changes (inline)
  → Optimistic status + undo toast
```

### 6.5 Cross-cutting navigation

```
⌘K → type entity → Enter → route
⌘K → type action → “Create campaign” → panel
```

---

## 7. Component Hierarchy

```
AppProviders
├── ThemeProvider (dark default)
├── SessionProvider (NextAuth)
├── QueryClientProvider (React Query)
├── TooltipProvider
└── Toaster + UndoQueueProvider

(app)/(auth)/...
(app)/(marketing)/...          # minimal landing

(app)/(dashboard)/w/[workspaceSlug]/layout.tsx
└── DashboardShell
    ├── Sidebar
    │   ├── WorkspaceBrandLockup (collapsed awareness)
    │   ├── NavGroup[] → NavItem[]
    │   └── SidebarFooter (collapse, help)
    ├── TopBar
    │   ├── WorkspaceSwitcher
    │   ├── BrandSwitcher
    │   ├── Breadcrumbs
    │   ├── SearchTrigger
    │   ├── NotificationBell → NotificationsPanel (Sheet)
    │   └── UserMenu
    ├── Main
    │   ├── PageHeader
    │   │   ├── Title + Description
    │   │   ├── PrimaryActions
    │   │   └── SecondaryActions (Dropdown)
    │   ├── PageBody
    │   │   ├── DataToolbar (filters, view switch)
    │   │   ├── Content views (Table | Board | Grid | Calendar | Canvas)
    │   │   └── EmptyState | Skeleton | ErrorState
    │   └── SidePanelHost (Sheet) — route or local state
    ├── CommandPalette
    └── KeyboardShortcutsLayer
```

### Shared UI primitives (shadcn-first)

| Primitive | Use |
|-----------|-----|
| Button, DropdownMenu, Popover | Actions |
| Sheet | Side panels (create/edit/detail) |
| Dialog | Destructive confirm only |
| Command | Palette |
| Table / Data table | Dense lists |
| Tabs | Entity sub-views |
| Skeleton | Loading |
| Toast | Feedback + undo |
| Breadcrumb | Orientation |
| Avatar, Badge | People + sparse status |
| Form + Input | Settings & create panels |

### Domain components (examples)

- `HomeFocusList`, `CampaignHealthCard`, `ApprovalQueueRow`
- `ContentStatusPill`, `AutomationRunStatus`
- `MediaGrid`, `CalendarEventChip`
- `IntegrationHealthDot`
- `EntityEmptyState` (standardized)

---

## 8. State Management Suggestions

### 8.1 Principles

| Concern | Tool | Why |
|---------|------|-----|
| Server data | **TanStack Query (React Query)** | Cache, stale-while-revalidate, mutations, optimistic updates |
| Form draft state | **React Hook Form** (+ Zod) | Settings & create panels |
| URL state | **nuqs** or native searchParams | Filters, dates, selected entity, view mode — shareable |
| Ephemeral UI | **React state / Zustand (thin)** | Panel open, sidebar collapsed, command palette |
| Auth session | **NextAuth session** | Identity only |
| Theme | **next-themes** | Dark-first |

**Avoid:** Redux for v1. Avoid putting server lists in Zustand.

### 8.2 Query key convention

```
['workspace', workspaceId, 'brands']
['brand', brandId, 'campaigns', { status, q }]
['campaign', campaignId]
['content', contentId]
['notifications', workspaceId, { filter }]
```

### 8.3 Optimistic update policy

| Mutation | Optimistic? | Undo? |
|----------|-------------|-------|
| Rename, status change, assign | Yes | Yes |
| Reorder tasks | Yes | Yes |
| Delete permanent | No — confirm dialog | Soft-delete preferred |
| Connect OAuth | No | N/A |
| Upload media | Progress UI | Cancel upload |

### 8.4 Side panel state

Prefer:

```
/content?panel=new
/content/[id]?panel=meta
/tasks?taskId=abc
```

so refresh/share keeps context. Local state only for purely transient UI.

---

## 9. Folder Structure (Next.js App Router)

```
inzorya/
├── apps/web/                          # or repo root if single package
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── page.tsx               # minimal landing
│   │   │   └── layout.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   └── w/[workspaceSlug]/
│   │   │       ├── layout.tsx         # DashboardShell
│   │   │       ├── home/page.tsx
│   │   │       ├── workspace/page.tsx
│   │   │       ├── team/...
│   │   │       ├── integrations/...
│   │   │       ├── settings/...
│   │   │       └── b/[brandSlug]/
│   │   │           ├── layout.tsx     # brand context provider
│   │   │           ├── brand/page.tsx
│   │   │           ├── knowledge/...
│   │   │           ├── campaigns/...
│   │   │           ├── content/...
│   │   │           ├── media/...
│   │   │           ├── calendar/page.tsx
│   │   │           ├── analytics/...
│   │   │           ├── automations/...
│   │   │           ├── agents/...
│   │   │           └── tasks/...
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   └── trpc/[trpc]/route.ts   # or REST route handlers
│   │   ├── layout.tsx
│   │   └── globals.css                # Tailwind v4
│   ├── components/
│   │   ├── ui/                        # shadcn
│   │   ├── shell/                     # Sidebar, TopBar, ...
│   │   ├── home/
│   │   ├── campaigns/
│   │   ├── content/
│   │   └── ...
│   ├── features/                      # optional: feature modules
│   │   ├── command-palette/
│   │   ├── notifications/
│   │   └── undo/
│   ├── hooks/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts                      # Prisma client
│   │   ├── query-keys.ts
│   │   └── utils.ts
│   ├── server/
│   │   ├── routers/                   # if tRPC
│   │   └── services/                  # no AI business logic yet
│   └── types/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
│   └── architecture/
│       └── dashboard-architecture.md  # this file
└── package.json
```

### Colocation rule

- **Route files** stay thin: load data boundaries + compose feature components.
- **Feature components** own UI + mutations.
- **Server services** own Prisma access (never from client components).

---

## 10. Technical Architecture (Foundation Stack)

| Layer | Choice | Role |
|-------|--------|------|
| Framework | Next.js App Router | Nested layouts for workspace/brand shells |
| Language | TypeScript strict | Contracts & route params typed |
| Styling | Tailwind CSS v4 | Design tokens via CSS variables |
| Components | shadcn/ui | Accessible primitives, Sheet/Command first-class |
| Data fetching | React Query | Client cache + optimistic UX |
| ORM | Prisma | PostgreSQL models |
| DB | PostgreSQL | Relational source of truth |
| Auth | NextAuth (Auth.js) | Sessions; workspace membership checks in layout |
| Motion | Framer Motion (minimal) | Panel enter/exit, subtle layout — no decorative motion |

### Suggested core Prisma entities (schema sketch only — no business logic)

```
User
Account / Session (NextAuth)
Workspace
WorkspaceMember (role)
Brand
KnowledgeDoc / KnowledgeSource
Campaign
ContentItem (status, campaignId?, scheduledAt?)
MediaAsset
Automation / AutomationRun
Agent (shell fields only)
Task
IntegrationConnection
Notification
```

All brand-owned entities include `workspaceId` + `brandId` for query isolation and future move/copy.

### AuthZ model (v1)

Roles: `owner` | `admin` | `editor` | `viewer`  
Enforce in server layer per mutation; hide primary actions in UI when unauthorized (still enforce server-side).

---

## 11. Responsive Behavior

| Breakpoint | Shell behavior |
|------------|----------------|
| ≥1280px | Expanded sidebar default; side panels 420px |
| 768–1279px | Collapsed sidebar; panels full-height overlay |
| <768px | Sidebar drawer; Top bar condensed; Home cards single column; tables → stacked list |

**Touch:** Larger hit targets in mobile nav; swipe-to-close panels.

---

## 12. Accessibility & Keyboard

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘B` | Toggle sidebar |
| `G` then `H` | Go Home |
| `G` then `C` | Go Campaigns |
| `G` then `L` | Go Calendar |
| `C` | Quick create menu |
| `?` | Shortcuts help |
| `Esc` | Close panel / palette |
| `⌘Z` | Undo last reversible action (when toast active / undo stack) |

Focus trap inside Sheet/Dialog/Command. Visible focus rings. `aria-current` on nav items.

---

## 13. Design Tokens (Direction)

Dark-first semantic tokens (names, not final hex):

```
--background, --foreground
--card, --card-foreground
--muted, --muted-foreground
--border, --input
--primary, --primary-foreground     # restrained accent — not purple-default cliché
--destructive
--success, --warning
--sidebar, --sidebar-foreground
--ring
```

Typography: distinctive sans for UI (not Inter/Roboto default stack decision left to brand system). Monospace for IDs/runs.

Motion: 150–200ms panel transitions; respect `prefers-reduced-motion`.

---

## 14. Scalability Considerations

### Product scale

1. **Nav freeze:** Adding features must map into existing bands or a deliberate new band — no top-level sprawl.
2. **Brand proliferation:** Brand switcher with search; recent brands; optional “All brands” Home filter.
3. **Entity volume:** Server-side pagination + virtualized tables; never load all content into Home.
4. **Agents later:** `/agents` reserved; agent runs should mirror Automation runs UX for ops familiarity.
5. **Org tier later:** Insert Organization above Workspace without rewriting brand routes (`/o/[org]/w/[ws]/...` migration plan).

### Technical scale

1. **Layouts as authz boundaries:** Workspace layout loads membership; Brand layout verifies brand ∈ workspace.
2. **Query invalidation graphs:** Document parent→child invalidations early.
3. **Soft deletes** for Content, Media, Campaigns → enable Undo and recover.
4. **Idempotent automation runs** when automations ship.
5. **Feature flags** for Agents/Ask Knowledge until ready — routes can exist behind flag.
6. **Audit log table** stub in schema even if UI is Settings → future.

### Performance budget (UX)

- Shell interactive < 1s on broadband after auth.
- Home modules independently streamed/suspense’d so one slow card doesn’t block all.
- Skeletons match CLS-safe dimensions.

---

## 15. Design Decisions Log (Why)

| Decision | Choice | Why |
|----------|--------|-----|
| Product metaphor | Operating system, not scheduler | Prevents calendar-centric IA that can’t grow into agents/knowledge |
| Tenant root | Workspace | Matches team collaboration & billing; brands are operating contexts |
| URL structure | `/w/.../b/...` | Shareable, explicit context, CDN/cache friendly segments |
| Home modules | Fixed set & order | Executive muscle memory; avoids personalized chaos in v1 |
| AI Agents nav | Present as shell | Reserve IA slot; avoid later nav surgery |
| Calendar | View, not store | Single content source of truth |
| Approvals | Own route under Content | High-frequency job deserves a door, not a filter buried in a table |
| Settings location | Workspace-level | Prevent duplicate settings per brand for seats/billing/security |
| Panels vs modals | Sheet default | Keeps spatial context; faster triage |
| Search | Unified in Command Palette | One cognitive model (Linear/Vercel) |
| State | RQ + URL + thin client state | Scales without Redux ceremony |
| Dark mode | Default | Premium ops feel; matches Cursor/Vercel operator aesthetic |
| Motion | Minimal Framer | Polish without toyish animation |
| No AI logic now | Explicit | Foundation must be solid before agents; fake AI destroys trust |

---

## 16. Implementation Phases (Architecture-only sequencing)

> Still **not** building AI. This is the recommended *build order for the shell*.

1. **Foundation:** Next.js + Tailwind v4 + shadcn + Prisma + NextAuth + providers  
2. **Shell:** Sidebar, Top bar, breadcrumbs, switchers, command palette, sheets, toasts  
3. **Tenancy:** Workspace + Brand CRUD + membership gates  
4. **Home:** Module layout with empty/loading/error; mock or empty data  
5. **Core entities UI shells:** Campaigns, Content, Knowledge, Media, Calendar  
6. **Ops shells:** Automations, Tasks, Analytics (charts placeholders)  
7. **Collab:** Team, Integrations catalog UI, Notifications panel  
8. **Agents route shell** behind flag  
9. **Only then:** AI features against Knowledge/Brand contracts  

---

## 17. Definition of Done — Architecture Acceptance

Architecture is ready for implementation when:

- [ ] Navigation tree approved by product  
- [ ] Page contracts exist for every sidebar destination  
- [ ] Shell regions & UX rules agreed  
- [ ] Folder structure matches App Router plan  
- [ ] State management boundaries agreed  
- [ ] URL scheme for workspace/brand frozen for v1  
- [ ] Agents explicitly scoped as shell-only  
- [ ] Empty / loading / error patterns standardized as components  

---

## 18. Appendix — Empty / Loading / Error Pattern

**EmptyState**  
Title · One sentence · Primary CTA · Optional secondary link · Optional illustration (monochrome, not cartoon spam)

**Skeleton**  
Mirror final layout regions; avoid centered spinner as default.

**ErrorState**  
What failed · What user can do · Retry · Link to status/support if systemic

These three are **required props/slots** on every feature page template:

`PageTemplate({ header, children, isLoading, isError, isEmpty, ... })`

---

*End of document — Inzorya Dashboard Architecture v1*
