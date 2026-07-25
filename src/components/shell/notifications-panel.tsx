"use client";

import { EmptyState } from "@/components/shared/page";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type NotificationsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NotificationsPanel({
  open,
  onOpenChange,
}: NotificationsPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Approvals, mentions, and system events for this workspace.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <EmptyState
            title="No notifications"
            description="When approvals, automation failures, or mentions arrive, they will show up here."
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
