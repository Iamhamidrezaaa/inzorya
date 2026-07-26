import { DashboardPage } from "@/components/shared/page";
import { getI18n } from "@/i18n/server";

export default async function Page({
  params,
}: {
  params: Promise<Record<string, string>>;
}) {
  const resolved = await params;
  const entity = Object.values(resolved).at(-1) ?? "entity";
  const { dictionary: d } = await getI18n();
  return (
    <DashboardPage
      title={d.shell.detail}
      description={d.shell.detailDescription.replace("{entity}", entity)}
      emptyTitle={d.shell.detailEmptyTitle}
      emptyDescription={d.shell.detailEmptyDescription}
    />
  );
}
