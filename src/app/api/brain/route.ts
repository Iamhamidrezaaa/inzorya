import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  answersMap,
  completionFromBrain,
  ensureBusinessBrain,
  ensureStrategyForBrain,
  refreshBrainScore,
  snapshotBrain,
} from "@/server/services/business-brain";
import { BRAIN_QUESTIONS } from "@/lib/business-brain";
import { recordActivity } from "@/server/services/workspace-experience";

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

    const brain = await ensureBusinessBrain(access.brand.id);
    const strategy = await ensureStrategyForBrain(access.brand.id);

    const completion = completionFromBrain({
      answers: brain.answers,
      voice: brain.voice,
      assetsCount: brain.assets.length,
      competitorsCount: strategy.competitors.length,
      pillarsCount: strategy.pillars.length,
    });

    if (
      brain.score !== completion.score ||
      brain.completionPercent !== completion.completionPercent
    ) {
      await prisma.businessBrain.update({
        where: { id: brain.id },
        data: {
          score: completion.score,
          completionPercent: completion.completionPercent,
        },
      });
    }

    return NextResponse.json({
      brain: {
        ...brain,
        score: completion.score,
        completionPercent: completion.completionPercent,
      },
      brand: {
        id: access.brand.id,
        name: access.brand.name,
        slug: access.brand.slug,
        logoUrl: access.brand.logoUrl,
      },
      questions: BRAIN_QUESTIONS,
      answersByKey: answersMap(brain.answers),
      voice: brain.voice,
      assets: brain.assets,
      competitors: strategy.competitors,
      pillars: strategy.pillars,
      completion,
      versions: brain.versions,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load brain." }, { status: 500 });
  }
}

const patchSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  questionKey: z.string().optional(),
  value: z.string().optional().nullable(),
  valueJson: z.unknown().optional(),
  currentQuestionKey: z.string().optional().nullable(),
  voice: z
    .object({
      traits: z.array(z.string()).optional(),
      toneOfVoice: z.string().optional().nullable(),
      emojiUsage: z.string().optional().nullable(),
      writingStyle: z.string().optional().nullable(),
      ctaStyle: z.string().optional().nullable(),
      forbiddenWords: z.array(z.string()).optional(),
      preferredWords: z.array(z.string()).optional(),
    })
    .optional(),
  competitors: z
    .array(
      z.object({
        name: z.string().min(1),
        website: z.string().optional().nullable(),
        instagram: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        strengths: z.string().optional().nullable(),
        weaknesses: z.string().optional().nullable(),
      }),
    )
    .optional(),
  pillars: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional().nullable(),
      }),
    )
    .optional(),
  snapshot: z.boolean().optional(),
  softDelete: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const brain = await ensureBusinessBrain(access.brand.id);
    const strategy = await ensureStrategyForBrain(access.brand.id);

    if (parsed.data.softDelete) {
      await prisma.businessBrain.update({
        where: { id: brain.id },
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    if (parsed.data.questionKey) {
      const question = await prisma.businessQuestion.findUnique({
        where: { key: parsed.data.questionKey },
      });
      if (!question) {
        return NextResponse.json({ error: "Unknown question." }, { status: 400 });
      }

      const value = parsed.data.value ?? "";
      await prisma.businessAnswer.upsert({
        where: {
          brainId_questionId: {
            brainId: brain.id,
            questionId: question.id,
          },
        },
        create: {
          brainId: brain.id,
          questionId: question.id,
          value,
          valueJson: parsed.data.valueJson as object | undefined,
          deletedAt: null,
        },
        update: {
          value,
          valueJson: parsed.data.valueJson as object | undefined,
          deletedAt: null,
        },
      });

      // Sync a few core fields into Brand / BusinessProfile for existing surfaces
      if (parsed.data.questionKey === "brand.name" && value.trim()) {
        await prisma.brand.update({
          where: { id: access.brand.id },
          data: { name: value.trim() },
        });
      }
      if (parsed.data.questionKey === "brand.website") {
        await prisma.brand.update({
          where: { id: access.brand.id },
          data: { website: value.trim() || null },
        });
      }
      if (parsed.data.questionKey === "brand.industry") {
        await prisma.brand.update({
          where: { id: access.brand.id },
          data: { industry: value.trim() || null },
        });
      }
      if (parsed.data.questionKey === "brand.description") {
        await prisma.businessProfile.upsert({
          where: { brandId: access.brand.id },
          create: {
            brandId: access.brand.id,
            businessSummary: value.trim() || null,
          },
          update: { businessSummary: value.trim() || null },
        });
      }
    }

    if (parsed.data.currentQuestionKey !== undefined) {
      await prisma.businessBrain.update({
        where: { id: brain.id },
        data: {
          currentQuestionKey: parsed.data.currentQuestionKey,
          interviewStartedAt: brain.interviewStartedAt ?? new Date(),
        },
      });
    }

    if (parsed.data.voice) {
      const v = parsed.data.voice;
      await prisma.brandVoice.upsert({
        where: { brainId: brain.id },
        create: {
          brainId: brain.id,
          traits: v.traits ?? [],
          toneOfVoice: v.toneOfVoice ?? null,
          emojiUsage: v.emojiUsage ?? null,
          writingStyle: v.writingStyle ?? null,
          ctaStyle: v.ctaStyle ?? null,
          forbiddenWords: v.forbiddenWords ?? [],
          preferredWords: v.preferredWords ?? [],
        },
        update: {
          ...(v.traits !== undefined ? { traits: v.traits } : {}),
          ...(v.toneOfVoice !== undefined
            ? { toneOfVoice: v.toneOfVoice }
            : {}),
          ...(v.emojiUsage !== undefined ? { emojiUsage: v.emojiUsage } : {}),
          ...(v.writingStyle !== undefined
            ? { writingStyle: v.writingStyle }
            : {}),
          ...(v.ctaStyle !== undefined ? { ctaStyle: v.ctaStyle } : {}),
          ...(v.forbiddenWords !== undefined
            ? { forbiddenWords: v.forbiddenWords }
            : {}),
          ...(v.preferredWords !== undefined
            ? { preferredWords: v.preferredWords }
            : {}),
          deletedAt: null,
        },
      });

      if (v.toneOfVoice) {
        await prisma.brand.update({
          where: { id: access.brand.id },
          data: { brandVoice: v.toneOfVoice },
        });
      }
    }

    if (parsed.data.competitors) {
      await prisma.competitor.deleteMany({
        where: { strategyId: strategy.id },
      });
      if (parsed.data.competitors.length > 0) {
        await prisma.competitor.createMany({
          data: parsed.data.competitors.map((c, i) => ({
            strategyId: strategy.id,
            name: c.name.trim(),
            website: c.website ?? null,
            instagram: c.instagram ?? null,
            notes: [c.strengths, c.weaknesses, c.notes]
              .filter(Boolean)
              .join("\n\n") || null,
            sortOrder: i,
          })),
        });
      }
    }

    if (parsed.data.pillars) {
      await prisma.contentPillar.deleteMany({
        where: { strategyId: strategy.id },
      });
      if (parsed.data.pillars.length > 0) {
        await prisma.contentPillar.createMany({
          data: parsed.data.pillars.map((p, i) => ({
            strategyId: strategy.id,
            name: p.name.trim(),
            description: p.description ?? null,
            sortOrder: i,
          })),
        });
      }
    }

    if (parsed.data.snapshot) {
      await snapshotBrain(brain.id, "Manual checkpoint");
    }

    await refreshBrainScore(brain.id);

    await recordActivity({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      userId: user.id!,
      kind: "BUSINESS_UPDATED",
      title: "Business Brain updated",
      href: `/w/${parsed.data.workspaceSlug}/b/${parsed.data.brandSlug}/brain`,
    });

    const fresh = await ensureBusinessBrain(access.brand.id);
    const freshStrategy = await ensureStrategyForBrain(access.brand.id);
    const completion = completionFromBrain({
      answers: fresh.answers,
      voice: fresh.voice,
      assetsCount: fresh.assets.length,
      competitorsCount: freshStrategy.competitors.length,
      pillarsCount: freshStrategy.pillars.length,
    });

    return NextResponse.json({
      ok: true,
      answersByKey: answersMap(fresh.answers),
      voice: fresh.voice,
      assets: fresh.assets,
      competitors: freshStrategy.competitors,
      pillars: freshStrategy.pillars,
      completion,
      brain: {
        id: fresh.id,
        currentQuestionKey: fresh.currentQuestionKey,
        score: completion.score,
        completionPercent: completion.completionPercent,
        version: fresh.version,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to save brain." }, { status: 500 });
  }
}
