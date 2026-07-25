import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import { computeBusinessCompletion } from "@/lib/business";
import { DEFAULT_CONTENT_PILLARS } from "@/lib/strategy";
import { recordActivity } from "@/server/services/workspace-experience";

const personaSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  age: z.string().max(80).optional().nullable(),
  gender: z.string().max(80).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  interests: z.string().max(4000).optional().nullable(),
  painPoints: z.string().max(4000).optional().nullable(),
  buyingMotivation: z.string().max(4000).optional().nullable(),
  objections: z.string().max(4000).optional().nullable(),
  goals: z.string().max(4000).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const competitorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  website: z.string().max(300).optional().nullable(),
  instagram: z.string().max(120).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const pillarSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  done: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const overviewSchema = z.object({
  industry: z.string().max(120).optional().nullable(),
  targetAudience: z.string().max(5000).optional().nullable(),
  businessGoals: z.string().max(5000).optional().nullable(),
  mainProducts: z.string().max(5000).optional().nullable(),
  brandPersonality: z.string().max(5000).optional().nullable(),
  preferredTone: z.string().max(200).optional().nullable(),
  languages: z.array(z.string()).optional(),
});

const patchSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string(),
  overview: overviewSchema.optional(),
  goals: z.array(z.string()).optional(),
  preferences: z
    .object({
      postingFrequency: z.string().max(120).optional().nullable(),
      preferredPlatforms: z.array(z.string()).optional(),
      contentTypes: z.array(z.string()).optional(),
      tone: z.string().max(200).optional().nullable(),
      contentLength: z.string().max(120).optional().nullable(),
      ctaStyle: z.string().max(200).optional().nullable(),
    })
    .optional(),
  roadmap: z
    .object({
      currentStage: z.string().max(80).optional().nullable(),
      nextStep: z.string().max(500).optional().nullable(),
    })
    .optional(),
  personas: z.array(personaSchema).optional(),
  competitors: z.array(competitorSchema).optional(),
  pillars: z.array(pillarSchema).optional(),
  roadmapTasks: z.array(taskSchema).optional(),
  seedDefaultPillars: z.boolean().optional(),
});

async function ensureStrategy(brandId: string) {
  const existing = await prisma.marketingStrategy.findUnique({
    where: { brandId },
    include: {
      personas: { orderBy: { sortOrder: "asc" } },
      competitors: { orderBy: { sortOrder: "asc" } },
      pillars: { orderBy: { sortOrder: "asc" } },
      roadmapTasks: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (existing) return existing;

  return prisma.marketingStrategy.create({
    data: {
      brandId,
      currentStage: "understand",
      nextStep: "Complete business overview",
      pillars: {
        create: DEFAULT_CONTENT_PILLARS.map((p, i) => ({
          name: p.name,
          description: p.description,
          sortOrder: i,
        })),
      },
      roadmapTasks: {
        create: [
          { title: "Finish business overview", sortOrder: 0 },
          { title: "Select marketing goals", sortOrder: 1 },
          { title: "Add at least one persona", sortOrder: 2 },
          { title: "Review content pillars", sortOrder: 3 },
        ],
      },
    },
    include: {
      personas: { orderBy: { sortOrder: "asc" } },
      competitors: { orderBy: { sortOrder: "asc" } },
      pillars: { orderBy: { sortOrder: "asc" } },
      roadmapTasks: { orderBy: { sortOrder: "asc" } },
    },
  });
}

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

    const [strategy, profile, connectedChannels] = await Promise.all([
      ensureStrategy(access.brand.id),
      prisma.businessProfile.findUnique({ where: { brandId: access.brand.id } }),
      prisma.channelConnection.findMany({
        where: { brandId: access.brand.id, status: "CONNECTED" },
        include: { socialChannel: true },
      }),
    ]);

    return NextResponse.json({
      strategy,
      profile,
      brand: {
        id: access.brand.id,
        name: access.brand.name,
        slug: access.brand.slug,
        industry: access.brand.industry,
        brandVoice: access.brand.brandVoice,
        targetAudience: access.brand.targetAudience,
      },
      completion: computeBusinessCompletion(profile),
      connectedChannels: connectedChannels.map((c) => ({
        platform: c.socialChannel.platform,
        name: c.socialChannel.name,
        handle: c.accountHandle,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load strategy." }, { status: 500 });
  }
}

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

    const strategy = await ensureStrategy(access.brand.id);

    if (parsed.data.overview) {
      const o = parsed.data.overview;
      await prisma.businessProfile.upsert({
        where: { brandId: access.brand.id },
        create: {
          brandId: access.brand.id,
          industry: o.industry ?? null,
          targetAudience: o.targetAudience ?? null,
          businessGoals: o.businessGoals ?? null,
          mainProducts: o.mainProducts ?? null,
          brandPersonality: o.brandPersonality ?? null,
          preferredTone: o.preferredTone ?? null,
          languages: o.languages ?? [],
        },
        update: {
          ...(o.industry !== undefined ? { industry: o.industry } : {}),
          ...(o.targetAudience !== undefined
            ? { targetAudience: o.targetAudience }
            : {}),
          ...(o.businessGoals !== undefined
            ? { businessGoals: o.businessGoals }
            : {}),
          ...(o.mainProducts !== undefined
            ? { mainProducts: o.mainProducts }
            : {}),
          ...(o.brandPersonality !== undefined
            ? { brandPersonality: o.brandPersonality }
            : {}),
          ...(o.preferredTone !== undefined
            ? { preferredTone: o.preferredTone }
            : {}),
          ...(o.languages !== undefined ? { languages: o.languages } : {}),
        },
      });

      await prisma.brand.update({
        where: { id: access.brand.id },
        data: {
          ...(o.industry !== undefined
            ? { industry: o.industry?.trim() || null }
            : {}),
          ...(o.preferredTone !== undefined
            ? { brandVoice: o.preferredTone?.trim() || null }
            : {}),
          ...(o.targetAudience !== undefined
            ? { targetAudience: o.targetAudience?.trim() || null }
            : {}),
        },
      });
    }

    const strategyUpdate: {
      goals?: string[];
      postingFrequency?: string | null;
      preferredPlatforms?: string[];
      contentTypes?: string[];
      tone?: string | null;
      contentLength?: string | null;
      ctaStyle?: string | null;
      currentStage?: string | null;
      nextStep?: string | null;
    } = {};

    if (parsed.data.goals) strategyUpdate.goals = parsed.data.goals;
    if (parsed.data.preferences) {
      const p = parsed.data.preferences;
      if (p.postingFrequency !== undefined)
        strategyUpdate.postingFrequency = p.postingFrequency;
      if (p.preferredPlatforms !== undefined)
        strategyUpdate.preferredPlatforms = p.preferredPlatforms;
      if (p.contentTypes !== undefined)
        strategyUpdate.contentTypes = p.contentTypes;
      if (p.tone !== undefined) strategyUpdate.tone = p.tone;
      if (p.contentLength !== undefined)
        strategyUpdate.contentLength = p.contentLength;
      if (p.ctaStyle !== undefined) strategyUpdate.ctaStyle = p.ctaStyle;
    }
    if (parsed.data.roadmap) {
      if (parsed.data.roadmap.currentStage !== undefined)
        strategyUpdate.currentStage = parsed.data.roadmap.currentStage;
      if (parsed.data.roadmap.nextStep !== undefined)
        strategyUpdate.nextStep = parsed.data.roadmap.nextStep;
    }

    if (Object.keys(strategyUpdate).length > 0) {
      await prisma.marketingStrategy.update({
        where: { id: strategy.id },
        data: strategyUpdate,
      });
    }

    if (parsed.data.personas) {
      await prisma.audiencePersona.deleteMany({
        where: { strategyId: strategy.id },
      });
      if (parsed.data.personas.length > 0) {
        await prisma.audiencePersona.createMany({
          data: parsed.data.personas.map((p, i) => ({
            strategyId: strategy.id,
            name: p.name.trim(),
            age: p.age ?? null,
            gender: p.gender ?? null,
            location: p.location ?? null,
            interests: p.interests ?? null,
            painPoints: p.painPoints ?? null,
            buyingMotivation: p.buyingMotivation ?? null,
            objections: p.objections ?? null,
            goals: p.goals ?? null,
            sortOrder: p.sortOrder ?? i,
          })),
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
            notes: c.notes ?? null,
            sortOrder: c.sortOrder ?? i,
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
            sortOrder: p.sortOrder ?? i,
          })),
        });
      }
    } else if (parsed.data.seedDefaultPillars) {
      const count = await prisma.contentPillar.count({
        where: { strategyId: strategy.id },
      });
      if (count === 0) {
        await prisma.contentPillar.createMany({
          data: DEFAULT_CONTENT_PILLARS.map((p, i) => ({
            strategyId: strategy.id,
            name: p.name,
            description: p.description,
            sortOrder: i,
          })),
        });
      }
    }

    if (parsed.data.roadmapTasks) {
      await prisma.roadmapTask.deleteMany({
        where: { strategyId: strategy.id },
      });
      if (parsed.data.roadmapTasks.length > 0) {
        await prisma.roadmapTask.createMany({
          data: parsed.data.roadmapTasks.map((t, i) => ({
            strategyId: strategy.id,
            title: t.title.trim(),
            done: t.done ?? false,
            sortOrder: t.sortOrder ?? i,
          })),
        });
      }
    }

    if (parsed.data.personas) {
      await recordActivity({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        kind: "PERSONA_UPDATED",
        title: "Audience personas updated",
        href: `/w/${parsed.data.workspaceSlug}/b/${parsed.data.brandSlug}/strategy`,
      });
    } else if (parsed.data.overview) {
      await recordActivity({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        kind: "BUSINESS_UPDATED",
        title: "Business overview updated",
        href: `/w/${parsed.data.workspaceSlug}/b/${parsed.data.brandSlug}/strategy`,
      });
    } else {
      await recordActivity({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        userId: user.id!,
        kind: "STRATEGY_UPDATED",
        title: "Strategy workspace updated",
        href: `/w/${parsed.data.workspaceSlug}/b/${parsed.data.brandSlug}/strategy`,
      });
    }

    const [fresh, profile, connectedChannels] = await Promise.all([
      prisma.marketingStrategy.findUniqueOrThrow({
        where: { id: strategy.id },
        include: {
          personas: { orderBy: { sortOrder: "asc" } },
          competitors: { orderBy: { sortOrder: "asc" } },
          pillars: { orderBy: { sortOrder: "asc" } },
          roadmapTasks: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.businessProfile.findUnique({ where: { brandId: access.brand.id } }),
      prisma.channelConnection.findMany({
        where: { brandId: access.brand.id, status: "CONNECTED" },
        include: { socialChannel: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      strategy: fresh,
      profile,
      completion: computeBusinessCompletion(profile),
      connectedChannels: connectedChannels.map((c) => ({
        platform: c.socialChannel.platform,
        name: c.socialChannel.name,
        handle: c.accountHandle,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save strategy." }, { status: 500 });
  }
}
