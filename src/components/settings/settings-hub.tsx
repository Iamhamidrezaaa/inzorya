"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page";
import { SettingsProfile } from "@/components/settings/settings-profile";

export function SettingsHub({
  initialName,
  initialEmail,
  brandSlug,
}: {
  initialName: string;
  initialEmail: string;
  brandSlug: string;
}) {
  const page = usePageCopy("settings");
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;

  return (
    <div className="space-y-8">
      <PageHeader
        title={page.title}
        description={page.description}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Name, email, password, and theme below.
          </p>
        </div>
        <Link
          href={`/w/${workspaceSlug}/settings/workspace`}
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <h2 className="text-sm font-semibold">Workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspace name and preferences.
          </p>
        </Link>
        <Link
          href={`/w/${workspaceSlug}/settings/integrations`}
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <h2 className="text-sm font-semibold">Integrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Meta OAuth, webhooks, and diagnostics.
          </p>
        </Link>
        <Link
          href={`/w/${workspaceSlug}/settings/ai`}
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <h2 className="text-sm font-semibold">AI Platform</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Providers, usage, prompts, and playground.
          </p>
        </Link>
        <Link
          href={`/w/${workspaceSlug}/b/${brandSlug}/brain`}
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <h2 className="text-sm font-semibold">Business Brain</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Interview, voice, assets, and completion.
          </p>
        </Link>
      </div>

      <SettingsProfile
        initialName={initialName}
        initialEmail={initialEmail}
      />
    </div>
  );
}
