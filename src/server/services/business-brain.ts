import { prisma } from "@/lib/db";
import {
  BRAIN_QUESTIONS,
  computeBrainCompletion,
  type BrainCompletion,
} from "@/lib/business-brain";
import { DEFAULT_CONTENT_PILLARS } from "@/lib/strategy";

export async function ensureBusinessQuestions() {
  for (const [index, q] of BRAIN_QUESTIONS.entries()) {
    await prisma.businessQuestion.upsert({
      where: { key: q.key },
      create: {
        key: q.key,
        groupKey: q.groupKey,
        sortOrder: index,
        prompt: q.prompt,
        helpText: q.helpText,
        inputType: q.inputType,
        options: q.options ?? [],
        estimatedSeconds: q.estimatedSeconds,
        required: q.required ?? false,
      },
      update: {
        groupKey: q.groupKey,
        sortOrder: index,
        prompt: q.prompt,
        helpText: q.helpText,
        inputType: q.inputType,
        options: q.options ?? [],
        estimatedSeconds: q.estimatedSeconds,
        required: q.required ?? false,
      },
    });
  }
}

export async function ensureBusinessBrain(brandId: string) {
  await ensureBusinessQuestions();

  let brain = await prisma.businessBrain.findUnique({
    where: { brandId },
    include: {
      answers: {
        where: { deletedAt: null },
        include: { question: true },
      },
      voice: true,
      assets: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      versions: { orderBy: { version: "desc" }, take: 10 },
    },
  });

  if (brain?.deletedAt) {
    brain = await prisma.businessBrain.update({
      where: { id: brain.id },
      data: { deletedAt: null },
      include: {
        answers: {
          where: { deletedAt: null },
          include: { question: true },
        },
        voice: true,
        assets: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        versions: { orderBy: { version: "desc" }, take: 10 },
      },
    });
  }

  if (!brain) {
    brain = await prisma.businessBrain.create({
      data: {
        brandId,
        interviewStartedAt: new Date(),
        currentQuestionKey: BRAIN_QUESTIONS[0]?.key,
        voice: { create: {} },
      },
      include: {
        answers: {
          where: { deletedAt: null },
          include: { question: true },
        },
        voice: true,
        assets: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        versions: { orderBy: { version: "desc" }, take: 10 },
      },
    });
  }

  return brain;
}

export async function ensureStrategyForBrain(brandId: string) {
  const existing = await prisma.marketingStrategy.findUnique({
    where: { brandId },
    include: {
      competitors: { orderBy: { sortOrder: "asc" } },
      pillars: { orderBy: { sortOrder: "asc" } },
      personas: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (existing) return existing;

  return prisma.marketingStrategy.create({
    data: {
      brandId,
      pillars: {
        create: DEFAULT_CONTENT_PILLARS.map((p, i) => ({
          name: p.name,
          description: p.description,
          sortOrder: i,
        })),
      },
    },
    include: {
      competitors: { orderBy: { sortOrder: "asc" } },
      pillars: { orderBy: { sortOrder: "asc" } },
      personas: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export function answersMap(
  answers: { question: { key: string }; value: string }[],
) {
  const map: Record<string, string> = {};
  for (const a of answers) map[a.question.key] = a.value;
  return map;
}

export function completionFromBrain(input: {
  answers: { question: { key: string }; value: string }[];
  voice: { traits: string[] } | null;
  assetsCount: number;
  competitorsCount: number;
  pillarsCount: number;
}): BrainCompletion {
  return computeBrainCompletion({
    answersByKey: answersMap(input.answers),
    traitsCount: input.voice?.traits.length ?? 0,
    competitorsCount: input.competitorsCount,
    pillarsCount: input.pillarsCount,
    assetsCount: input.assetsCount,
  });
}

export async function refreshBrainScore(brainId: string) {
  const brain = await prisma.businessBrain.findUniqueOrThrow({
    where: { id: brainId },
    include: {
      answers: { where: { deletedAt: null }, include: { question: true } },
      voice: true,
      assets: { where: { deletedAt: null } },
      brand: {
        include: {
          marketingStrategy: {
            include: {
              competitors: true,
              pillars: true,
            },
          },
        },
      },
    },
  });

  const completion = completionFromBrain({
    answers: brain.answers,
    voice: brain.voice,
    assetsCount: brain.assets.length,
    competitorsCount: brain.brand.marketingStrategy?.competitors.length ?? 0,
    pillarsCount: brain.brand.marketingStrategy?.pillars.length ?? 0,
  });

  return prisma.businessBrain.update({
    where: { id: brainId },
    data: {
      score: completion.score,
      completionPercent: completion.completionPercent,
      interviewCompletedAt:
        completion.completionPercent >= 100
          ? brain.interviewCompletedAt ?? new Date()
          : brain.interviewCompletedAt,
    },
  });
}

export async function snapshotBrain(brainId: string, note?: string) {
  const brain = await prisma.businessBrain.findUniqueOrThrow({
    where: { id: brainId },
    include: {
      answers: { where: { deletedAt: null }, include: { question: true } },
      voice: true,
      assets: { where: { deletedAt: null } },
    },
  });

  const nextVersion = brain.version + 1;
  await prisma.businessBrainVersion.create({
    data: {
      brainId,
      version: brain.version,
      note: note ?? `Autosave v${brain.version}`,
      snapshot: {
        answers: brain.answers.map((a) => ({
          key: a.question.key,
          value: a.value,
          valueJson: a.valueJson,
        })),
        voice: brain.voice,
        assets: brain.assets.map((a) => ({
          id: a.id,
          kind: a.kind,
          url: a.url,
          label: a.label,
        })),
        score: brain.score,
        completionPercent: brain.completionPercent,
      },
    },
  });

  return prisma.businessBrain.update({
    where: { id: brainId },
    data: { version: nextVersion },
  });
}
