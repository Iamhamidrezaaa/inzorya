import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const assets = await prisma.mediaAsset.findMany({
      where: { brandId: access.brand.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load media." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const workspaceSlug = String(form.get("workspaceSlug") || "");
    const brandSlug = String(form.get("brandSlug") || "");
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images are allowed for now." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Max file size is 10MB." }, { status: 400 });
    }

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const ext = path.extname(file.name) || ".png";
    const filename = `${randomBytes(12).toString("hex")}${ext}`;
    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "media",
      access.brand.id,
    );
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

    const url = `/uploads/media/${access.brand.id}/${filename}`;
    const asset = await prisma.mediaAsset.create({
      data: {
        brandId: access.brand.id,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url,
      },
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

const deleteSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  id: z.string(),
});

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

    const asset = await prisma.mediaAsset.findFirst({
      where: { id: parsed.data.id, brandId: access.brand.id },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    const filePath = path.join(process.cwd(), "public", asset.url);
    try {
      await unlink(filePath);
    } catch {
      // File may already be missing; still remove DB row.
    }

    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
