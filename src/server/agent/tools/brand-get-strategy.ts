import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ToolDefinition } from "@/server/agent/types";
import { resolveScopedBrandId } from "@/server/agent/tools/scope";

const inputSchema = z.object({
  brandId: z.string().min(1).optional(),
});

const outputSchema = z.object({
  exists: z.boolean(),
  strategy: z
    .object({
      id: z.string(),
      goals: z.array(z.string()),
      postingFrequency: z.string().nullable(),
      preferredPlatforms: z.array(z.string()),
      contentTypes: z.array(z.string()),
      tone: z.string().nullable(),
      contentLength: z.string().nullable(),
      ctaStyle: z.string().nullable(),
      currentStage: z.string().nullable(),
      nextStep: z.string().nullable(),
      personas: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          age: z.string().nullable(),
          location: z.string().nullable(),
          interests: z.string().nullable(),
          painPoints: z.string().nullable(),
          goals: z.string().nullable(),
        }),
      ),
      competitors: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          website: z.string().nullable(),
          instagram: z.string().nullable(),
          notes: z.string().nullable(),
        }),
      ),
      pillars: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
        }),
      ),
      roadmapTasks: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          done: z.boolean(),
        }),
      ),
    })
    .nullable(),
});

export type BrandGetStrategyOutput = z.infer<typeof outputSchema>;

export const brandGetStrategyTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  BrandGetStrategyOutput
> = {
  id: "brand.getStrategy",
  name: "Brand Strategy",
  description:
    "Read persisted MarketingStrategy for the brand. Returns empty structured result when none exists.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);

    const strategy = await prisma.marketingStrategy.findUnique({
      where: { brandId },
      include: {
        personas: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            age: true,
            location: true,
            interests: true,
            painPoints: true,
            goals: true,
          },
        },
        competitors: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            website: true,
            instagram: true,
            notes: true,
          },
        },
        pillars: {
          where: { archivedAt: null },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        roadmapTasks: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            done: true,
          },
        },
      },
    });

    if (!strategy) {
      return { exists: false, strategy: null };
    }

    return {
      exists: true,
      strategy: {
        id: strategy.id,
        goals: strategy.goals,
        postingFrequency: strategy.postingFrequency,
        preferredPlatforms: strategy.preferredPlatforms,
        contentTypes: strategy.contentTypes,
        tone: strategy.tone,
        contentLength: strategy.contentLength,
        ctaStyle: strategy.ctaStyle,
        currentStage: strategy.currentStage,
        nextStep: strategy.nextStep,
        personas: strategy.personas,
        competitors: strategy.competitors,
        pillars: strategy.pillars,
        roadmapTasks: strategy.roadmapTasks,
      },
    };
  },
};
