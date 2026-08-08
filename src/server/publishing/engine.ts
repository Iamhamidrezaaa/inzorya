import type { Prisma, SocialPublicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptTokenBundle } from "@/server/social/credentials";
import { redactSecrets } from "@/server/social/credentials";
import {
  getSocialPublisherRegistry,
  type SocialPublisherRegistry,
} from "@/server/publishing/registry";
import {
  normalizedPublishRequestSchema,
  PublisherError,
  type NormalizedPublishRequest,
  type PublisherErrorCode,
} from "@/server/publishing/types";
import type { SocialCapabilityFlags } from "@/server/social/types";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseCaps(raw: unknown): SocialCapabilityFlags {
  const c = (raw || {}) as Partial<SocialCapabilityFlags>;
  return {
    connect: Boolean(c.connect),
    accountInfo: Boolean(c.accountInfo),
    profile: Boolean(c.profile),
    publishing: Boolean(c.publishing),
    analytics: Boolean(c.analytics),
    mediaUpload: Boolean(c.mediaUpload),
    deleteContent: Boolean(c.deleteContent),
  };
}

function captionFromDraft(payload: unknown): string {
  const p = (payload || {}) as {
    caption?: string;
    primaryHook?: string;
    cta?: string;
  };
  return (
    (p.caption || "").trim() ||
    [p.primaryHook, p.cta].filter(Boolean).join("\n\n").trim()
  );
}

function scheduleDueInstant(schedule: {
  plannedDate: Date;
  plannedTime: string;
  timezone: string;
}): Date {
  // Interpret plannedDate (UTC date) + plannedTime as local wall clock in timezone
  // using a pragmatic offset-free approach: build ISO-like local and compare via formatter.
  const dateStr = schedule.plannedDate.toISOString().slice(0, 10);
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = schedule.plannedTime.split(":").map(Number);
  // Construct as UTC first then adjust using Intl offset for the timezone
  const utcGuess = new Date(Date.UTC(y!, m! - 1, d!, hh!, mm!, 0));
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: schedule.timezone || "UTC",
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // Fallback: treat planned time as UTC if timezone parsing is complex
    void fmt;
  } catch {
    /* ignore */
  }
  // Simple approach used by product: store intended local time; due check compares
  // against "now" converted to that timezone wall clock.
  return utcGuess;
}

function isScheduleDue(schedule: {
  plannedDate: Date;
  plannedTime: string;
  timezone: string;
}): boolean {
  const now = new Date();
  try {
    const dateStr = schedule.plannedDate.toISOString().slice(0, 10);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: schedule.timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
    const nowLocal = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
    const target = `${dateStr}T${schedule.plannedTime.padStart(5, "0")}`;
    return nowLocal >= target;
  } catch {
    return scheduleDueInstant(schedule).getTime() <= Date.now();
  }
}

export type GateError = {
  code: PublisherErrorCode | "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATUS";
  message: string;
};

export type ValidationPipelineResult = {
  ok: boolean;
  errors: GateError[];
  request?: NormalizedPublishRequest;
  draftId?: string;
  scheduleId?: string;
  socialAccountId?: string;
  platform?: string;
  preview?: {
    platform: string;
    accountName: string | null;
    username: string | null;
    caption: string;
    mediaCount: number;
    scheduledAt: string | null;
    timezone: string | null;
    draftStatus: string;
    scheduleStatus: string;
    publishingCapability: boolean;
  };
};

export type PublishingServiceOptions = {
  publisherRegistry?: SocialPublisherRegistry;
  prismaClient?: typeof prisma;
};

export function createPublishingService(options: PublishingServiceOptions = {}) {
  const db = options.prismaClient ?? prisma;
  const publishers = options.publisherRegistry ?? getSocialPublisherRegistry();

  async function loadContext(input: {
    workspaceId: string;
    brandId: string;
    contentScheduleId: string;
    socialAccountId?: string;
  }) {
    const schedule = await db.contentSchedule.findUnique({
      where: { id: input.contentScheduleId },
      include: { contentDraft: true },
    });
    if (!schedule) {
      throw new PublisherError("VALIDATION_ERROR", "Schedule not found.", {
        userMessage: "Scheduled content was not found.",
      });
    }
    if (
      schedule.workspaceId !== input.workspaceId ||
      schedule.brandId !== input.brandId
    ) {
      throw new PublisherError("VALIDATION_ERROR", "Schedule scope mismatch.", {
        userMessage: "You do not have access to this schedule.",
      });
    }

    const socialAccountId =
      input.socialAccountId || schedule.socialAccountId || undefined;
    if (!socialAccountId) {
      throw new PublisherError(
        "UNSUPPORTED_CAPABILITY",
        "No social account on schedule.",
      );
    }

    const account = await db.socialAccount.findUnique({
      where: { id: socialAccountId },
      include: { credential: true },
    });
    if (!account) {
      throw new PublisherError("VALIDATION_ERROR", "Social account not found.");
    }
    if (
      account.workspaceId !== input.workspaceId ||
      account.brandId !== input.brandId
    ) {
      throw new PublisherError("VALIDATION_ERROR", "Account scope mismatch.", {
        userMessage: "You do not have access to this social account.",
      });
    }

    return { schedule, account, draft: schedule.contentDraft };
  }

  async function runGates(input: {
    workspaceId: string;
    brandId: string;
    contentScheduleId: string;
    socialAccountId?: string;
    requireDue?: boolean;
  }): Promise<ValidationPipelineResult> {
    const errors: GateError[] = [];
    let loaded;
    try {
      loaded = await loadContext(input);
    } catch (e) {
      if (e instanceof PublisherError) {
        return {
          ok: false,
          errors: [{ code: e.code, message: e.userMessage }],
        };
      }
      throw e;
    }

    const { schedule, account, draft } = loaded;
    const caps = parseCaps(account.capabilities);
    const platform = account.platform.toLowerCase();

    if (draft.status !== "READY") {
      errors.push({
        code: "INVALID_STATUS",
        message: `Content must be READY (current: ${draft.status}).`,
      });
    }
    if (schedule.status !== "SCHEDULED") {
      errors.push({
        code: "INVALID_STATUS",
        message: `Schedule must be SCHEDULED (current: ${schedule.status}).`,
      });
    }
    if (schedule.contentDraftId !== draft.id) {
      errors.push({
        code: "VALIDATION_ERROR",
        message: "Schedule does not belong to draft.",
      });
    }
    if (account.status !== "CONNECTED" || account.disconnectedAt) {
      errors.push({
        code: "AUTH_ERROR",
        message: "Social account is not connected.",
      });
    }
    if (!caps.publishing) {
      errors.push({
        code: "UNSUPPORTED_CAPABILITY",
        message: "Publishing is not available for this account.",
      });
    }
    if (!publishers.has(platform)) {
      errors.push({
        code: "UNSUPPORTED_CAPABILITY",
        message: "No publisher implementation for this platform.",
      });
    }
    if (!account.credential) {
      errors.push({
        code: "AUTH_ERROR",
        message: "Missing credentials for social account.",
      });
    }
    if (input.requireDue && !isScheduleDue(schedule)) {
      errors.push({
        code: "VALIDATION_ERROR",
        message: "Scheduled time has not been reached yet.",
      });
    }

    const caption = captionFromDraft(draft.contentPayload);
    const request: NormalizedPublishRequest = normalizedPublishRequestSchema.parse({
      contentDraftId: draft.id,
      contentScheduleId: schedule.id,
      socialAccountId: account.id,
      platform,
      content: { caption, media: [] },
      scheduledAt: `${schedule.plannedDate.toISOString().slice(0, 10)}T${schedule.plannedTime}`,
      timezone: schedule.timezone,
      format: draft.format,
      idempotencyKey: `${schedule.id}:${account.id}`,
    });

    if (publishers.has(platform)) {
      const publisher = publishers.require(platform);
      const format = (draft.format || "post").toLowerCase();
      if (
        publisher.mediaRequiredFor(format) &&
        !publisher.supportedFormats().includes(format)
      ) {
        errors.push({
          code: "UNSUPPORTED_FORMAT",
          message: `Format "${draft.format}" is not supported for publishing.`,
        });
      }
      const providerValidation = await publisher.validate(request);
      if (!providerValidation.ok) {
        for (const err of providerValidation.errors) {
          errors.push({ code: err.code, message: err.message });
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      request,
      draftId: draft.id,
      scheduleId: schedule.id,
      socialAccountId: account.id,
      platform,
      preview: {
        platform,
        accountName: account.accountName,
        username: account.username,
        caption,
        mediaCount: 0,
        scheduledAt: `${schedule.plannedDate.toISOString().slice(0, 10)} ${schedule.plannedTime}`,
        timezone: schedule.timezone,
        draftStatus: draft.status,
        scheduleStatus: schedule.status,
        publishingCapability: caps.publishing && publishers.has(platform),
      },
    };
  }

  async function findExistingPublished(
    contentScheduleId: string,
    socialAccountId: string,
  ) {
    return db.socialPublication.findUnique({
      where: {
        contentScheduleId_socialAccountId: {
          contentScheduleId,
          socialAccountId,
        },
      },
    });
  }

  return {
    async listProviders() {
      return publishers.list().map((p) => ({
        platform: p.platform,
        supportedFormats: p.supportedFormats(),
        maxCaptionLength: p.maxCaptionLength(),
        publishing: true,
        mediaUpload: false,
        verification: "MOCK_VERIFIED" as const,
      }));
    },

    async getProviderCapabilities(platform: string) {
      try {
        const p = publishers.require(platform);
        return {
          platform: p.platform,
          capabilities: {
            accountInfo: true,
            analytics: false,
            mediaUpload: false,
            publishing: true,
          },
          supportedFormats: p.supportedFormats(),
          maxCaptionLength: p.maxCaptionLength(),
          verification: "MOCK_VERIFIED",
        };
      } catch (e) {
        if (e instanceof PublisherError) {
          return {
            platform,
            capabilities: {
              accountInfo: false,
              analytics: false,
              mediaUpload: false,
              publishing: false,
            },
            error: e.code,
            verification:
              platform.toLowerCase() === "pinterest"
                ? "REMOVED"
                : "UNAVAILABLE",
          };
        }
        throw e;
      }
    },

    async validate(input: {
      workspaceId: string;
      brandId: string;
      contentScheduleId: string;
      socialAccountId?: string;
    }) {
      return runGates(input);
    },

    async list(
      scope: { workspaceId: string; brandId: string },
      filters?: { status?: SocialPublicationStatus },
    ) {
      return db.socialPublication.findMany({
        where: {
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
          ...(filters?.status ? { status: filters.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    },

    async get(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const row = await db.socialPublication.findUnique({ where: { id } });
      if (!row) {
        throw new PublisherError("VALIDATION_ERROR", "Publication not found.", {
          userMessage: "Publication not found.",
        });
      }
      if (
        row.workspaceId !== scope.workspaceId ||
        row.brandId !== scope.brandId
      ) {
        throw new PublisherError("VALIDATION_ERROR", "Scope mismatch.", {
          userMessage: "You do not have access to this publication.",
        });
      }
      return redactSecrets(row);
    },

    async publish(input: {
      workspaceId: string;
      brandId: string;
      contentScheduleId: string;
      socialAccountId?: string;
      /** When true, enforce schedule due time (scheduled runner). */
      requireDue?: boolean;
      triggeredBy?: "manual" | "scheduler";
    }) {
      const gates = await runGates({
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        contentScheduleId: input.contentScheduleId,
        socialAccountId: input.socialAccountId,
        requireDue: input.requireDue,
      });

      if (!gates.ok || !gates.request || !gates.socialAccountId) {
        // Persist FAILED attempt only if schedule/account known
        if (gates.scheduleId && gates.socialAccountId) {
          const existing = await findExistingPublished(
            gates.scheduleId,
            gates.socialAccountId,
          );
          if (existing?.status === "PUBLISHED") {
            return { publication: redactSecrets(existing), idempotent: true };
          }
          const failureCode = gates.errors[0]?.code || "VALIDATION_ERROR";
          const failureMessageSafe =
            gates.errors[0]?.message || "Validation failed.";
          const row = existing
            ? await db.socialPublication.update({
                where: { id: existing.id },
                data: {
                  status: "FAILED",
                  failureCode: String(failureCode),
                  failureMessageSafe,
                  attemptCount: { increment: 1 },
                  lastAttemptAt: new Date(),
                  completedAt: new Date(),
                  diagnostics: asJson({
                    errors: gates.errors,
                    triggeredBy: input.triggeredBy || "manual",
                  }),
                },
              })
            : await db.socialPublication.create({
                data: {
                  workspaceId: input.workspaceId,
                  brandId: input.brandId,
                  contentDraftId: gates.draftId!,
                  contentScheduleId: gates.scheduleId,
                  socialAccountId: gates.socialAccountId,
                  platform: gates.platform || "unknown",
                  status: "FAILED",
                  failureCode: String(failureCode),
                  failureMessageSafe,
                  attemptCount: 1,
                  lastAttemptAt: new Date(),
                  startedAt: new Date(),
                  completedAt: new Date(),
                  idempotencyKey: `${gates.scheduleId}:${gates.socialAccountId}`,
                  diagnostics: asJson({
                    errors: gates.errors,
                    triggeredBy: input.triggeredBy || "manual",
                  }),
                },
              });
          return {
            publication: redactSecrets(row),
            idempotent: false,
            validation: gates,
          };
        }
        return { publication: null, validation: gates, idempotent: false };
      }

      const existing = await findExistingPublished(
        gates.request.contentScheduleId,
        gates.request.socialAccountId,
      );
      if (existing?.status === "PUBLISHED") {
        return { publication: redactSecrets(existing), idempotent: true };
      }

      const account = await db.socialAccount.findUniqueOrThrow({
        where: { id: gates.request.socialAccountId },
        include: { credential: true },
      });
      if (!account.credential) {
        throw new PublisherError("AUTH_ERROR", "Missing credentials");
      }

      let publication =
        existing ||
        (await db.socialPublication.create({
          data: {
            workspaceId: input.workspaceId,
            brandId: input.brandId,
            contentDraftId: gates.request.contentDraftId,
            contentScheduleId: gates.request.contentScheduleId,
            socialAccountId: gates.request.socialAccountId,
            platform: gates.request.platform,
            status: "VALIDATING",
            idempotencyKey: gates.request.idempotencyKey,
            startedAt: new Date(),
            attemptCount: 0,
          },
        }));

      publication = await db.socialPublication.update({
        where: { id: publication.id },
        data: {
          status: "PUBLISHING",
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
          failureCode: null,
          failureMessageSafe: null,
        },
      });

      try {
        const tokens = decryptTokenBundle(account.credential);
        const publisher = publishers.require(gates.request.platform);
        const result = await publisher.publish(gates.request, {
          accessToken: tokens.accessToken,
          platformAccountId: account.platformAccountId,
        });

        publication = await db.socialPublication.update({
          where: { id: publication.id },
          data: {
            status: "PUBLISHED",
            externalPostId: result.externalPostId,
            externalUrl: result.externalUrl ?? null,
            publishedAt: result.publishedAt,
            completedAt: new Date(),
            diagnostics: asJson({
              triggeredBy: input.triggeredBy || "manual",
              // never include tokens
            }),
          },
        });

        return {
          publication: redactSecrets(publication),
          idempotent: false,
          validation: gates,
        };
      } catch (e) {
        const err =
          e instanceof PublisherError
            ? e
            : new PublisherError(
                "UNKNOWN_ERROR",
                e instanceof Error ? e.message : "Unknown publish error",
              );

        const retryable = err.retryable;
        const attemptCount = publication.attemptCount;
        const maxAttempts = publication.maxAttempts;
        const nextRetryAt =
          retryable && attemptCount < maxAttempts
            ? new Date(Date.now() + (err.retryAfterMs || 60_000))
            : null;

        publication = await db.socialPublication.update({
          where: { id: publication.id },
          data: {
            status: "FAILED",
            failureCode: err.code,
            failureMessageSafe: err.userMessage,
            completedAt: new Date(),
            nextRetryAt,
            diagnostics: asJson({
              retryable,
              // safe message only
              providerMessage: err.message.slice(0, 300),
            }),
          },
        });

        return {
          publication: redactSecrets(publication),
          idempotent: false,
          validation: gates,
          error: { code: err.code, message: err.userMessage },
        };
      }
    },

    async retry(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const row = await this.get(id, scope);
      if (row.status === "PUBLISHED") {
        return { publication: row, idempotent: true };
      }
      if (row.status === "CANCELLED") {
        throw new PublisherError(
          "VALIDATION_ERROR",
          "Cancelled publication cannot be retried.",
        );
      }
      // Permanent errors must not retry
      const permanent = new Set([
        "VALIDATION_ERROR",
        "UNSUPPORTED_FORMAT",
        "UNSUPPORTED_CAPABILITY",
        "MEDIA_ERROR",
        "AUTH_ERROR",
        "PLATFORM_UNAVAILABLE",
      ]);
      if (row.failureCode && permanent.has(row.failureCode)) {
        throw new PublisherError(
          "VALIDATION_ERROR",
          "Permanent failures cannot be retried.",
          {
            userMessage:
              row.failureMessageSafe ||
              "This publishing failure cannot be retried automatically.",
          },
        );
      }
      return this.publish({
        workspaceId: scope.workspaceId,
        brandId: scope.brandId,
        contentScheduleId: row.contentScheduleId,
        socialAccountId: row.socialAccountId,
        triggeredBy: "manual",
      });
    },

    async cancel(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const row = await db.socialPublication.findUnique({ where: { id } });
      if (!row) {
        throw new PublisherError("VALIDATION_ERROR", "Publication not found.");
      }
      if (
        row.workspaceId !== scope.workspaceId ||
        row.brandId !== scope.brandId
      ) {
        throw new PublisherError("VALIDATION_ERROR", "Scope mismatch.");
      }
      if (row.status === "PUBLISHED") {
        throw new PublisherError(
          "VALIDATION_ERROR",
          "Published items cannot be cancelled here.",
          {
            userMessage:
              "This content is already published and cannot be cancelled in Inzorya.",
          },
        );
      }
      const updated = await db.socialPublication.update({
        where: { id },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      return redactSecrets(updated);
    },

    /**
     * Minimal scheduled execution: find due SCHEDULED items and publish.
     * No distributed queue — invoke via authenticated API.
     */
    async processDue(scope: {
      workspaceId: string;
      brandId: string;
      limit?: number;
    }) {
      const schedules = await db.contentSchedule.findMany({
        where: {
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
          status: "SCHEDULED",
          socialAccountId: { not: null },
        },
        take: scope.limit ?? 20,
        orderBy: [{ plannedDate: "asc" }, { plannedTime: "asc" }],
      });

      const results = [];
      for (const schedule of schedules) {
        if (!isScheduleDue(schedule)) continue;
        const existing = schedule.socialAccountId
          ? await findExistingPublished(schedule.id, schedule.socialAccountId)
          : null;
        if (existing?.status === "PUBLISHED") continue;
        if (
          existing?.status === "FAILED" &&
          existing.nextRetryAt &&
          existing.nextRetryAt.getTime() > Date.now()
        ) {
          continue;
        }
        const result = await this.publish({
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
          contentScheduleId: schedule.id,
          socialAccountId: schedule.socialAccountId || undefined,
          requireDue: true,
          triggeredBy: "scheduler",
        });
        results.push(result);
      }
      return { processed: results.length, results };
    },

    async statusForDraft(
      contentDraftId: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      const pubs = await db.socialPublication.findMany({
        where: {
          contentDraftId,
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      if (pubs.some((p) => p.status === "PUBLISHED")) {
        const published = pubs.find((p) => p.status === "PUBLISHED")!;
        return {
          status: "PUBLISHED" as const,
          publication: redactSecrets(published),
        };
      }
      if (pubs.some((p) => p.status === "PUBLISHING" || p.status === "VALIDATING")) {
        return { status: "PUBLISHING" as const, publication: redactSecrets(pubs[0]!) };
      }
      if (pubs.some((p) => p.status === "FAILED")) {
        return { status: "FAILED" as const, publication: redactSecrets(pubs[0]!) };
      }
      const schedule = await db.contentSchedule.findFirst({
        where: {
          contentDraftId,
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
          status: "SCHEDULED",
        },
      });
      if (schedule) return { status: "SCHEDULED" as const, publication: null };
      return { status: "NOT_PUBLISHED" as const, publication: null };
    },

    assertAgentCannotPublish() {
      throw new PublisherError(
        "UNSUPPORTED_CAPABILITY",
        "Agents cannot publish. Publishing requires an explicit application action.",
        {
          userMessage:
            "Publishing must be started from Inzorya — Agents cannot publish.",
        },
      );
    },
  };
}

export type PublishingService = ReturnType<typeof createPublishingService>;
export const publishing = createPublishingService();
