import { NextResponse } from "next/server";
import { AutomationStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  AUTOMATION_TEMPLATES,
  type FlowSnapshot,
  validateFlow,
} from "@/lib/automation-catalog";
import {
  automationInclude,
  createAutomationFromSnapshot,
  ensureDemoAutomations,
  ensureAutomationTemplates,
  replaceGraph,
  toSnapshot,
} from "@/server/services/automation";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const snapshotSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      kind: z.string(),
      label: z.string(),
      description: z.string().nullable().optional(),
      config: z.record(z.string(), z.unknown()).default({}),
      position: z.object({ x: z.number(), y: z.number() }),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().nullable().optional(),
      targetHandle: z.string().nullable().optional(),
      label: z.string().nullable().optional(),
    }),
  ),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const id = searchParams.get("id");
    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const tag = searchParams.get("tag") || "";
    const author = searchParams.get("author") || "";
    const templatesOnly = searchParams.get("templates") === "1";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await ensureDemoAutomations(prisma, {
      brandId: access.brand.id,
      userId: user.id!,
    });

    if (templatesOnly) {
      await ensureAutomationTemplates(prisma);
      const templates = await prisma.automationTemplate.findMany({
        orderBy: { name: "asc" },
      });
      return NextResponse.json({
        templates:
          templates.length > 0
            ? templates
            : AUTOMATION_TEMPLATES.map((t) => ({
                id: t.slug,
                slug: t.slug,
                name: t.name,
                description: t.description,
                category: t.category,
                tags: t.tags,
                snapshot: t.snapshot,
              })),
      });
    }

    if (id) {
      const automation = await prisma.automation.findFirst({
        where: { id, brandId: access.brand.id },
        include: automationInclude(),
      });
      if (!automation) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const snapshot = toSnapshot(automation);
      return NextResponse.json({
        automation,
        snapshot,
        validation: validateFlow(snapshot),
      });
    }

    const automations = await prisma.automation.findMany({
      where: {
        brandId: access.brand.id,
        archivedAt: status === "ARCHIVED" ? { not: null } : null,
        ...(status && status !== "ALL" && status !== "ARCHIVED"
          ? { status: status as AutomationStatus }
          : {}),
        ...(category ? { category } : {}),
        ...(author ? { createdById: author } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
                {
                  nodes: {
                    some: {
                      OR: [
                        { label: { contains: q, mode: "insensitive" } },
                        { kind: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { nodes: true, edges: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ automations });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load automations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = (body.intent as string) || "create";

    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "create") {
      const parsed = z
        .object({
          name: z.string().min(1).max(120),
          description: z.string().max(2000).optional().nullable(),
          category: z.string().max(80).optional().nullable(),
          status: z.nativeEnum(AutomationStatus).optional(),
          tags: z.array(z.string()).optional(),
          templateSlug: z.string().optional(),
          snapshot: snapshotSchema.optional(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid automation." }, { status: 400 });
      }

      let snapshot: FlowSnapshot = parsed.data.snapshot || {
        nodes: [
          {
            id: "t1",
            type: "TRIGGER",
            kind: "MANUAL",
            label: "Manual Trigger",
            config: {},
            position: { x: 120, y: 160 },
          },
          {
            id: "e1",
            type: "END",
            kind: "END",
            label: "End",
            config: {},
            position: { x: 420, y: 160 },
          },
        ],
        edges: [{ id: "edge-1", source: "t1", target: "e1" }],
      };

      if (parsed.data.templateSlug) {
        await ensureAutomationTemplates(prisma);
        const tpl = await prisma.automationTemplate.findUnique({
          where: { slug: parsed.data.templateSlug },
        });
        if (tpl) snapshot = tpl.snapshot as FlowSnapshot;
        else {
          const local = AUTOMATION_TEMPLATES.find(
            (t) => t.slug === parsed.data.templateSlug,
          );
          if (local) snapshot = local.snapshot;
        }
      }

      const automation = await createAutomationFromSnapshot(prisma, {
        brandId: access.brand.id,
        userId: user.id!,
        name: parsed.data.name.trim(),
        description: parsed.data.description,
        category: parsed.data.category,
        tags: parsed.data.tags || [],
        status: parsed.data.status || "DRAFT",
        snapshot,
      });

      return NextResponse.json({ ok: true, automation });
    }

    if (intent === "duplicate") {
      const id = z.string().parse(body.id);
      const existing = await prisma.automation.findFirst({
        where: { id, brandId: access.brand.id },
        include: { nodes: true, edges: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const automation = await createAutomationFromSnapshot(prisma, {
        brandId: access.brand.id,
        userId: user.id!,
        name: `${existing.name} (copy)`,
        description: existing.description,
        category: existing.category,
        tags: existing.tags,
        status: "DRAFT",
        snapshot: toSnapshot(existing),
      });
      return NextResponse.json({ ok: true, automation });
    }

    if (intent === "import") {
      const parsed = z
        .object({
          name: z.string().min(1).max(120).optional(),
          snapshot: snapshotSchema,
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
      }
      const automation = await createAutomationFromSnapshot(prisma, {
        brandId: access.brand.id,
        userId: user.id!,
        name: parsed.data.name || "Imported automation",
        snapshot: parsed.data.snapshot,
      });
      return NextResponse.json({ ok: true, automation });
    }

    if (intent === "version") {
      const id = z.string().parse(body.id);
      const note = typeof body.note === "string" ? body.note : "Manual snapshot";
      const existing = await prisma.automation.findFirst({
        where: { id, brandId: access.brand.id },
        include: { nodes: true, edges: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const nextVersion = existing.version + 1;
      await prisma.automationVersion.create({
        data: {
          automationId: existing.id,
          version: nextVersion,
          snapshot: asJson(toSnapshot(existing)),
          note,
          createdById: user.id!,
        },
      });
      const automation = await prisma.automation.update({
        where: { id: existing.id },
        data: { version: nextVersion },
        include: automationInclude(),
      });
      return NextResponse.json({ ok: true, automation });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to create." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = z
      .object({
        workspaceSlug: z.string(),
        brandSlug: z.string(),
        id: z.string(),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(2000).nullable().optional(),
        category: z.string().max(80).nullable().optional(),
        status: z.nativeEnum(AutomationStatus).optional(),
        tags: z.array(z.string()).optional(),
        snapshot: snapshotSchema.optional(),
        archive: z.boolean().optional(),
        bumpVersion: z.boolean().optional(),
      })
      .safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const existing = await prisma.automation.findFirst({
      where: { id: parsed.data.id, brandId: access.brand.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (parsed.data.snapshot) {
      await replaceGraph(prisma, existing.id, parsed.data.snapshot);
    }

    let version = existing.version;
    if (parsed.data.bumpVersion) {
      version += 1;
      const current = await prisma.automation.findFirst({
        where: { id: existing.id },
        include: { nodes: true, edges: true },
      });
      if (current) {
        await prisma.automationVersion.create({
          data: {
            automationId: existing.id,
            version,
            snapshot: asJson(toSnapshot(current)),
            note: "Auto-save checkpoint",
            createdById: user.id!,
          },
        });
      }
    }

    const automation = await prisma.automation.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
        ...(parsed.data.category !== undefined
          ? { category: parsed.data.category }
          : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.tags ? { tags: parsed.data.tags } : {}),
        ...(parsed.data.archive
          ? { archivedAt: new Date(), status: AutomationStatus.ARCHIVED }
          : {}),
        ...(parsed.data.bumpVersion ? { version } : {}),
        ...(parsed.data.snapshot
          ? { nodeCount: parsed.data.snapshot.nodes.length }
          : {}),
      },
      include: automationInclude(),
    });

    const snapshot = toSnapshot(automation);
    return NextResponse.json({
      ok: true,
      automation,
      snapshot,
      validation: validateFlow(snapshot),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const id = z.string().parse(body.id);
    const existing = await prisma.automation.findFirst({
      where: { id, brandId: access.brand.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await prisma.automation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  }
}
