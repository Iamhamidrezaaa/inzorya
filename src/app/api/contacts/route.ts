import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

const contactSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  name: z.string().max(120).optional().nullable(),
  instagramUsername: z.string().max(120).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(10_000).optional().nullable(),
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

    const contacts = await prisma.contact.findMany({
      where: {
        brandId: access.brand.id,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { instagramUsername: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { conversations: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load contacts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid contact." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const contact = await prisma.contact.create({
      data: {
        brandId: access.brand.id,
        name: parsed.data.name?.trim() || null,
        instagramUsername: parsed.data.instagramUsername?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        tags: parsed.data.tags ?? [],
        notes: parsed.data.notes?.trim() || null,
      },
      include: { _count: { select: { conversations: true } } },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create contact." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = contactSchema.extend({ id: z.string() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid contact." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const existing = await prisma.contact.findFirst({
      where: { id: parsed.data.id, brandId: access.brand.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    const contact = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name?.trim() || null,
        instagramUsername: parsed.data.instagramUsername?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim() || null,
        tags: parsed.data.tags ?? existing.tags,
        notes: parsed.data.notes?.trim() || null,
      },
      include: { _count: { select: { conversations: true } } },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update contact." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body = z
      .object({
        workspaceSlug: z.string(),
        brandSlug: z.string(),
        id: z.string(),
      })
      .safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      body.data.workspaceSlug,
      body.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await prisma.contact.deleteMany({
      where: { id: body.data.id, brandId: access.brand.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete contact." }, { status: 500 });
  }
}
