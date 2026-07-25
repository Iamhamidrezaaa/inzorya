"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type RecentTrackerProps = {
  workspaceSlug: string;
};

function titleFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "Home";
  if (last === "home") return "Home";
  return last
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function RecentTracker({ workspaceSlug }: RecentTrackerProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.includes(`/w/${workspaceSlug}`)) return;

    const isSettings = pathname.includes("/settings");
    const targetType = isSettings ? "SETTINGS" : "PAGE";
    const targetId = pathname;
    const title = titleFromPath(pathname);

    void fetch("/api/recents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        targetType,
        targetId,
        title,
        href: pathname,
      }),
    });
  }, [pathname, workspaceSlug]);

  return null;
}
