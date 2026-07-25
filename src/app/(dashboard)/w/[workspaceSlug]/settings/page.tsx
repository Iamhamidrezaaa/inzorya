import Link from "next/link";
import { PageHeader } from "@/components/shared/page";
import { pageCopy } from "@/lib/navigation";

const sections = [
  { href: "workspace", label: "Workspace", description: "Name and preferences" },
  { href: "brands", label: "Brands", description: "Create and archive brands" },
  { href: "billing", label: "Billing", description: "Plans and invoices" },
  {
    href: "notifications",
    label: "Notifications",
    description: "Event delivery preferences",
  },
  { href: "security", label: "Security", description: "Sessions and access" },
  { href: "api", label: "API", description: "Keys and webhooks" },
] as const;

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function SettingsIndexPage({ params }: PageProps) {
  const { workspaceSlug } = await params;
  const copy = pageCopy.settings;

  return (
    <div>
      <PageHeader title={copy.title} description={copy.description} />
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={`/w/${workspaceSlug}/settings/${section.href}`}
            className="rounded-xl border border-border bg-card/50 p-5 transition-colors hover:bg-accent/40"
          >
            <div className="text-sm font-medium text-foreground">
              {section.label}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {section.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
