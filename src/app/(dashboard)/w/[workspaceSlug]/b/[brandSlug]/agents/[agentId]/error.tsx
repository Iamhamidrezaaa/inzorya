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
      title="This page failed to load"
      description="Retry the request. If the problem continues, return to Home."
      reset={reset}
    />
  );
}
