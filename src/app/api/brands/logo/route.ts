import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

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
      return NextResponse.json({ error: "Only images are allowed." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Max file size is 5MB." }, { status: 400 });
    }

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const ext = path.extname(file.name) || ".png";
    const filename = `${access.brand.id}-${randomBytes(8).toString("hex")}${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "logos");
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    const logoUrl = `/uploads/logos/${filename}`;
    const brand = await prisma.brand.update({
      where: { id: access.brand.id },
      data: { logoUrl },
    });

    return NextResponse.json({ ok: true, logoUrl: brand.logoUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
