import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

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

    const [tags, savedReplies, agents] = await Promise.all([
      prisma.inboxTag.findMany({
        where: { brandId: access.brand.id },
        orderBy: { name: "asc" },
      }),
      prisma.savedReply.findMany({
        where: {
          brandId: access.brand.id,
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" as const } },
                  { body: { contains: q, mode: "insensitive" as const } },
                  { shortcut: { contains: q, mode: "insensitive" as const } },
                  { category: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ category: "asc" }, { title: "asc" }],
      }),
      prisma.workspaceMember.findMany({
        where: { workspaceId: access.workspace.id },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      tags,
      savedReplies,
      agents: agents.map((m) => m.user),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load inbox meta." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = body.intent as string;

    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "tag") {
      const parsed = z
        .object({
          name: z.string().min(1).max(40),
          color: z.string().optional(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid tag." }, { status: 400 });
      }
      const tag = await prisma.inboxTag.upsert({
        where: {
          brandId_name: {
            brandId: access.brand.id,
            name: parsed.data.name.trim(),
          },
        },
        create: {
          brandId: access.brand.id,
          name: parsed.data.name.trim(),
          color: parsed.data.color || "#14b8a6",
        },
        update: {
          color: parsed.data.color || undefined,
        },
      });
      return NextResponse.json({ ok: true, tag });
    }

    if (intent === "savedReply") {
      const parsed = z
        .object({
          title: z.string().min(1).max(80),
          body: z.string().min(1).max(5000),
          category: z.string().max(60).optional().nullable(),
          shortcut: z.string().max(40).optional().nullable(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid reply." }, { status: 400 });
      }
      const reply = await prisma.savedReply.create({
        data: {
          brandId: access.brand.id,
          title: parsed.data.title.trim(),
          body: parsed.data.body.trim(),
          category: parsed.data.category?.trim() || null,
          shortcut: parsed.data.shortcut?.trim() || null,
        },
      });
      return NextResponse.json({ ok: true, reply });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = body.intent as string;

    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "tag") {
      const parsed = z
        .object({
          id: z.string(),
          name: z.string().min(1).max(40).optional(),
          color: z.string().optional(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid tag." }, { status: 400 });
      }
      const existing = await prisma.inboxTag.findFirst({
        where: { id: parsed.data.id, brandId: access.brand.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const tag = await prisma.inboxTag.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.color ? { color: parsed.data.color } : {}),
        },
      });
      return NextResponse.json({ ok: true, tag });
    }

    if (intent === "savedReply") {
      const parsed = z
        .object({
          id: z.string(),
          title: z.string().min(1).max(80).optional(),
          body: z.string().min(1).max(5000).optional(),
          category: z.string().max(60).optional().nullable(),
          shortcut: z.string().max(40).optional().nullable(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid reply." }, { status: 400 });
      }
      const existing = await prisma.savedReply.findFirst({
        where: { id: parsed.data.id, brandId: access.brand.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      const reply = await prisma.savedReply.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.title ? { title: parsed.data.title.trim() } : {}),
          ...(parsed.data.body ? { body: parsed.data.body.trim() } : {}),
          ...(parsed.data.category !== undefined
            ? { category: parsed.data.category?.trim() || null }
            : {}),
          ...(parsed.data.shortcut !== undefined
            ? { shortcut: parsed.data.shortcut?.trim() || null }
            : {}),
        },
      });
      return NextResponse.json({ ok: true, reply });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = body.intent as string;

    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "tag") {
      const id = z.string().parse(body.id);
      const existing = await prisma.inboxTag.findFirst({
        where: { id, brandId: access.brand.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      await prisma.inboxTag.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (intent === "savedReply") {
      const id = z.string().parse(body.id);
      const existing = await prisma.savedReply.findFirst({
        where: { id, brandId: access.brand.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      await prisma.savedReply.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  }
}
