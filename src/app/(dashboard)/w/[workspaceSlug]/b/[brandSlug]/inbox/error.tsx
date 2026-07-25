"use client";

import { ErrorState } from "@/components/shared/page";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Inbox failed to load"
      description="Retry the request. If it keeps failing, refresh the page."
      reset={reset}
    />
  );
}
