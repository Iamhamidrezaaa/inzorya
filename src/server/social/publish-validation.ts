import type { ContentDraftStatus, SocialAccountStatus } from "@prisma/client";
import type {
  PublishRequest,
  PublishValidationResult,
  SocialCapabilityFlags,
} from "@/server/social/types";

export type PublishValidationInput = {
  request: PublishRequest;
  draft: {
    id: string;
    status: ContentDraftStatus;
    workspaceId: string;
    brandId: string;
  };
  account: {
    id: string;
    workspaceId: string;
    brandId: string;
    platform: string;
    status: SocialAccountStatus;
    capabilities: SocialCapabilityFlags;
  };
};

/**
 * Publishing foundation validation — never auto-executes publish.
 * READY human approval is mandatory.
 */
export function validatePublishRequest(
  input: PublishValidationInput,
): PublishValidationResult {
  const errors: PublishValidationResult["errors"] = [];

  if (input.draft.id !== input.request.draftId) {
    errors.push({
      code: "VALIDATION_ERROR",
      message: "Draft id mismatch.",
    });
  }

  if (input.account.id !== input.request.socialAccountId) {
    errors.push({
      code: "VALIDATION_ERROR",
      message: "Social account id mismatch.",
    });
  }

  if (
    input.draft.workspaceId !== input.account.workspaceId ||
    input.draft.brandId !== input.account.brandId
  ) {
    errors.push({
      code: "FORBIDDEN",
      message: "Draft and social account are in different workspace/brand scope.",
    });
  }

  if (
    input.account.workspaceId !== input.draft.workspaceId ||
    input.account.brandId !== input.draft.brandId
  ) {
    // already covered; keep explicit
  }

  if (input.draft.status !== "READY") {
    errors.push({
      code: "PUBLISH_REQUIRES_APPROVAL",
      message: `Publishing requires READY status (current: ${input.draft.status}).`,
    });
  }

  if (input.account.status !== "CONNECTED") {
    errors.push({
      code: "AUTH_ERROR",
      message: `Social account is not connected (status: ${input.account.status}).`,
    });
  }

  if (input.account.platform !== input.request.platform) {
    errors.push({
      code: "VALIDATION_ERROR",
      message: "Platform does not match the connected account.",
    });
  }

  if (!input.account.capabilities.publishing) {
    errors.push({
      code: "UNSUPPORTED_CAPABILITY",
      message: "Publishing is not available for this account.",
    });
  }

  if (input.request.scheduledAt) {
    errors.push({
      code: "UNSUPPORTED_CAPABILITY",
      message: "Scheduling is not implemented.",
    });
  }

  return { ok: errors.length === 0, errors };
}

/** Stub publisher — validate only; no network mutation. */
export const foundationSocialPublisher = {
  async validate(input: PublishValidationInput) {
    const result = validatePublishRequest(input);
    return {
      ok: result.ok,
      errors: result.errors.map((e) => e.message),
    };
  },
  async uploadMedia() {
    throw new Error("MEDIA_UPLOAD_NOT_IMPLEMENTED");
  },
  async publish() {
    throw new Error("PUBLISH_NOT_IMPLEMENTED");
  },
};
