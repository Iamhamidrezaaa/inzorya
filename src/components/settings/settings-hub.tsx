"use client";

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
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params.workspaceSlug;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Profile, workspace, and brand."
      />

      <div className="grid gap-3 sm:grid-cols-3">
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
          href={`/w/${workspaceSlug}/b/${brandSlug}/brand`}
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
        >
          <h2 className="text-sm font-semibold">Brand</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Identity, voice, and colors.
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
