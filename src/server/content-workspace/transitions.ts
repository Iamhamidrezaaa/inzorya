import type { ContentDraftStatus } from "@prisma/client";
import { ContentWorkspaceError } from "@/server/content-workspace/types";

/** Allowed status transitions for human-in-the-loop workflow. */
const ALLOWED: Record<ContentDraftStatus, readonly ContentDraftStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED"],
  CHANGES_REQUESTED: ["DRAFT", "IN_REVIEW"],
  APPROVED: ["READY"],
  READY: [],
};

export function canTransition(
  from: ContentDraftStatus,
  to: ContentDraftStatus,
): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(
  from: ContentDraftStatus,
  to: ContentDraftStatus,
): void {
  if (!canTransition(from, to)) {
    throw new ContentWorkspaceError(
      "INVALID_TRANSITION",
      `Cannot transition from ${from} to ${to}.`,
    );
  }
}

/** AI / system must never jump to READY or APPROVED. */
export function assertHumanApprovalRequired(
  from: ContentDraftStatus,
  to: ContentDraftStatus,
): void {
  if (to === "READY" && from !== "APPROVED") {
    throw new ContentWorkspaceError(
      "INVALID_TRANSITION",
      "READY requires prior human APPROVED status.",
    );
  }
  if (to === "APPROVED" && from !== "IN_REVIEW") {
    throw new ContentWorkspaceError(
      "INVALID_TRANSITION",
      "APPROVED requires human review from IN_REVIEW.",
    );
  }
  assertTransition(from, to);
}

export function statusForReviewAction(
  action: "send_for_review" | "request_changes" | "approve" | "mark_ready",
  current: ContentDraftStatus,
): ContentDraftStatus {
  switch (action) {
    case "send_for_review":
      if (current === "DRAFT" || current === "CHANGES_REQUESTED") {
        return "IN_REVIEW";
      }
      throw new ContentWorkspaceError(
        "INVALID_TRANSITION",
        `Cannot send for review from ${current}.`,
      );
    case "request_changes":
      if (current !== "IN_REVIEW") {
        throw new ContentWorkspaceError(
          "INVALID_TRANSITION",
          `Cannot request changes from ${current}.`,
        );
      }
      return "CHANGES_REQUESTED";
    case "approve":
      if (current !== "IN_REVIEW") {
        throw new ContentWorkspaceError(
          "INVALID_TRANSITION",
          `Cannot approve from ${current}.`,
        );
      }
      return "APPROVED";
    case "mark_ready":
      if (current !== "APPROVED") {
        throw new ContentWorkspaceError(
          "INVALID_TRANSITION",
          `Cannot mark ready from ${current}.`,
        );
      }
      return "READY";
    default:
      throw new ContentWorkspaceError("INVALID_INPUT", "Unknown review action.");
  }
}
