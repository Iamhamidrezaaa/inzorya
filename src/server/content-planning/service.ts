import type {
  ContentSchedulePlanningSource,
  ContentScheduleStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ContentScheduleProposal } from "@/server/agent/content-planner/output";
import { runContentPlannerAgent } from "@/server/agent/content-planner";
import type { LLMProvider } from "@/server/agent/llm";
import type { ToolRegistry } from "@/server/agent/tool-registry";
import { getSocialProviderRegistry } from "@/server/social/registry";

export class ContentPlanningError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "INVALID_STATUS"
    | "INVALID_TRANSITION"
    | "VALIDATION_ERROR"
    | "UNSUPPORTED_PLATFORM"
    | "PUBLISH_NOT_ALLOWED";

  constructor(code: ContentPlanningError["code"], message: string) {
    super(message);
    this.name = "ContentPlanningError";
    this.code = code;
  }
}

export type PlanningConflict = {
  type: string;
  severity: "warning" | "error";
  items: string[];
  message: string;
};

export type PublishabilityInfo = {
  draftId: string;
  scheduleId?: string;
  publishable: boolean;
  reason?: string;
};

const DEFAULT_TIMEZONE = "Asia/Tehran";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseDateOnly(date: string | Date): Date {
  if (date instanceof Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (!m) throw new ContentPlanningError("VALIDATION_ERROR", `Invalid date: ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function normalizeTime(time: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) throw new ContentPlanningError("VALIDATION_ERROR", `Invalid time: ${time}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) {
    throw new ContentPlanningError("VALIDATION_ERROR", `Invalid time: ${time}`);
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function assertPlatformNotExcluded(channel: string) {
  const c = channel.toLowerCase();
  if (c === "pinterest") {
    throw new ContentPlanningError(
      "UNSUPPORTED_PLATFORM",
      "Pinterest is not part of Inzorya.",
    );
  }
  if (c === "meta" || c === "instagram" || c === "facebook" || c === "tiktok") {
    // Planning allowed as channel label, but never treat as publishable via Meta/TikTok providers
    return;
  }
}

export function detectScheduleConflicts(
  items: Array<{
    id?: string;
    draftId: string;
    date: string;
    time: string;
    channel: string;
  }>,
): PlanningConflict[] {
  const conflicts: PlanningConflict[] = [];
  const bySlot = new Map<string, string[]>();

  for (const item of items) {
    const key = `${item.date}|${normalizeTime(item.time)}|${item.channel.toLowerCase()}`;
    const list = bySlot.get(key) ?? [];
    list.push(item.draftId);
    bySlot.set(key, list);
  }

  for (const [key, draftIds] of bySlot) {
    if (draftIds.length > 1) {
      const [date, time] = key.split("|");
      conflicts.push({
        type: "SCHEDULE_CONFLICT",
        severity: "warning",
        items: draftIds,
        message: `Two or more contents are planned for the same time (${date} ${time}).`,
      });
    }
  }

  const byDay = new Map<string, string[]>();
  for (const item of items) {
    const list = byDay.get(item.date) ?? [];
    list.push(item.draftId);
    byDay.set(item.date, list);
  }
  for (const [date, draftIds] of byDay) {
    if (draftIds.length > 3) {
      conflicts.push({
        type: "FREQUENCY_WARNING",
        severity: "warning",
        items: draftIds,
        message: `High posting frequency on ${date} (${draftIds.length} items).`,
      });
    }
  }

  return conflicts;
}

export async function resolvePublishability(input: {
  brandId: string;
  workspaceId: string;
  channel: string;
  socialAccountId?: string | null;
}): Promise<{ publishable: boolean; reason: string }> {
  assertPlatformNotExcluded(input.channel);
  const channel = input.channel.toLowerCase();

  if (channel === "meta" || channel === "instagram" || channel === "facebook") {
    return {
      publishable: false,
      reason: "META_UNAVAILABLE",
    };
  }
  if (channel === "tiktok") {
    return { publishable: false, reason: "TIKTOK_UNAVAILABLE" };
  }
  if (channel === "pinterest") {
    return { publishable: false, reason: "PINTEREST_REMOVED" };
  }

  if (!input.socialAccountId) {
    return {
      publishable: false,
      reason: "NO_CONNECTED_SOCIAL_ACCOUNT",
    };
  }

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: input.socialAccountId,
      brandId: input.brandId,
      workspaceId: input.workspaceId,
      disconnectedAt: null,
    },
  });
  if (!account || account.status !== "CONNECTED") {
    return {
      publishable: false,
      reason: "SOCIAL_ACCOUNT_NOT_CONNECTED",
    };
  }

  const caps = (account.capabilities || {}) as { publishing?: boolean };
  if (!caps.publishing) {
    return {
      publishable: false,
      reason: "SOCIAL_PUBLISHING_NOT_AVAILABLE",
    };
  }

  const { getSocialPublisherRegistry } = await import(
    "@/server/publishing/registry"
  );
  if (!getSocialPublisherRegistry().has(account.platform)) {
    return {
      publishable: false,
      reason: "SOCIAL_PUBLISHING_NOT_AVAILABLE",
    };
  }

  return {
    publishable: true,
    reason: "PUBLISHABLE",
  };
}

async function appendHistory(
  scheduleId: string,
  snapshot: {
    plannedDate: Date;
    plannedTime: string;
    timezone: string;
    channel: string;
    status: ContentScheduleStatus;
    planningSource: ContentSchedulePlanningSource;
  },
  changeSummary: string,
  changedById?: string | null,
) {
  await prisma.contentScheduleHistory.create({
    data: {
      scheduleId,
      plannedDate: snapshot.plannedDate,
      plannedTime: snapshot.plannedTime,
      timezone: snapshot.timezone,
      channel: snapshot.channel,
      status: snapshot.status,
      planningSource: snapshot.planningSource,
      changeSummary,
      changedById: changedById ?? null,
    },
  });
}

export function createContentPlanningService() {
  async function requireScopedDraft(
    draftId: string,
    scope: { workspaceId: string; brandId: string },
  ) {
    const draft = await prisma.contentDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft) {
      throw new ContentPlanningError("NOT_FOUND", "Content draft not found.");
    }
    if (
      draft.workspaceId !== scope.workspaceId ||
      draft.brandId !== scope.brandId
    ) {
      throw new ContentPlanningError(
        "FORBIDDEN",
        "Draft is outside workspace/brand scope.",
      );
    }
    return draft;
  }

  async function requireScopedSchedule(
    id: string,
    scope: { workspaceId: string; brandId: string },
  ) {
    const schedule = await prisma.contentSchedule.findUnique({
      where: { id },
      include: {
        contentDraft: true,
        history: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!schedule) {
      throw new ContentPlanningError("NOT_FOUND", "Schedule not found.");
    }
    if (
      schedule.workspaceId !== scope.workspaceId ||
      schedule.brandId !== scope.brandId
    ) {
      throw new ContentPlanningError(
        "FORBIDDEN",
        "Schedule is outside workspace/brand scope.",
      );
    }
    return schedule;
  }

  const service = {
    async list(
      scope: { workspaceId: string; brandId: string },
      filters?: {
        from?: string;
        to?: string;
        status?: ContentScheduleStatus | ContentScheduleStatus[];
      },
    ) {
      const statuses = filters?.status
        ? Array.isArray(filters.status)
          ? filters.status
          : [filters.status]
        : undefined;

      return prisma.contentSchedule.findMany({
        where: {
          workspaceId: scope.workspaceId,
          brandId: scope.brandId,
          ...(statuses ? { status: { in: statuses } } : {}),
          ...(filters?.from || filters?.to
            ? {
                plannedDate: {
                  ...(filters.from
                    ? { gte: parseDateOnly(filters.from) }
                    : {}),
                  ...(filters.to ? { lte: parseDateOnly(filters.to) } : {}),
                },
              }
            : {}),
        },
        include: {
          contentDraft: {
            select: {
              id: true,
              topic: true,
              format: true,
              channel: true,
              status: true,
              contentPayload: true,
            },
          },
        },
        orderBy: [{ plannedDate: "asc" }, { plannedTime: "asc" }],
      });
    },

    async get(id: string, scope: { workspaceId: string; brandId: string }) {
      return requireScopedSchedule(id, scope);
    },

    async createFromReadyDraft(input: {
      workspaceId: string;
      brandId: string;
      userId: string;
      contentDraftId: string;
      channel?: string;
      socialAccountId?: string | null;
      plannedDate: string;
      plannedTime: string;
      timezone?: string;
      rationale?: string;
      planningSource?: ContentSchedulePlanningSource;
      evidence?: unknown;
      confidence?: string;
    }) {
      const draft = await requireScopedDraft(input.contentDraftId, {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
      });
      if (draft.status !== "READY") {
        throw new ContentPlanningError(
          "INVALID_STATUS",
          `Only READY drafts can be planned (current: ${draft.status}).`,
        );
      }

      const channel = input.channel || draft.channel;
      assertPlatformNotExcluded(channel);

      if (input.socialAccountId) {
        const account = await prisma.socialAccount.findFirst({
          where: {
            id: input.socialAccountId,
            brandId: input.brandId,
            workspaceId: input.workspaceId,
          },
        });
        if (!account) {
          throw new ContentPlanningError(
            "FORBIDDEN",
            "Social account is outside brand scope.",
          );
        }
      }

      const pub = await resolvePublishability({
        brandId: input.brandId,
        workspaceId: input.workspaceId,
        channel,
        socialAccountId: input.socialAccountId,
      });

      const plannedDate = parseDateOnly(input.plannedDate);
      const plannedTime = normalizeTime(input.plannedTime);
      const timezone = input.timezone || DEFAULT_TIMEZONE;
      const planningSource = input.planningSource ?? "HUMAN";

      const schedule = await prisma.contentSchedule.create({
        data: {
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          contentDraftId: draft.id,
          channel,
          socialAccountId: input.socialAccountId ?? null,
          plannedDate,
          plannedTime,
          timezone,
          status: "PLANNED",
          planningSource,
          rationale: input.rationale ?? null,
          evidence: input.evidence ? asJson(input.evidence) : undefined,
          confidence: input.confidence ?? null,
          publishable: pub.publishable,
          publishabilityReason: pub.reason,
          createdById: input.userId,
        },
      });

      await appendHistory(
        schedule.id,
        {
          plannedDate,
          plannedTime,
          timezone,
          channel,
          status: "PLANNED",
          planningSource,
        },
        "Created plan",
        input.userId,
      );

      return schedule;
    },

    async propose(input: {
      workspaceId: string;
      brandId: string;
      userId: string;
      message: string;
      draftIds?: string[];
      timezone?: string;
      persist?: boolean;
      llm?: LLMProvider;
      toolRegistry?: ToolRegistry;
    }) {
      const drafts = await prisma.contentDraft.findMany({
        where: {
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          status: "READY",
          ...(input.draftIds?.length
            ? { id: { in: input.draftIds } }
            : {}),
        },
      });

      if (input.draftIds?.length) {
        for (const id of input.draftIds) {
          const d = drafts.find((x) => x.id === id);
          if (!d) {
            // Either missing or not READY
            const existing = await prisma.contentDraft.findUnique({
              where: { id },
            });
            if (
              existing &&
              (existing.workspaceId !== input.workspaceId ||
                existing.brandId !== input.brandId)
            ) {
              throw new ContentPlanningError("FORBIDDEN", "Draft scope mismatch.");
            }
            if (existing && existing.status !== "READY") {
              throw new ContentPlanningError(
                "INVALID_STATUS",
                `Draft ${id} is ${existing.status}, not READY.`,
              );
            }
            if (!existing) {
              throw new ContentPlanningError("NOT_FOUND", `Draft ${id} not found.`);
            }
          }
        }
      }

      const accounts = await prisma.socialAccount.findMany({
        where: {
          workspaceId: input.workspaceId,
          brandId: input.brandId,
          disconnectedAt: null,
          status: { not: "DISCONNECTED" },
        },
      });

      const providers = getSocialProviderRegistry()
        .listProviders()
        .map((p) => p.descriptor());

      const contextBlock = JSON.stringify(
        {
          timezone: input.timezone || DEFAULT_TIMEZONE,
          readyDrafts: drafts.map((d) => ({
            id: d.id,
            channel: d.channel,
            format: d.format,
            topic: d.topic,
            objective: d.objective,
            status: d.status,
          })),
          socialAccounts: accounts.map((a) => ({
            id: a.id,
            platform: a.platform,
            status: a.status,
            capabilities: a.capabilities,
          })),
          providers,
          unavailablePlatforms: ["meta", "tiktok", "pinterest"],
          note: "Only READY drafts may be scheduled. Publishing is never executed in this step.",
        },
        null,
        2,
      );

      const result = await runContentPlannerAgent({
        message: input.message,
        userId: input.userId,
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        contextBlock,
        llm: input.llm,
        toolRegistry: input.toolRegistry,
      });

      const proposal = result.proposal;

      // Enforce constraint coverage: if drafts provided, ensure we don't invent non-READY ids
      const readyIds = new Set(drafts.map((d) => d.id));
      proposal.schedule = proposal.schedule.filter((s) => readyIds.has(s.draftId));

      const conflictExtras = detectScheduleConflicts(
        proposal.schedule.map((s) => ({
          draftId: s.draftId,
          date: s.date,
          time: s.time,
          channel: s.channel,
        })),
      );
      const conflicts = [...proposal.conflicts, ...conflictExtras];

      const publishability: PublishabilityInfo[] = [];
      for (const item of proposal.schedule) {
        const pub = await resolvePublishability({
          brandId: input.brandId,
          workspaceId: input.workspaceId,
          channel: item.channel,
          socialAccountId: item.socialAccountId,
        });
        publishability.push({
          draftId: item.draftId,
          publishable: pub.publishable,
          reason: pub.reason,
        });
      }

      // Merge publishability into proposal
      const enriched: ContentScheduleProposal = {
        ...proposal,
        conflicts,
        publishability:
          proposal.publishability.length > 0
            ? proposal.publishability
            : publishability.map((p) => ({
                draftId: p.draftId,
                publishable: p.publishable,
                reason: p.reason,
              })),
        limitations: [
          ...proposal.limitations,
          ...(proposal.limitations.some((l) =>
            /historical performance|NO_PERFORMANCE_EVIDENCE/i.test(l),
          )
            ? []
            : []),
        ],
      };

      let created: Awaited<ReturnType<typeof prisma.contentSchedule.create>>[] =
        [];
      if (input.persist !== false) {
        for (const item of enriched.schedule) {
          const pub = publishability.find((p) => p.draftId === item.draftId);
          try {
            const row = await service.createFromReadyDraft({
              workspaceId: input.workspaceId,
              brandId: input.brandId,
              userId: input.userId,
              contentDraftId: item.draftId,
              channel: item.channel,
              socialAccountId: item.socialAccountId,
              plannedDate: item.date,
              plannedTime: item.time,
              timezone: item.timezone || input.timezone || DEFAULT_TIMEZONE,
              rationale: item.reason,
              planningSource: "AI",
              evidence: item.evidence,
              confidence: item.confidence,
            });
            // fix publishability fields if create used defaults
            if (pub) {
              await prisma.contentSchedule.update({
                where: { id: row.id },
                data: {
                  publishable: pub.publishable,
                  publishabilityReason: pub.reason ?? null,
                },
              });
            }
            created.push(row);
          } catch {
            // skip invalid items
          }
        }
      }

      return {
        proposal: enriched,
        schedules: created,
        agent: {
          executionId: result.executionId,
          success: result.success,
          limitations: enriched.limitations,
        },
      };
    },

    async confirm(
      id: string,
      scope: { workspaceId: string; brandId: string },
      userId: string,
    ) {
      const schedule = await requireScopedSchedule(id, scope);
      if (schedule.status !== "PLANNED") {
        throw new ContentPlanningError(
          "INVALID_TRANSITION",
          `Only PLANNED can become SCHEDULED (current: ${schedule.status}).`,
        );
      }
      const updated = await prisma.contentSchedule.update({
        where: { id },
        data: { status: "SCHEDULED" },
      });
      await appendHistory(
        id,
        {
          plannedDate: updated.plannedDate,
          plannedTime: updated.plannedTime,
          timezone: updated.timezone,
          channel: updated.channel,
          status: "SCHEDULED",
          planningSource: "HUMAN",
        },
        "Human confirmed schedule",
        userId,
      );
      return updated;
    },

    /** AI / system must never call this — exposed only for tests asserting rejection. */
    assertAiCannotConfirm() {
      throw new ContentPlanningError(
        "INVALID_TRANSITION",
        "AI cannot confirm schedule. Human confirmation required.",
      );
    },

    async reschedule(
      id: string,
      scope: { workspaceId: string; brandId: string },
      userId: string,
      input: {
        plannedDate?: string;
        plannedTime?: string;
        channel?: string;
        timezone?: string;
        socialAccountId?: string | null;
      },
    ) {
      const schedule = await requireScopedSchedule(id, scope);
      if (schedule.status === "CANCELLED") {
        throw new ContentPlanningError(
          "INVALID_STATUS",
          "Cannot reschedule a cancelled plan.",
        );
      }

      const plannedDate = input.plannedDate
        ? parseDateOnly(input.plannedDate)
        : schedule.plannedDate;
      const plannedTime = input.plannedTime
        ? normalizeTime(input.plannedTime)
        : schedule.plannedTime;
      const channel = input.channel || schedule.channel;
      const timezone = input.timezone || schedule.timezone;
      const socialAccountId =
        input.socialAccountId !== undefined
          ? input.socialAccountId
          : schedule.socialAccountId;

      if (socialAccountId) {
        const account = await prisma.socialAccount.findFirst({
          where: {
            id: socialAccountId,
            brandId: scope.brandId,
            workspaceId: scope.workspaceId,
          },
        });
        if (!account) {
          throw new ContentPlanningError(
            "FORBIDDEN",
            "Social account is outside brand scope.",
          );
        }
      }

      const pub = await resolvePublishability({
        brandId: scope.brandId,
        workspaceId: scope.workspaceId,
        channel,
        socialAccountId,
      });

      const updated = await prisma.contentSchedule.update({
        where: { id },
        data: {
          plannedDate,
          plannedTime,
          channel,
          timezone,
          socialAccountId,
          planningSource: "HUMAN",
          // Manual edit returns to PLANNED if was SCHEDULED? Epic: manual override. Keep status unless cancelled.
          publishable: pub.publishable,
          publishabilityReason: pub.reason,
        },
      });

      await appendHistory(
        id,
        {
          plannedDate,
          plannedTime,
          timezone,
          channel,
          status: updated.status,
          planningSource: "HUMAN",
        },
        "Human reschedule",
        userId,
      );

      return updated;
    },

    async cancel(
      id: string,
      scope: { workspaceId: string; brandId: string },
      userId: string,
    ) {
      const schedule = await requireScopedSchedule(id, scope);
      const updated = await prisma.contentSchedule.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await appendHistory(
        id,
        {
          plannedDate: updated.plannedDate,
          plannedTime: updated.plannedTime,
          timezone: updated.timezone,
          channel: updated.channel,
          status: "CANCELLED",
          planningSource: "HUMAN",
        },
        "Cancelled by human",
        userId,
      );
      return updated;
    },

    async patch(
      id: string,
      scope: { workspaceId: string; brandId: string },
      userId: string,
      input: {
        plannedDate?: string;
        plannedTime?: string;
        channel?: string;
        timezone?: string;
        rationale?: string;
        socialAccountId?: string | null;
      },
    ) {
      return service.reschedule(id, scope, userId, input);
    },

    async remove(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      await requireScopedSchedule(id, scope);
      await prisma.contentSchedule.delete({ where: { id } });
      return { ok: true };
    },

    async conflictsForBrand(
      scope: { workspaceId: string; brandId: string },
      from?: string,
      to?: string,
    ) {
      const rows = await service.list(scope, {
        from,
        to,
        status: ["PLANNED", "SCHEDULED"],
      });
      return detectScheduleConflicts(
        rows.map((r) => ({
          id: r.id,
          draftId: r.contentDraftId,
          date: r.plannedDate.toISOString().slice(0, 10),
          time: r.plannedTime,
          channel: r.channel,
        })),
      );
    },

    assertNoExternalPublish() {
      throw new ContentPlanningError(
        "PUBLISH_NOT_ALLOWED",
        "No external social publishing or platform scheduling is implemented.",
      );
    },
  };

  return service;
}

export const contentPlanning = createContentPlanningService();
