import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";
import { createBrand } from "@/server/services/workspace";
import { computeBusinessCompletion } from "@/lib/business";

const profileSchema = z.object({
  workspaceSlug: z.string(),
  brandSlug: z.string().optional(),
  name: z.string().min(2).max(80).optional(),
  businessSummary: z.string().max(5000).optional().nullable(),
  industry: z.string().max(120).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  languages: z.array(z.string()).optional(),
  businessGoals: z.string().max(5000).optional().nullable(),
  mainProducts: z.string().max(5000).optional().nullable(),
  targetAudience: z.string().max(5000).optional().nullable(),
  competitors: z.string().max(5000).optional().nullable(),
  brandPersonality: z.string().max(5000).optional().nullable(),
  preferredTone: z.string().max(200).optional().nullable(),
  contentStyle: z.string().max(5000).optional().nullable(),
  mainCta: z.string().max(300).optional().nullable(),
  postingFrequency: z.string().max(120).optional().nullable(),
  preferredPlatforms: z.array(z.string()).optional(),
  marketingChallenges: z.string().max(5000).optional().nullable(),
  monthlyBudget: z.string().max(120).optional().nullable(),
  teamSize: z.string().max(120).optional().nullable(),
  onboardingStep: z.number().int().min(0).max(20).optional(),
  complete: z.boolean().optional(),
});

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

    const profile = await prisma.businessProfile.findUnique({
      where: { brandId: access.brand.id },
    });

    return NextResponse.json({
      brand: access.brand,
      profile,
      completion: computeBusinessCompletion(profile),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load profile." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const workspaceSlug = String(body.workspaceSlug || "");
    const name = String(body.name || "").trim();

    if (!workspaceSlug || name.length < 2) {
      return NextResponse.json({ error: "Brand name required." }, { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        slug: workspaceSlug,
        members: { some: { userId: user.id } },
      },
      include: { brands: true },
    });
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }

    let brand = workspace.brands[0];
    if (!brand) {
      brand = await createBrand({
        workspaceId: workspace.id,
        name,
        website: body.website || undefined,
        description: body.businessSummary || undefined,
      });
    }

    const profile = await prisma.businessProfile.upsert({
      where: { brandId: brand.id },
      create: {
        brandId: brand.id,
        businessSummary: body.businessSummary || null,
        website: body.website || null,
        industry: body.industry || null,
        onboardingStep: 0,
      },
      update: {},
    });

    return NextResponse.json({
      ok: true,
      brandSlug: brand.slug,
      workspaceSlug: workspace.slug,
      profile,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to start onboarding." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
    }

    const brandSlug = parsed.data.brandSlug;
    if (!brandSlug) {
      return NextResponse.json({ error: "brandSlug required." }, { status: 400 });
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (parsed.data.name) {
      await prisma.brand.update({
        where: { id: access.brand.id },
        data: {
          name: parsed.data.name.trim(),
          website: parsed.data.website?.trim() || access.brand.website,
          industry: parsed.data.industry?.trim() || access.brand.industry,
          description:
            parsed.data.businessSummary?.trim() || access.brand.description,
          brandVoice:
            parsed.data.preferredTone?.trim() || access.brand.brandVoice,
          targetAudience:
            parsed.data.targetAudience?.trim() || access.brand.targetAudience,
        },
      });
    }

    const data = {
      businessSummary: parsed.data.businessSummary,
      industry: parsed.data.industry,
      website: parsed.data.website,
      country: parsed.data.country,
      languages: parsed.data.languages,
      businessGoals: parsed.data.businessGoals,
      mainProducts: parsed.data.mainProducts,
      targetAudience: parsed.data.targetAudience,
      competitors: parsed.data.competitors,
      brandPersonality: parsed.data.brandPersonality,
      preferredTone: parsed.data.preferredTone,
      contentStyle: parsed.data.contentStyle,
      mainCta: parsed.data.mainCta,
      postingFrequency: parsed.data.postingFrequency,
      preferredPlatforms: parsed.data.preferredPlatforms,
      marketingChallenges: parsed.data.marketingChallenges,
      monthlyBudget: parsed.data.monthlyBudget,
      teamSize: parsed.data.teamSize,
      onboardingStep: parsed.data.onboardingStep,
      ...(parsed.data.complete
        ? { onboardingCompletedAt: new Date() }
        : {}),
    };

    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );

    const profile = await prisma.businessProfile.upsert({
      where: { brandId: access.brand.id },
      create: {
        brandId: access.brand.id,
        ...cleaned,
      },
      update: cleaned,
    });

    return NextResponse.json({
      ok: true,
      profile,
      completion: computeBusinessCompletion(profile),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save profile." }, { status: 500 });
  }
}
