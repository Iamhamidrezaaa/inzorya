import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

const createSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  title: z.string().min(1).max(200),
  body: z.string().max(100_000).optional(),
});

const updateSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(100_000).optional(),
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

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const documents = await prisma.knowledgeDocument.findMany({
      where: {
        brandId: access.brand.id,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load documents." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid document." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const document = await prisma.knowledgeDocument.create({
      data: {
        brandId: access.brand.id,
        title: parsed.data.title.trim(),
        body: parsed.data.body ?? "",
      },
    });

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create document." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid document." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const existing = await prisma.knowledgeDocument.findFirst({
      where: { id: parsed.data.id, brandId: access.brand.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const document = await prisma.knowledgeDocument.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.title !== undefined
          ? { title: parsed.data.title.trim() }
          : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
      },
    });

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update document." }, { status: 500 });
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

    const existing = await prisma.knowledgeDocument.findFirst({
      where: { id: parsed.data.id, brandId: access.brand.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    await prisma.knowledgeDocument.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete document." }, { status: 500 });
  }
}
