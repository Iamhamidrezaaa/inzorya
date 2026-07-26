import { DashboardPage } from "@/components/shared/page";
import { getI18n } from "@/i18n/server";
import { getPageCopy, type PageCopyKey } from "@/i18n/page-copy";

type Props = {
  pageKey: PageCopyKey;
};

export async function LocalizedDashboardPage({ pageKey }: Props) {
  const { locale } = await getI18n();
  const copy = getPageCopy(locale, pageKey);
  return (
    <DashboardPage
      title={copy.title}
      description={copy.description}
      emptyTitle={copy.emptyTitle}
      emptyDescription={copy.emptyDescription}
      emptyActionLabel={copy.emptyActionLabel}
    />
  );
}
