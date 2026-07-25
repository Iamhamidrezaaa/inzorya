import { DashboardPage } from "@/components/shared/page";

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
      description={`Shell route for ${entity}. Business logic ships in later epics.`}
      emptyTitle="Ready for data"
      emptyDescription="This route exists in the information architecture. Entity content will render here without fake charts or placeholder copy."
    />
  );
}
