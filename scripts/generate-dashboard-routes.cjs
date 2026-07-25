const fs = require("fs");
const path = require("path");

const root = path.join("src", "app", "(dashboard)", "w", "[workspaceSlug]");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log("wrote", file);
}

function makePage(copyKey) {
  return `import { DashboardPage } from "@/components/shared/page";
import { pageCopy } from "@/lib/navigation";

export default function Page() {
  const copy = pageCopy["${copyKey}"];
  return (
    <DashboardPage
      title={copy.title}
      description={copy.description}
      emptyTitle={copy.emptyTitle}
      emptyDescription={copy.emptyDescription}
    />
  );
}
`;
}

const loading = `import { PageSkeleton } from "@/components/shared/page";

export default function Loading() {
  return <PageSkeleton />;
}
`;

const error = `"use client";

import { ErrorState } from "@/components/shared/page";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="This page failed to load"
      description="Retry the request. If the problem continues, return to Home."
      reset={reset}
    />
  );
}
`;

const routes = [
  ["home/page.tsx", "home"],
  ["workspace/page.tsx", "workspace"],
  ["team/page.tsx", "team"],
  ["team/roles/page.tsx", "team-roles"],
  ["team/invites/page.tsx", "team-invites"],
  ["integrations/page.tsx", "integrations"],
  ["integrations/catalog/page.tsx", "integrations-catalog"],
  ["settings/page.tsx", "settings"],
  ["settings/workspace/page.tsx", "settings-workspace"],
  ["settings/brands/page.tsx", "settings-brands"],
  ["settings/billing/page.tsx", "settings-billing"],
  ["settings/notifications/page.tsx", "settings-notifications"],
  ["settings/security/page.tsx", "settings-security"],
  ["settings/api/page.tsx", "settings-api"],
  ["b/[brandSlug]/brand/page.tsx", "brand"],
  ["b/[brandSlug]/knowledge/page.tsx", "knowledge"],
  ["b/[brandSlug]/knowledge/sources/page.tsx", "knowledge-sources"],
  ["b/[brandSlug]/knowledge/ask/page.tsx", "knowledge-ask"],
  ["b/[brandSlug]/campaigns/page.tsx", "campaigns"],
  ["b/[brandSlug]/campaigns/new/page.tsx", "campaigns"],
  ["b/[brandSlug]/content/page.tsx", "content"],
  ["b/[brandSlug]/content/approvals/page.tsx", "content-approvals"],
  ["b/[brandSlug]/media/page.tsx", "media"],
  ["b/[brandSlug]/calendar/page.tsx", "calendar"],
  ["b/[brandSlug]/analytics/page.tsx", "analytics"],
  ["b/[brandSlug]/automations/page.tsx", "automations"],
  ["b/[brandSlug]/automations/runs/page.tsx", "automation-runs"],
  ["b/[brandSlug]/agents/page.tsx", "agents"],
  ["b/[brandSlug]/tasks/page.tsx", "tasks"],
];

for (const [rel, key] of routes) {
  write(path.join(root, rel), makePage(key));
  const dir = path.dirname(path.join(root, rel));
  write(path.join(dir, "loading.tsx"), loading);
  write(path.join(dir, "error.tsx"), error);
}

const nested = [
  ["b/[brandSlug]/knowledge/[docId]/page.tsx", "knowledge"],
  ["b/[brandSlug]/campaigns/[campaignId]/page.tsx", "campaigns"],
  ["b/[brandSlug]/campaigns/[campaignId]/content/page.tsx", "content"],
  ["b/[brandSlug]/campaigns/[campaignId]/timeline/page.tsx", "campaigns"],
  ["b/[brandSlug]/campaigns/[campaignId]/settings/page.tsx", "campaigns"],
  ["b/[brandSlug]/content/[contentId]/page.tsx", "content"],
  ["b/[brandSlug]/media/[assetId]/page.tsx", "media"],
  ["b/[brandSlug]/media/folders/[folderId]/page.tsx", "media"],
  ["b/[brandSlug]/automations/[automationId]/page.tsx", "automations"],
  ["b/[brandSlug]/agents/[agentId]/page.tsx", "agents"],
  ["b/[brandSlug]/tasks/[taskId]/page.tsx", "tasks"],
  ["integrations/[integrationId]/page.tsx", "integrations"],
];

for (const [rel, key] of nested) {
  const content = `import { DashboardPage } from "@/components/shared/page";

export default async function Page({
  params,
}: {
  params: Promise<Record<string, string>>;
}) {
  const resolved = await params;
  const entity = Object.values(resolved).at(-1) ?? "entity";
  return (
    <DashboardPage
      title="Detail"
      description={\`Shell route for \${entity}. Business logic ships in later epics.\`}
      emptyTitle="Ready for data"
      emptyDescription="This route exists in the information architecture. Entity content will render here without fake charts or placeholder copy."
    />
  );
}
`;
  write(path.join(root, rel), content);
  const dir = path.dirname(path.join(root, rel));
  write(path.join(dir, "loading.tsx"), loading);
  write(path.join(dir, "error.tsx"), error);
}

write(
  path.join(root, "b/[brandSlug]/page.tsx"),
  `import { redirect } from "next/navigation";

export default async function BrandIndexPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
}) {
  const { workspaceSlug, brandSlug } = await params;
  redirect(\`/w/\${workspaceSlug}/b/\${brandSlug}/brand\`);
}
`,
);

write(
  path.join(root, "b/[brandSlug]/layout.tsx"),
  `import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getBrandForWorkspace,
  getWorkspaceForUser,
} from "@/server/services/workspace";

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
}) {
  const session = await auth();
  const { workspaceSlug, brandSlug } = await params;
  if (!session?.user?.id) notFound();

  const workspace = await getWorkspaceForUser(workspaceSlug, session.user.id);
  if (!workspace) notFound();

  const brand = await getBrandForWorkspace(workspace.id, brandSlug);
  if (!brand) notFound();

  return children;
}
`,
);

write(path.join(root, "loading.tsx"), loading);
write(path.join(root, "error.tsx"), error);

console.log("done");
