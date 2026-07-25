import { NextResponse } from "next/server";
import { z } from "zod";
import { CampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

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

    const campaigns = await prisma.campaign.findMany({
      where: { brandId: access.brand.id, archivedAt: null },
      include: { _count: { select: { contents: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ campaigns });
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
  name: z.string().min(1).max(120),
  description: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  platforms: z.array(z.string()).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  status: z.nativeEnum(CampaignStatus).optional(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  archive: z.boolean().optional(),
});

export async function POST(request: Request) {
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

    const campaign = await prisma.campaign.create({
      data: {
        brandId: access.brand.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        objective: parsed.data.objective ?? null,
        platforms: parsed.data.platforms ?? [],
        startDate: parsed.data.startDate
          ? new Date(parsed.data.startDate)
          : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        budget: parsed.data.budget ?? null,
        status: parsed.data.status ?? "PLANNING",
        color: parsed.data.color ?? "#14b8a6",
        icon: parsed.data.icon ?? null,
      },
    });

    return NextResponse.json({ campaign });
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
    const parsed = schema.extend({ id: z.string() }).safeParse(await request.json());
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

    if (parsed.data.archive) {
      await prisma.campaign.updateMany({
        where: { id: parsed.data.id, brandId: access.brand.id },
        data: { archivedAt: new Date(), status: "ARCHIVED" },
      });
      return NextResponse.json({ ok: true });
    }

    const campaign = await prisma.campaign.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        objective: parsed.data.objective ?? null,
        platforms: parsed.data.platforms ?? [],
        startDate: parsed.data.startDate
          ? new Date(parsed.data.startDate)
          : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        budget: parsed.data.budget ?? null,
        status: parsed.data.status,
        color: parsed.data.color ?? undefined,
        icon: parsed.data.icon ?? null,
      },
    });

    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
