import { z } from "zod";
import { prisma } from "@/lib/db";
import { answersMap } from "@/server/services/business-brain";
import type { ToolDefinition } from "@/server/agent/types";
import { resolveScopedBrandId } from "@/server/agent/tools/scope";

const inputSchema = z.object({
  brandId: z.string().min(1).optional(),
});

const outputSchema = z.object({
  brand: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
      website: z.string().nullable(),
      industry: z.string().nullable(),
      brandVoice: z.string().nullable(),
      targetAudience: z.string().nullable(),
    })
    .nullable(),
  business: z
    .object({
      businessSummary: z.string().nullable(),
      industry: z.string().nullable(),
      website: z.string().nullable(),
      country: z.string().nullable(),
      languages: z.array(z.string()),
      mainProducts: z.string().nullable(),
      businessGoals: z.string().nullable(),
      preferredPlatforms: z.array(z.string()),
      preferredTone: z.string().nullable(),
      mainCta: z.string().nullable(),
    })
    .nullable(),
  audience: z
    .object({
      targetAudience: z.string().nullable(),
      fromBrand: z.string().nullable(),
      fromProfile: z.string().nullable(),
    })
    .nullable(),
  voice: z
    .object({
      toneOfVoice: z.string().nullable(),
      traits: z.array(z.string()),
      writingStyle: z.string().nullable(),
      emojiUsage: z.string().nullable(),
      ctaStyle: z.string().nullable(),
      preferredWords: z.array(z.string()),
      forbiddenWords: z.array(z.string()),
    })
    .nullable(),
  objectives: z.array(z.string()),
  brain: z
    .object({
      score: z.number(),
      completionPercent: z.number(),
      version: z.number(),
      answers: z.record(z.string(), z.string()),
    })
    .nullable(),
});

export type BrandGetContextOutput = z.infer<typeof outputSchema>;

export const brandGetContextTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  BrandGetContextOutput
> = {
  id: "brand.getContext",
  name: "Brand Context",
  description:
    "Read structured brand/business context from existing Brand, Business Profile, and Business Brain data.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);

    const [brand, profile, brain] = await Promise.all([
      prisma.brand.findFirst({
        where: { id: brandId, workspaceId: ctx.workspaceId, archivedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          website: true,
          industry: true,
          brandVoice: true,
          targetAudience: true,
        },
      }),
      prisma.businessProfile.findUnique({
        where: { brandId },
        select: {
          businessSummary: true,
          industry: true,
          website: true,
          country: true,
          languages: true,
          mainProducts: true,
          businessGoals: true,
          targetAudience: true,
          preferredPlatforms: true,
          preferredTone: true,
          mainCta: true,
        },
      }),
      prisma.businessBrain.findFirst({
        where: { brandId, deletedAt: null },
        select: {
          score: true,
          completionPercent: true,
          version: true,
          answers: {
            where: { deletedAt: null },
            include: { question: { select: { key: true } } },
          },
          voice: {
            select: {
              toneOfVoice: true,
              traits: true,
              writingStyle: true,
              emojiUsage: true,
              ctaStyle: true,
              preferredWords: true,
              forbiddenWords: true,
              deletedAt: true,
            },
          },
        },
      }),
    ]);

    if (!brand) {
      return {
        brand: null,
        business: null,
        audience: null,
        voice: null,
        objectives: [],
        brain: null,
      };
    }

    const voiceRow =
      brain?.voice && !brain.voice.deletedAt ? brain.voice : null;

    const objectives: string[] = [];
    if (profile?.businessGoals?.trim()) {
      objectives.push(profile.businessGoals.trim());
    }

    const answers = brain
      ? answersMap(
          brain.answers.map((a) => ({
            question: { key: a.question.key },
            value: a.value,
          })),
        )
      : {};

    return {
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        website: brand.website,
        industry: brand.industry,
        brandVoice: brand.brandVoice,
        targetAudience: brand.targetAudience,
      },
      business: profile
        ? {
            businessSummary: profile.businessSummary,
            industry: profile.industry,
            website: profile.website,
            country: profile.country,
            languages: profile.languages,
            mainProducts: profile.mainProducts,
            businessGoals: profile.businessGoals,
            preferredPlatforms: profile.preferredPlatforms,
            preferredTone: profile.preferredTone,
            mainCta: profile.mainCta,
          }
        : null,
      audience: {
        targetAudience:
          profile?.targetAudience ?? brand.targetAudience ?? null,
        fromBrand: brand.targetAudience,
        fromProfile: profile?.targetAudience ?? null,
      },
      voice: voiceRow
        ? {
            toneOfVoice: voiceRow.toneOfVoice,
            traits: voiceRow.traits,
            writingStyle: voiceRow.writingStyle,
            emojiUsage: voiceRow.emojiUsage,
            ctaStyle: voiceRow.ctaStyle,
            preferredWords: voiceRow.preferredWords,
            forbiddenWords: voiceRow.forbiddenWords,
          }
        : brand.brandVoice
          ? {
              toneOfVoice: brand.brandVoice,
              traits: [],
              writingStyle: null,
              emojiUsage: null,
              ctaStyle: null,
              preferredWords: [],
              forbiddenWords: [],
            }
          : null,
      objectives,
      brain: brain
        ? {
            score: brain.score,
            completionPercent: brain.completionPercent,
            version: brain.version,
            answers,
          }
        : null,
    };
  },
};
