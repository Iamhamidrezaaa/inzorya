import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ContentFormat,
  ContentPlatform,
  ContentPriority,
  ContentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import { DEFAULT_CHECKLIST, DEFAULT_TEMPLATES } from "@/lib/content-studio";
import { recordActivity } from "@/server/services/workspace-experience";

const includeContent = {
  campaign: true,
  pillar: true,
  assignee: { select: { id: true, name: true, email: true } },
  brief: true,
  checklist: { orderBy: { sortOrder: "asc" as const } },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  attachments: true,
} as const;

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const id = searchParams.get("id");

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (id) {
      const item = await prisma.contentItem.findFirst({
        where: { id, brandId: access.brand.id, deletedAt: null },
        include: includeContent,
      });
      if (!item) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      return NextResponse.json({ item });
    }

    const status = searchParams.get("status");
    const campaignId = searchParams.get("campaignId");
    const platform = searchParams.get("platform");
    const priority = searchParams.get("priority");
    const pillarId = searchParams.get("pillarId");
    const assigneeId = searchParams.get("assigneeId");
    const q = searchParams.get("q")?.trim() || "";

    const items = await prisma.contentItem.findMany({
      where: {
        brandId: access.brand.id,
        deletedAt: null,
        status: { not: "ARCHIVED" },
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(status && status !== "ALL" ? { status: status as ContentStatus } : {}),
        ...(campaignId && campaignId !== "ALL" ? { campaignId } : {}),
        ...(platform && platform !== "ALL"
          ? { platform: platform as ContentPlatform }
          : {}),
        ...(priority && priority !== "ALL"
          ? { priority: priority as ContentPriority }
          : {}),
        ...(pillarId && pillarId !== "ALL" ? { pillarId } : {}),
        ...(assigneeId && assigneeId !== "ALL" ? { assigneeId } : {}),
      },
      include: {
        campaign: true,
        pillar: true,
        assignee: { select: { id: true, name: true, email: true } },
        checklist: { orderBy: { sortOrder: "asc" } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    });

    const [campaigns, pillars, templateRows] = await Promise.all([
      prisma.campaign.findMany({
        where: { brandId: access.brand.id, archivedAt: null },
        orderBy: { name: "asc" },
      }),
      prisma.contentPillar.findMany({
        where: {
          strategy: { brandId: access.brand.id },
          archivedAt: null,
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.contentTemplate.findMany({
        where: { brandId: access.brand.id, archivedAt: null },
        orderBy: { name: "asc" },
      }),
    ]);

    let templates = templateRows;
    if (templates.length === 0) {
      await prisma.contentTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({
          brandId: access.brand.id,
          name: t.name,
          category: t.category,
          format: t.format,
          platform: t.platform,
          titleHint: t.titleHint,
          briefHook: "briefHook" in t ? (t.briefHook ?? null) : null,
          checklist: t.checklist,
        })),
      });
      templates = await prisma.contentTemplate.findMany({
        where: { brandId: access.brand.id, archivedAt: null },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json({ items, campaigns, pillars, templates });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

const createSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  title: z.string().min(1).max(200),
  status: z.nativeEnum(ContentStatus).optional(),
  platform: z.nativeEnum(ContentPlatform).optional(),
  format: z.nativeEnum(ContentFormat).optional(),
  priority: z.nativeEnum(ContentPriority).optional(),
  campaignId: z.string().nullable().optional(),
  pillarId: z.string().nullable().optional(),
  templateId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    let checklist = DEFAULT_CHECKLIST;
    let format = parsed.data.format ?? ContentFormat.INSTAGRAM_POST;
    let platform = parsed.data.platform ?? ContentPlatform.INSTAGRAM;
    let title = parsed.data.title;
    let briefHook: string | null = null;
    let briefGoal: string | null = null;

    if (parsed.data.templateId) {
      const tpl = await prisma.contentTemplate.findFirst({
        where: { id: parsed.data.templateId, brandId: access.brand.id },
      });
      if (tpl) {
        format = tpl.format;
        platform = tpl.platform;
        if (tpl.titleHint && title === "Untitled") title = tpl.titleHint;
        checklist = tpl.checklist.length ? tpl.checklist : checklist;
        briefHook = tpl.briefHook;
        briefGoal = tpl.briefGoal;
      }
    }

    const count = await prisma.contentItem.count({
      where: {
        brandId: access.brand.id,
        status: parsed.data.status ?? "IDEAS",
        deletedAt: null,
      },
    });

    const item = await prisma.contentItem.create({
      data: {
        brandId: access.brand.id,
        title,
        status: parsed.data.status ?? "IDEAS",
        platform,
        format,
        priority: parsed.data.priority ?? "MEDIUM",
        campaignId: parsed.data.campaignId ?? null,
        pillarId: parsed.data.pillarId ?? null,
        sortOrder: count,
        brief: {
          create: {
            hook: briefHook,
            goal: briefGoal,
          },
        },
        checklist: {
          create: checklist.map((label, i) => ({
            label,
            sortOrder: i,
          })),
        },
      },
      include: includeContent,
    });

    await recordActivity({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      userId: user.id!,
      kind: "CONTENT_CREATED",
      title: `Content created: ${item.title}`,
      href: `/w/${parsed.data.workspaceSlug}/b/${parsed.data.brandSlug}/studio`,
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }
}

const patchSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  targetAudience: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  body: z.string().optional(),
  status: z.nativeEnum(ContentStatus).optional(),
  platform: z.nativeEnum(ContentPlatform).optional(),
  format: z.nativeEnum(ContentFormat).optional(),
  priority: z.nativeEnum(ContentPriority).optional(),
  campaignId: z.string().nullable().optional(),
  pillarId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  brief: z
    .object({
      goal: z.string().optional().nullable(),
      hook: z.string().optional().nullable(),
      problem: z.string().optional().nullable(),
      solution: z.string().optional().nullable(),
      cta: z.string().optional().nullable(),
      targetAudience: z.string().optional().nullable(),
      references: z.string().optional().nullable(),
      keywords: z.array(z.string()).optional(),
      hashtags: z.array(z.string()).optional(),
      competitors: z.string().optional().nullable(),
    })
    .optional(),
  checklist: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string(),
        done: z.boolean().optional(),
      }),
    )
    .optional(),
  comment: z.string().min(1).max(4000).optional(),
  softDelete: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const existing = await prisma.contentItem.findFirst({
      where: {
        id: parsed.data.id,
        brandId: access.brand.id,
        deletedAt: null,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (parsed.data.softDelete) {
      await prisma.contentItem.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), status: "ARCHIVED" },
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    const data: Record<string, unknown> = {};
    const fields = [
      "title",
      "description",
      "objective",
      "targetAudience",
      "notes",
      "body",
      "status",
      "platform",
      "format",
      "priority",
      "campaignId",
      "pillarId",
      "assigneeId",
      "sortOrder",
    ] as const;
    for (const key of fields) {
      if (parsed.data[key] !== undefined) data[key] = parsed.data[key];
    }
    if (parsed.data.dueDate !== undefined) {
      data.dueDate = parsed.data.dueDate
        ? new Date(parsed.data.dueDate)
        : null;
    }
    if (parsed.data.scheduledAt !== undefined) {
      data.scheduledAt = parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : null;
      if (parsed.data.scheduledAt && !parsed.data.status) {
        data.status = "SCHEDULED";
      }
    }
    if (parsed.data.status === "PUBLISHED") {
      data.publishedAt = new Date();
    }

    await prisma.contentItem.update({
      where: { id: existing.id },
      data,
    });

    if (parsed.data.brief) {
      const b = parsed.data.brief;
      await prisma.contentBrief.upsert({
        where: { contentId: existing.id },
        create: {
          contentId: existing.id,
          goal: b.goal ?? null,
          hook: b.hook ?? null,
          problem: b.problem ?? null,
          solution: b.solution ?? null,
          cta: b.cta ?? null,
          targetAudience: b.targetAudience ?? null,
          references: b.references ?? null,
          keywords: b.keywords ?? [],
          hashtags: b.hashtags ?? [],
          competitors: b.competitors ?? null,
        },
        update: {
          ...(b.goal !== undefined ? { goal: b.goal } : {}),
          ...(b.hook !== undefined ? { hook: b.hook } : {}),
          ...(b.problem !== undefined ? { problem: b.problem } : {}),
          ...(b.solution !== undefined ? { solution: b.solution } : {}),
          ...(b.cta !== undefined ? { cta: b.cta } : {}),
          ...(b.targetAudience !== undefined
            ? { targetAudience: b.targetAudience }
            : {}),
          ...(b.references !== undefined ? { references: b.references } : {}),
          ...(b.keywords !== undefined ? { keywords: b.keywords } : {}),
          ...(b.hashtags !== undefined ? { hashtags: b.hashtags } : {}),
          ...(b.competitors !== undefined
            ? { competitors: b.competitors }
            : {}),
        },
      });
    }

    if (parsed.data.checklist) {
      await prisma.contentChecklistItem.deleteMany({
        where: { contentId: existing.id },
      });
      await prisma.contentChecklistItem.createMany({
        data: parsed.data.checklist.map((c, i) => ({
          contentId: existing.id,
          label: c.label,
          done: c.done ?? false,
          sortOrder: i,
        })),
      });
    }

    if (parsed.data.comment) {
      const mentions = Array.from(
        parsed.data.comment.matchAll(/@([a-zA-Z0-9._-]+)/g),
      ).map((m) => m[1]!);
      await prisma.contentComment.create({
        data: {
          contentId: existing.id,
          userId: user.id!,
          body: parsed.data.comment,
          mentions,
        },
      });
    }

    if (parsed.data.status || parsed.data.title) {
      await recordActivity({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        kind: "CONTENT_UPDATED",
        title: `Content updated: ${parsed.data.title ?? existing.title}`,
        href: `/w/${parsed.data.workspaceSlug}/b/${parsed.data.brandSlug}/studio`,
      });
    }

    const item = await prisma.contentItem.findUniqueOrThrow({
      where: { id: existing.id },
      include: includeContent,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
