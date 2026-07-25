import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/access";

const profileSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(128),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = body.intent as string;

    if (intent === "profile") {
      const parsed = profileSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
      }

      const email = parsed.data.email.toLowerCase();
      const clash = await prisma.user.findFirst({
        where: { email, NOT: { id: user.id } },
      });
      if (clash) {
        return NextResponse.json(
          { error: "Email is already in use." },
          { status: 409 },
        );
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: parsed.data.name.trim(),
          email,
        },
        select: { id: true, name: true, email: true },
      });

      return NextResponse.json({ ok: true, user: updated });
    }

    if (intent === "password") {
      const parsed = passwordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid password." }, { status: 400 });
      }

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser?.passwordHash) {
        return NextResponse.json({ error: "Password not set." }, { status: 400 });
      }

      const valid = await bcrypt.compare(
        parsed.data.currentPassword,
        dbUser.passwordHash,
      );
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 },
        );
      }

      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
