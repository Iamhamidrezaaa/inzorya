import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ workspaceSlug: string; brandSlug: string }>;
};

export default async function ContentPage({ params }: PageProps) {
  const { workspaceSlug, brandSlug } = await params;
  redirect(`/w/${workspaceSlug}/b/${brandSlug}/studio`);
}
