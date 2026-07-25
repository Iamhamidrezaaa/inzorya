import { NextResponse } from "next/server";
import { z } from "zod";
import { ContentPlatform, ContentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

const createSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  title: z.string().min(1).max(200),
  body: z.string().max(50_000).optional(),
  status: z.nativeEnum(ContentStatus).optional(),
  platform: z.nativeEnum(ContentPlatform).optional(),
});

const updateSchema = createSchema.extend({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
});

const deleteSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  id: z.string(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status");
    const platform = searchParams.get("platform");

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const items = await prisma.contentItem.findMany({
      where: {
        brandId: access.brand.id,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(status && status !== "ALL"
          ? { status: status as ContentStatus }
          : {}),
        ...(platform && platform !== "ALL"
          ? { platform: platform as ContentPlatform }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load content." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid content." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const item = await prisma.contentItem.create({
      data: {
        brandId: access.brand.id,
        title: parsed.data.title.trim(),
        body: parsed.data.body ?? "",
        status: parsed.data.status ?? ContentStatus.DRAFT,
        platform: parsed.data.platform ?? ContentPlatform.OTHER,
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create content." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid content." }, { status: 400 });
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
      where: { id: parsed.data.id, brandId: access.brand.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Content not found." }, { status: 404 });
    }

    const item = await prisma.contentItem.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.title !== undefined
          ? { title: parsed.data.title.trim() }
          : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.platform !== undefined
          ? { platform: parsed.data.platform }
          : {}),
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update content." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
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
      where: { id: parsed.data.id, brandId: access.brand.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Content not found." }, { status: 404 });
    }

    await prisma.contentItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete content." }, { status: 500 });
  }
}
