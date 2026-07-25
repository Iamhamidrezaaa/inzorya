import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  ensureBusinessBrain,
  refreshBrainScore,
} from "@/server/services/business-brain";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const workspaceSlug = String(form.get("workspaceSlug") || "");
    const brandSlug = String(form.get("brandSlug") || "");
    const kind = String(form.get("kind") || "logo");
    const label = String(form.get("label") || "") || null;
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Max 10MB." }, { status: 400 });
    }

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const brain = await ensureBusinessBrain(access.brand.id);
    const ext = path.extname(file.name) || ".bin";
    const filename = `${randomBytes(12).toString("hex")}${ext}`;
    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "brain",
      access.brand.id,
    );
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
    const url = `/uploads/brain/${access.brand.id}/${filename}`;

    const asset = await prisma.brandAsset.create({
      data: {
        brainId: brain.id,
        kind,
        label,
        url,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
      },
    });

    if (kind === "logo") {
      await prisma.brand.update({
        where: { id: access.brand.id },
        data: { logoUrl: url },
      });
    }

    await refreshBrainScore(brain.id);

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      workspaceSlug?: string;
      brandSlug?: string;
      id?: string;
    };
    const access = await requireBrandAccess(
      body.workspaceSlug || "",
      body.brandSlug || "",
      user.id!,
    );
    if (!access || !body.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const brain = await ensureBusinessBrain(access.brand.id);
    await prisma.brandAsset.updateMany({
      where: { id: body.id, brainId: brain.id },
      data: { deletedAt: new Date() },
    });
    await refreshBrainScore(brain.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
