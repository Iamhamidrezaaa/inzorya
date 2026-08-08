import { randomUUID } from "node:crypto";
import type {
  ContentDraftStatus,
  ContentDraftVersionSource,
  ContentReviewStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ContentAsset } from "@/server/agent/content-creator/output";
import { mapCreatorAssetToDraft } from "@/server/content-workspace/from-creator";
import {
  applyComponentPatch,
  applyHumanEdit,
  searchTextFromPayload,
} from "@/server/content-workspace/payload";
import {
  createStubRegenerator,
  defaultComponentRegenerator,
  type ComponentRegenerator,
} from "@/server/content-workspace/regenerate";
import { statusForReviewAction } from "@/server/content-workspace/transitions";
import {
  contentDraftPayloadSchema,
  ContentWorkspaceError,
  type BlueprintReference,
  type ContentDraftPayload,
  type ContentDraftRecord,
  type ContentDraftVersionRecord,
  type ContentReviewRecord,
  type EvidenceItem,
  type HumanEditInput,
  type RegenerableComponent,
  type ReviewAction,
} from "@/server/content-workspace/types";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parsePayload(raw: unknown): ContentDraftPayload {
  return contentDraftPayloadSchema.parse(raw ?? {});
}

function parseBlueprint(raw: unknown): BlueprintReference | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as BlueprintReference;
}

function parseEvidence(raw: unknown): EvidenceItem[] | null {
  if (!Array.isArray(raw)) return null;
  return raw as EvidenceItem[];
}

function mapDraftRow(row: {
  id: string;
  workspaceId: string;
  brandId: string;
  createdById: string;
  sourceAgentExecutionId: string | null;
  blueprintReference: unknown;
  channel: string;
  format: string;
  topic: string;
  objective: string | null;
  audience: string | null;
  pillar: string | null;
  angle: string | null;
  whyNow: string | null;
  evidence: unknown;
  contentPayload: unknown;
  status: ContentDraftStatus;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): ContentDraftRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    brandId: row.brandId,
    createdById: row.createdById,
    sourceAgentExecutionId: row.sourceAgentExecutionId,
    blueprintReference: parseBlueprint(row.blueprintReference),
    channel: row.channel,
    format: row.format,
    topic: row.topic,
    objective: row.objective,
    audience: row.audience,
    pillar: row.pillar,
    angle: row.angle,
    whyNow: row.whyNow,
    evidence: parseEvidence(row.evidence),
    contentPayload: parsePayload(row.contentPayload),
    status: row.status,
    currentVersion: row.currentVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type ListDraftsFilter = {
  workspaceId: string;
  brandId: string;
  status?: ContentDraftStatus | ContentDraftStatus[];
  channel?: string;
  format?: string;
  objective?: string;
  q?: string;
  from?: Date;
  to?: Date;
};

export type ContentDraftStore = {
  createDraft(data: {
    workspaceId: string;
    brandId: string;
    createdById: string;
    sourceAgentExecutionId: string | null;
    blueprintReference: BlueprintReference | null;
    channel: string;
    format: string;
    topic: string;
    objective: string | null;
    audience: string | null;
    pillar: string | null;
    angle: string | null;
    whyNow: string | null;
    evidence: EvidenceItem[] | null;
    contentPayload: ContentDraftPayload;
  }): Promise<ContentDraftRecord>;
  getDraft(id: string): Promise<ContentDraftRecord | null>;
  updateDraft(
    id: string,
    data: Partial<{
      contentPayload: ContentDraftPayload;
      status: ContentDraftStatus;
      currentVersion: number;
    }>,
  ): Promise<ContentDraftRecord>;
  listDrafts(filter: ListDraftsFilter): Promise<ContentDraftRecord[]>;
  createVersion(data: {
    contentDraftId: string;
    version: number;
    source: ContentDraftVersionSource;
    contentPayload: ContentDraftPayload;
    changeSummary?: string | null;
    component?: string | null;
    instruction?: string | null;
    createdById?: string | null;
  }): Promise<ContentDraftVersionRecord>;
  listVersions(contentDraftId: string): Promise<ContentDraftVersionRecord[]>;
  createReview(data: {
    contentDraftId: string;
    reviewerId: string;
    status: ContentReviewStatus;
    note?: string | null;
  }): Promise<ContentReviewRecord>;
  listReviews(contentDraftId: string): Promise<ContentReviewRecord[]>;
};

export function createMemoryStore(): ContentDraftStore {
  const drafts = new Map<string, ContentDraftRecord>();
  const versions = new Map<string, ContentDraftVersionRecord[]>();
  const reviews = new Map<string, ContentReviewRecord[]>();

  return {
    async createDraft(data) {
      const now = new Date();
      const draft: ContentDraftRecord = {
        id: randomUUID(),
        ...data,
        status: "DRAFT",
        currentVersion: 1,
        createdAt: now,
        updatedAt: now,
      };
      drafts.set(draft.id, draft);
      versions.set(draft.id, []);
      reviews.set(draft.id, []);
      return draft;
    },
    async getDraft(id) {
      return drafts.get(id) ?? null;
    },
    async updateDraft(id, data) {
      const existing = drafts.get(id);
      if (!existing) {
        throw new ContentWorkspaceError("NOT_FOUND", "Draft not found.");
      }
      const next = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      drafts.set(id, next);
      return next;
    },
    async listDrafts(filter) {
      let rows = [...drafts.values()].filter(
        (d) =>
          d.workspaceId === filter.workspaceId &&
          d.brandId === filter.brandId,
      );
      if (filter.status) {
        const statuses = Array.isArray(filter.status)
          ? filter.status
          : [filter.status];
        rows = rows.filter((d) => statuses.includes(d.status));
      }
      if (filter.channel) {
        rows = rows.filter(
          (d) => d.channel.toLowerCase() === filter.channel!.toLowerCase(),
        );
      }
      if (filter.format) {
        rows = rows.filter(
          (d) => d.format.toLowerCase() === filter.format!.toLowerCase(),
        );
      }
      if (filter.objective) {
        rows = rows.filter(
          (d) =>
            (d.objective || "").toLowerCase() ===
            filter.objective!.toLowerCase(),
        );
      }
      if (filter.from) {
        rows = rows.filter((d) => d.createdAt >= filter.from!);
      }
      if (filter.to) {
        rows = rows.filter((d) => d.createdAt <= filter.to!);
      }
      if (filter.q) {
        const q = filter.q.toLowerCase();
        rows = rows.filter((d) => {
          const hay = [
            d.topic,
            d.objective,
            d.angle,
            searchTextFromPayload(d.contentPayload),
            d.blueprintReference?.summary,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
      }
      return rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },
    async createVersion(data) {
      const row: ContentDraftVersionRecord = {
        id: randomUUID(),
        contentDraftId: data.contentDraftId,
        version: data.version,
        source: data.source,
        contentPayload: data.contentPayload,
        changeSummary: data.changeSummary ?? null,
        component: data.component ?? null,
        instruction: data.instruction ?? null,
        createdById: data.createdById ?? null,
        createdAt: new Date(),
      };
      const list = versions.get(data.contentDraftId) ?? [];
      list.push(row);
      versions.set(data.contentDraftId, list);
      return row;
    },
    async listVersions(contentDraftId) {
      return [...(versions.get(contentDraftId) ?? [])].sort(
        (a, b) => b.version - a.version,
      );
    },
    async createReview(data) {
      const row: ContentReviewRecord = {
        id: randomUUID(),
        contentDraftId: data.contentDraftId,
        reviewerId: data.reviewerId,
        status: data.status,
        note: data.note ?? null,
        createdAt: new Date(),
      };
      const list = reviews.get(data.contentDraftId) ?? [];
      list.push(row);
      reviews.set(data.contentDraftId, list);
      return row;
    },
    async listReviews(contentDraftId) {
      return [...(reviews.get(contentDraftId) ?? [])].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    },
  };
}

export const prismaContentDraftStore: ContentDraftStore = {
  async createDraft(data) {
    const row = await prisma.contentDraft.create({
      data: {
        workspaceId: data.workspaceId,
        brandId: data.brandId,
        createdById: data.createdById,
        sourceAgentExecutionId: data.sourceAgentExecutionId,
        blueprintReference: data.blueprintReference
          ? asJson(data.blueprintReference)
          : undefined,
        channel: data.channel,
        format: data.format,
        topic: data.topic,
        objective: data.objective,
        audience: data.audience,
        pillar: data.pillar,
        angle: data.angle,
        whyNow: data.whyNow,
        evidence: data.evidence ? asJson(data.evidence) : undefined,
        contentPayload: asJson(data.contentPayload),
        status: "DRAFT",
        currentVersion: 1,
      },
    });
    return mapDraftRow(row);
  },
  async getDraft(id) {
    const row = await prisma.contentDraft.findUnique({ where: { id } });
    return row ? mapDraftRow(row) : null;
  },
  async updateDraft(id, data) {
    const row = await prisma.contentDraft.update({
      where: { id },
      data: {
        ...(data.contentPayload
          ? { contentPayload: asJson(data.contentPayload) }
          : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.currentVersion !== undefined
          ? { currentVersion: data.currentVersion }
          : {}),
      },
    });
    return mapDraftRow(row);
  },
  async listDrafts(filter) {
    const statuses = filter.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : undefined;

    const rows = await prisma.contentDraft.findMany({
      where: {
        workspaceId: filter.workspaceId,
        brandId: filter.brandId,
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(filter.channel
          ? { channel: { equals: filter.channel, mode: "insensitive" } }
          : {}),
        ...(filter.format
          ? { format: { equals: filter.format, mode: "insensitive" } }
          : {}),
        ...(filter.objective
          ? { objective: { equals: filter.objective, mode: "insensitive" } }
          : {}),
        ...(filter.from || filter.to
          ? {
              createdAt: {
                ...(filter.from ? { gte: filter.from } : {}),
                ...(filter.to ? { lte: filter.to } : {}),
              },
            }
          : {}),
        ...(filter.q
          ? {
              OR: [
                { topic: { contains: filter.q, mode: "insensitive" } },
                { objective: { contains: filter.q, mode: "insensitive" } },
                { angle: { contains: filter.q, mode: "insensitive" } },
                { whyNow: { contains: filter.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    let mapped = rows.map(mapDraftRow);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      mapped = mapped.filter((d) => {
        if (
          d.topic.toLowerCase().includes(q) ||
          (d.objective || "").toLowerCase().includes(q) ||
          (d.angle || "").toLowerCase().includes(q)
        ) {
          return true;
        }
        return searchTextFromPayload(d.contentPayload).includes(q);
      });
    }
    return mapped;
  },
  async createVersion(data) {
    const row = await prisma.contentDraftVersion.create({
      data: {
        contentDraftId: data.contentDraftId,
        version: data.version,
        source: data.source,
        contentPayload: asJson(data.contentPayload),
        changeSummary: data.changeSummary ?? null,
        component: data.component ?? null,
        instruction: data.instruction ?? null,
        createdById: data.createdById ?? null,
      },
    });
    return {
      id: row.id,
      contentDraftId: row.contentDraftId,
      version: row.version,
      source: row.source,
      contentPayload: parsePayload(row.contentPayload),
      changeSummary: row.changeSummary,
      component: row.component,
      instruction: row.instruction,
      createdById: row.createdById,
      createdAt: row.createdAt,
    };
  },
  async listVersions(contentDraftId) {
    const rows = await prisma.contentDraftVersion.findMany({
      where: { contentDraftId },
      orderBy: { version: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      contentDraftId: row.contentDraftId,
      version: row.version,
      source: row.source,
      contentPayload: parsePayload(row.contentPayload),
      changeSummary: row.changeSummary,
      component: row.component,
      instruction: row.instruction,
      createdById: row.createdById,
      createdAt: row.createdAt,
    }));
  },
  async createReview(data) {
    const row = await prisma.contentReview.create({
      data: {
        contentDraftId: data.contentDraftId,
        reviewerId: data.reviewerId,
        status: data.status,
        note: data.note ?? null,
      },
    });
    return {
      id: row.id,
      contentDraftId: row.contentDraftId,
      reviewerId: row.reviewerId,
      status: row.status,
      note: row.note,
      createdAt: row.createdAt,
    };
  },
  async listReviews(contentDraftId) {
    const rows = await prisma.contentReview.findMany({
      where: { contentDraftId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      contentDraftId: row.contentDraftId,
      reviewerId: row.reviewerId,
      status: row.status,
      note: row.note,
      createdAt: row.createdAt,
    }));
  },
};

export type ContentWorkspaceServiceOptions = {
  store?: ContentDraftStore;
  regenerator?: ComponentRegenerator;
};

export function createContentWorkspaceService(
  options: ContentWorkspaceServiceOptions = {},
) {
  const store = options.store ?? prismaContentDraftStore;
  const regenerator = options.regenerator ?? defaultComponentRegenerator;

  async function requireScopedDraft(
    id: string,
    scope: { workspaceId: string; brandId: string },
  ) {
    const draft = await store.getDraft(id);
    if (!draft) {
      throw new ContentWorkspaceError("NOT_FOUND", "Draft not found.");
    }
    if (
      draft.workspaceId !== scope.workspaceId ||
      draft.brandId !== scope.brandId
    ) {
      throw new ContentWorkspaceError(
        "FORBIDDEN",
        "Draft is outside workspace/brand scope.",
      );
    }
    return draft;
  }

  async function appendVersion(
    draft: ContentDraftRecord,
    args: {
      source: ContentDraftVersionSource;
      contentPayload: ContentDraftPayload;
      createdById?: string | null;
      changeSummary?: string | null;
      component?: string | null;
      instruction?: string | null;
    },
  ) {
    const version = draft.currentVersion + 1;
    await store.createVersion({
      contentDraftId: draft.id,
      version,
      source: args.source,
      contentPayload: args.contentPayload,
      changeSummary: args.changeSummary,
      component: args.component,
      instruction: args.instruction,
      createdById: args.createdById,
    });
    return store.updateDraft(draft.id, {
      contentPayload: args.contentPayload,
      currentVersion: version,
    });
  }

  return {
    async createFromCreatorOutput(input: {
      workspaceId: string;
      brandId: string;
      createdById: string;
      asset: ContentAsset;
      sourceAgentExecutionId?: string | null;
      blueprintReference?: BlueprintReference | null;
      evidence?: EvidenceItem[] | null;
      whyNow?: string | null;
    }) {
      const mapped = mapCreatorAssetToDraft(input);
      const draft = await store.createDraft(mapped);
      await store.createVersion({
        contentDraftId: draft.id,
        version: 1,
        source: "AI_CREATE",
        contentPayload: draft.contentPayload,
        changeSummary: "Created from Content Creator output",
        createdById: input.createdById,
      });
      return draft;
    },

    async list(
      filter: ListDraftsFilter,
    ): Promise<ContentDraftRecord[]> {
      return store.listDrafts(filter);
    },

    async get(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      return requireScopedDraft(id, scope);
    },

    async humanEdit(
      id: string,
      scope: { workspaceId: string; brandId: string },
      userId: string,
      edit: HumanEditInput,
    ) {
      const draft = await requireScopedDraft(id, scope);
      const nextPayload = applyHumanEdit(draft.contentPayload, edit);
      return appendVersion(draft, {
        source: "HUMAN_EDIT",
        contentPayload: nextPayload,
        createdById: userId,
        changeSummary: "Human edit",
      });
    },

    async regenerateComponent(
      id: string,
      scope: { workspaceId: string; brandId: string },
      userId: string,
      component: RegenerableComponent,
      instruction?: string,
    ) {
      const draft = await requireScopedDraft(id, scope);
      if (draft.status === "IN_REVIEW" || draft.status === "READY") {
        // Allow regenerate only when editing is productive; IN_REVIEW can still edit per epic.
      }
      const patch = await regenerator({
        component,
        instruction,
        draft,
      });
      const nextPayload = applyComponentPatch(
        draft.contentPayload,
        component,
        patch,
      );
      return appendVersion(draft, {
        source: "AI_REGENERATE",
        contentPayload: nextPayload,
        createdById: userId,
        changeSummary: `AI regenerated ${component}`,
        component,
        instruction: instruction ?? null,
      });
    },

    async review(
      id: string,
      scope: { workspaceId: string; brandId: string },
      reviewerId: string,
      action: ReviewAction,
      note?: string | null,
    ) {
      const draft = await requireScopedDraft(id, scope);

      if (action === "note") {
        await store.createReview({
          contentDraftId: draft.id,
          reviewerId,
          status: "NOTE",
          note: note ?? null,
        });
        return draft;
      }

      const nextStatus = statusForReviewAction(action, draft.status);
      const reviewStatus: ContentReviewStatus =
        action === "send_for_review"
          ? "SENT_FOR_REVIEW"
          : action === "request_changes"
            ? "CHANGES_REQUESTED"
            : action === "approve"
              ? "APPROVED"
              : action === "mark_ready"
                ? "READY"
                : "NOTE";

      await store.createReview({
        contentDraftId: draft.id,
        reviewerId,
        status: reviewStatus,
        note: note ?? null,
      });

      return store.updateDraft(draft.id, { status: nextStatus });
    },

    async listVersions(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      await requireScopedDraft(id, scope);
      return store.listVersions(id);
    },

    async listReviews(
      id: string,
      scope: { workspaceId: string; brandId: string },
    ) {
      await requireScopedDraft(id, scope);
      return store.listReviews(id);
    },

    assertNoPublish() {
      throw new ContentWorkspaceError(
        "PUBLISH_NOT_ALLOWED",
        "Publishing is not available in Content Workspace.",
      );
    },
  };
}

export type ContentWorkspaceService = ReturnType<
  typeof createContentWorkspaceService
>;

export const contentWorkspace = createContentWorkspaceService();

export { createStubRegenerator };
