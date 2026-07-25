import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import { ensureStrategyForBrain } from "@/server/services/business-brain";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const access = await requireBrandAccess(
      searchParams.get("workspaceSlug") || "",
      searchParams.get("brandSlug") || "",
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await ensureStrategyForBrain(access.brand.id);
    const pillars = await prisma.contentPillar.findMany({
      where: { strategy: { brandId: access.brand.id } },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ pillars });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

const schema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  id: z.string().optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  archive: z.boolean().optional(),
  reorder: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = schema
      .extend({ name: z.string().min(1).max(120) })
      .safeParse(await request.json());
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

    const strategy = await ensureStrategyForBrain(access.brand.id);
    const count = await prisma.contentPillar.count({
      where: { strategyId: strategy.id },
    });

    const pillar = await prisma.contentPillar.create({
      data: {
        strategyId: strategy.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        color: parsed.data.color ?? "#14b8a6",
        sortOrder: count,
      },
    });

    return NextResponse.json({ pillar });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await request.json());
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

    const strategy = await ensureStrategyForBrain(access.brand.id);

    if (parsed.data.reorder) {
      await Promise.all(
        parsed.data.reorder.map((id, i) =>
          prisma.contentPillar.updateMany({
            where: { id, strategyId: strategy.id },
            data: { sortOrder: i },
          }),
        ),
      );
      return NextResponse.json({ ok: true });
    }

    if (!parsed.data.id) {
      return NextResponse.json({ error: "id required." }, { status: 400 });
    }

    if (parsed.data.archive) {
      await prisma.contentPillar.updateMany({
        where: { id: parsed.data.id, strategyId: strategy.id },
        data: { archivedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    const pillar = await prisma.contentPillar.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
        ...(parsed.data.color !== undefined
          ? { color: parsed.data.color }
          : {}),
        ...(parsed.data.sortOrder !== undefined
          ? { sortOrder: parsed.data.sortOrder }
          : {}),
      },
    });

    return NextResponse.json({ pillar });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
