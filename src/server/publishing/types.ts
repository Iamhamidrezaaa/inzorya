import { z } from "zod";

export const publishMediaItemSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().url(),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
});

export const normalizedPublishRequestSchema = z.object({
  contentDraftId: z.string().min(1),
  contentScheduleId: z.string().min(1),
  socialAccountId: z.string().min(1),
  platform: z.string().min(1),
  content: z.object({
    caption: z.string().default(""),
    media: z.array(publishMediaItemSchema).default([]),
  }),
  scheduledAt: z.string().optional().nullable(),
  timezone: z.string().optional(),
  format: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type NormalizedPublishRequest = z.infer<
  typeof normalizedPublishRequestSchema
>;
export type PublishMediaItem = z.infer<typeof publishMediaItemSchema>;

export type PublisherErrorCode =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "VALIDATION_ERROR"
  | "MEDIA_ERROR"
  | "NETWORK_ERROR"
  | "UNSUPPORTED_FORMAT"
  | "UNSUPPORTED_CAPABILITY"
  | "PROVIDER_ERROR"
  | "UNKNOWN_ERROR"
  | "PLATFORM_UNAVAILABLE"
  | "IDEMPOTENT_REPLAY";

export class PublisherError extends Error {
  readonly code: PublisherErrorCode;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(
    code: PublisherErrorCode,
    message: string,
    opts?: { userMessage?: string; retryable?: boolean; retryAfterMs?: number },
  ) {
    super(message);
    this.name = "PublisherError";
    this.code = code;
    this.userMessage = opts?.userMessage ?? defaultUserMessage(code);
    this.retryable = opts?.retryable ?? isTransient(code);
    this.retryAfterMs = opts?.retryAfterMs;
  }
}

function isTransient(code: PublisherErrorCode): boolean {
  return code === "NETWORK_ERROR" || code === "RATE_LIMIT" || code === "PROVIDER_ERROR";
}

function defaultUserMessage(code: PublisherErrorCode): string {
  switch (code) {
    case "AUTH_ERROR":
      return "Publishing failed because the social account authorization has expired.";
    case "RATE_LIMIT":
      return "The platform is rate-limiting requests. Try again later.";
    case "VALIDATION_ERROR":
      return "Content could not be validated for this platform.";
    case "MEDIA_ERROR":
      return "Media could not be processed for publishing.";
    case "NETWORK_ERROR":
      return "Could not reach the platform. Try again later.";
    case "UNSUPPORTED_FORMAT":
      return "This content format is not supported for publishing.";
    case "UNSUPPORTED_CAPABILITY":
      return "Publishing is not available for this account.";
    case "PLATFORM_UNAVAILABLE":
      return "This platform is not available for publishing.";
    default:
      return "Publishing failed. Please try again or reconnect the account.";
  }
}

export type PublisherValidateResult = {
  ok: boolean;
  errors: Array<{ code: PublisherErrorCode; message: string }>;
};

export type PublisherPublishResult = {
  externalPostId: string;
  externalUrl?: string | null;
  publishedAt: Date;
  rawStatus?: string;
};

export type PublisherStatusResult = {
  status: "PUBLISHED" | "FAILED" | "PENDING" | "UNKNOWN";
  externalPostId?: string | null;
  externalUrl?: string | null;
};

/**
 * Real publisher contract — only implement when an actual provider path exists.
 */
export interface SocialPublisher {
  readonly platform: string;
  /** Formats this publisher can send (lowercase). */
  supportedFormats(): string[];
  /** Max caption length. */
  maxCaptionLength(): number;
  /** Whether media is required for a format. */
  mediaRequiredFor(format: string): boolean;
  validate(request: NormalizedPublishRequest): Promise<PublisherValidateResult>;
  publish(
    request: NormalizedPublishRequest,
    ctx: { accessToken: string; platformAccountId: string },
  ): Promise<PublisherPublishResult>;
  getPublicationStatus?(
    externalPostId: string,
    ctx: { accessToken: string },
  ): Promise<PublisherStatusResult>;
}
