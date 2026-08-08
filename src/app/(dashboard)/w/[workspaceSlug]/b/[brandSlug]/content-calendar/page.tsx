import { ContentCalendarView } from "@/components/content-planning/content-calendar-view";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ContentCalendarPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  return (
    <ContentCalendarView workspaceSlug={workspaceSlug} brandSlug={brandSlug} />
  );
}
