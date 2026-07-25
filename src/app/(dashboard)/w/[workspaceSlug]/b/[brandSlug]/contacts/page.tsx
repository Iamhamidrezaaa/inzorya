import { ContactsView } from "@/components/contacts/contacts-view";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ContactsPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return <ContactsView workspaceSlug={workspaceSlug} brandSlug={brandSlug} />;
}
