import { DashboardPage } from "@/components/shared/page";
import { pageCopy } from "@/lib/navigation";

export default function Page() {
  const copy = pageCopy["team-roles"];
  return (
    <DashboardPage
      title={copy.title}
      description={copy.description}
      emptyTitle={copy.emptyTitle}
      emptyDescription={copy.emptyDescription}
    />
  );
}
