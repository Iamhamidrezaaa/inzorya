import { NextResponse } from "next/server";
import { z } from "zod";
import { ContentFormat, ContentPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import { DEFAULT_TEMPLATES } from "@/lib/content-studio";

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

    let templates = await prisma.contentTemplate.findMany({
      where: { brandId: access.brand.id, archivedAt: null },
      orderBy: { name: "asc" },
    });

    if (templates.length === 0) {
      await prisma.contentTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({
          brandId: access.brand.id,
          name: t.name,
          category: t.category,
          format: t.format,
          platform: t.platform,
          titleHint: t.titleHint,
          briefHook: "briefHook" in t ? t.briefHook : null,
          briefGoal: null,
          checklist: t.checklist,
        })),
      });
      templates = await prisma.contentTemplate.findMany({
        where: { brandId: access.brand.id, archivedAt: null },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json({ templates });
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
  name: z.string().min(1).max(120),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  format: z.nativeEnum(ContentFormat).optional(),
  platform: z.nativeEnum(ContentPlatform).optional(),
  titleHint: z.string().optional().nullable(),
  briefGoal: z.string().optional().nullable(),
  briefHook: z.string().optional().nullable(),
  checklist: z.array(z.string()).optional(),
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

    const template = await prisma.contentTemplate.create({
      data: {
        brandId: access.brand.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        category: parsed.data.category ?? null,
        format: parsed.data.format ?? "INSTAGRAM_POST",
        platform: parsed.data.platform ?? "INSTAGRAM",
        titleHint: parsed.data.titleHint ?? null,
        briefGoal: parsed.data.briefGoal ?? null,
        briefHook: parsed.data.briefHook ?? null,
        checklist: parsed.data.checklist ?? [],
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }
}
