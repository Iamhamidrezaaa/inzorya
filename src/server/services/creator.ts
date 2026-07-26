import type {
  CreatorContentType,
  CreatorObjective,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_CHECKLIST } from "@/lib/content-studio";
import {
  estimateReadTime,
  type CreatorContentTypeKey,
  type CreatorObjectiveKey,
} from "@/lib/creator";
import { runAITask } from "@/server/ai";
import { recordActivity } from "@/server/services/workspace-experience";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function clampScore(n: unknown) {
  const v = Number(n);
  if (Number.isNaN(v)) return 70;
  return Math.max(0, Math.min(100, v));
}

const contentInclude = {
  variations: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      score: true,
      brandValidation: true,
      visuals: { orderBy: { sortOrder: "asc" as const } },
    },
  },
  feedback: { orderBy: { createdAt: "desc" as const }, take: 20 },
  versions: {
    orderBy: { version: "desc" as const },
    take: 10,
    select: {
      id: true,
      version: true,
      title: true,
      status: true,
      rewriteStyle: true,
      createdAt: true,
    },
  },
};

async function persistVariations(
  contentId: string,
  variations: unknown[],
) {
  const created = [];
  for (let i = 0; i < variations.length; i++) {
    const raw = (variations[i] || {}) as Record<string, unknown>;
    const score = (raw.score || {}) as Record<string, unknown>;
    const review = (raw.review || {}) as Record<string, unknown>;
    const visuals = Array.isArray(raw.visuals) ? raw.visuals : [];
    const body = String(raw.body || "");
    const variation = await prisma.generatedVariation.create({
      data: {
        contentId,
        label: String(raw.label || `V${i + 1}`),
        sortOrder: i,
        title: String(raw.title || `Variation ${i + 1}`).slice(0, 200),
        hook: String(raw.hook || ""),
        body,
        cta: raw.cta ? String(raw.cta) : null,
        visualDirection: raw.visualDirection ? String(raw.visualDirection) : null,
        suggestedCover: raw.suggestedCover ? String(raw.suggestedCover) : null,
        hashtags: Array.isArray(raw.hashtags)
          ? raw.hashtags.map((h) => String(h))
          : [],
        keywords: Array.isArray(raw.keywords)
          ? raw.keywords.map((k) => String(k))
          : [],
        estimatedReadTime:
          String(raw.estimatedReadTime || estimateReadTime(`${raw.hook || ""} ${body}`)),
        carouselSlides: raw.carouselSlides ? asJson(raw.carouselSlides) : undefined,
        reelBreakdown: raw.reelBreakdown ? asJson(raw.reelBreakdown) : undefined,
        reviewNotes: asJson(review),
        overallScore: clampScore(score.overall),
        score: {
          create: {
            brandConsistency: clampScore(score.brandConsistency),
            readability: clampScore(score.readability),
            ctaStrength: clampScore(score.ctaStrength),
            emotionalImpact: clampScore(score.emotionalImpact),
            engagementPotential: clampScore(score.engagementPotential),
            seoQuality: clampScore(score.seoQuality),
            platformCompatibility: clampScore(score.platformCompatibility),
            overall: clampScore(score.overall),
            explanation: String(
              score.explanation ||
                "Score reflects brand fit, clarity, CTA strength, and platform norms.",
            ),
          },
        },
        brandValidation: {
          create: {
            passed: review.passed !== false,
            grammarOk: review.grammarOk !== false,
            voiceOk: review.voiceOk !== false,
            lengthOk: review.lengthOk !== false,
            toneOk: review.toneOk !== false,
            ctaOk: review.ctaOk !== false,
            formattingOk: review.formattingOk !== false,
            forbiddenHits: Array.isArray(review.forbiddenHits)
              ? review.forbiddenHits.map((x) => String(x))
              : [],
            repetitionNotes: review.repetitionNotes
              ? String(review.repetitionNotes)
              : null,
            notes: review.notes ? String(review.notes) : null,
          },
        },
        visuals: {
          create: visuals.slice(0, 8).map((v, idx) => {
            const item = v as Record<string, unknown>;
            return {
              kind: String(item.kind || "image"),
              title: String(item.title || "Visual idea").slice(0, 160),
              detail: String(item.detail || ""),
              sortOrder: idx,
            };
          }),
        },
      },
    });
    created.push(variation);
  }
  return created;
}

function detectQualityFlags(
  variations: Array<{ hook: string; cta: string | null; body: string }>,
  aiFlags: unknown[],
) {
  const flags: { kind: string; message: string }[] = [];
  for (const f of aiFlags) {
    const row = f as Record<string, unknown>;
    flags.push({
      kind: String(row.kind || "info"),
      message: String(row.message || ""),
    });
  }
  const hooks = variations.map((v) => v.hook.trim().toLowerCase());
  const uniqueHooks = new Set(hooks);
  if (uniqueHooks.size < hooks.length) {
    flags.push({
      kind: "duplicate_hooks",
      message: "Duplicate hooks detected across variations.",
    });
  }
  for (const v of variations) {
    if (!v.cta || v.cta.trim().length < 8) {
      flags.push({
        kind: "weak_cta",
        message: "At least one variation has a weak or missing CTA.",
      });
      break;
    }
  }
  const shortBodies = variations.filter((v) => v.body.trim().split(/\s+/).length < 12);
  if (shortBodies.length && variations.some((v) => v.body.length > 40)) {
    flags.push({
      kind: "low_readability",
      message: "Some variations may be too thin for the selected format.",
    });
  }
  return flags;
}

export async function getCreatorBootstrap(input: {
  workspaceId: string;
  brandId: string;
}) {
  const [history, campaigns, strategy] = await Promise.all([
    prisma.generatedContent.findMany({
      where: { brandId: input.brandId, status: { not: "ARCHIVED" } },
      orderBy: [{ favorited: "desc" }, { updatedAt: "desc" }],
      take: 40,
      select: {
        id: true,
        title: true,
        platform: true,
        objective: true,
        contentType: true,
        status: true,
        favorited: true,
        version: true,
        campaignName: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { variations: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { brandId: input.brandId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, name: true, status: true, objective: true },
    }),
    prisma.marketingStrategy.findUnique({
      where: { brandId: input.brandId },
      select: {
        goals: true,
        tone: true,
        preferredPlatforms: true,
        personas: { take: 5, select: { name: true } },
      },
    }),
  ]);

  return {
    history,
    campaigns,
    defaults: {
      platform: strategy?.preferredPlatforms?.[0]?.toUpperCase() || "INSTAGRAM",
      objective: "ENGAGEMENT" as CreatorObjectiveKey,
      contentType: "INSTAGRAM_CAPTION" as CreatorContentTypeKey,
      variationCount: 3,
      audienceHint: strategy?.personas?.[0]?.name || "",
      tone: strategy?.tone || "",
      goals: strategy?.goals || [],
    },
  };
}

export async function getGeneratedContent(id: string, brandId: string) {
  return prisma.generatedContent.findFirst({
    where: { id, brandId },
    include: contentInclude,
  });
}

export async function generateContent(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  platform: string;
  objective: CreatorObjectiveKey;
  contentType: CreatorContentTypeKey;
  campaignId?: string | null;
  campaignName?: string | null;
  variationCount?: number;
  language?: string;
}) {
  const variationCount = [3, 5, 10].includes(Number(input.variationCount))
    ? Number(input.variationCount)
    : 3;

  let campaignName = input.campaignName || null;
  if (input.campaignId && !campaignName) {
    const c = await prisma.campaign.findFirst({
      where: { id: input.campaignId, brandId: input.brandId },
    });
    campaignName = c?.name || null;
  }

  const session = await prisma.generationSession.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      platform: input.platform,
      objective: input.objective as CreatorObjective,
      contentType: input.contentType as CreatorContentType,
      campaignId: input.campaignId || null,
      variationCount,
      status: "RUNNING",
      settings: asJson({ campaignName }),
    },
  });

  try {
    const result = await runAITask({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      taskKey: "creator.generate",
      input: {
        text: `Generate ${input.contentType} for ${input.platform}`,
        platform: input.platform,
        objective: input.objective,
        contentType: input.contentType,
        variationCount,
        campaignName: campaignName || undefined,
        language: input.language || "en",
      },
    });

    const output = (result.output || {}) as Record<string, unknown>;
    const rawVariations = Array.isArray(output.variations) ? output.variations : [];

    const content = await prisma.generatedContent.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        sessionId: session.id,
        createdById: input.userId,
        platform: input.platform,
        objective: input.objective as CreatorObjective,
        contentType: input.contentType as CreatorContentType,
        campaignId: input.campaignId || null,
        campaignName,
        title: String(output.title || `${input.contentType} · ${input.platform}`),
        status: "REVIEWED",
        version: 1,
      },
    });

    await persistVariations(content.id, rawVariations);

    const saved = await getGeneratedContent(content.id, input.brandId);
    const flags = detectQualityFlags(
      (saved?.variations || []).map((v) => ({
        hook: v.hook,
        cta: v.cta,
        body: v.body,
      })),
      Array.isArray(output.qualityFlags) ? output.qualityFlags : [],
    );

    await prisma.generatedContent.update({
      where: { id: content.id },
      data: { qualityFlags: asJson(flags) },
    });

    await prisma.generationSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", executionId: result.execution.id },
    });

    await recordActivity({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      userId: input.userId,
      kind: "CONTENT_CREATED",
      title: `AI content generated: ${content.title}`,
    });

    return getGeneratedContent(content.id, input.brandId);
  } catch (error) {
    await prisma.generationSession.update({
      where: { id: session.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Failed",
      },
    });
    throw error;
  }
}

export async function rewriteVariation(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  contentId: string;
  variationId: string;
  style: string;
  language?: string;
}) {
  const existing = await prisma.generatedContent.findFirst({
    where: { id: input.contentId, brandId: input.brandId },
    include: {
      variations: { where: { id: input.variationId }, take: 1 },
    },
  });
  if (!existing || !existing.variations[0]) return null;
  const source = existing.variations[0];

  const result = await runAITask({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    taskKey: "creator.generate",
    input: {
      text: `Rewrite variation as ${input.style}`,
      platform: existing.platform,
      objective: existing.objective,
      contentType: existing.contentType,
      variationCount: 1,
      campaignName: existing.campaignName || undefined,
      rewriteStyle: input.style,
      language: input.language || "en",
      sourceVariation: {
        title: source.title,
        hook: source.hook,
        body: source.body,
        cta: source.cta,
      },
    },
  });

  const output = (result.output || {}) as Record<string, unknown>;
  const rawVariations = Array.isArray(output.variations) ? output.variations : [];

  const next = await prisma.generatedContent.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      sessionId: existing.sessionId,
      createdById: input.userId,
      parentId: existing.parentId || existing.id,
      platform: existing.platform,
      objective: existing.objective,
      contentType: existing.contentType,
      campaignId: existing.campaignId,
      campaignName: existing.campaignName,
      title: `${existing.title} · ${input.style}`,
      status: "REVIEWED",
      version: existing.version + 1,
      rewriteStyle: input.style,
    },
  });

  await persistVariations(next.id, rawVariations.length ? rawVariations : [
    {
      label: "V1",
      title: source.title,
      hook: source.hook,
      body: source.body,
      cta: source.cta,
    },
  ]);

  await prisma.generationFeedback.create({
    data: {
      contentId: next.id,
      action: `rewrite:${input.style}`,
      note: `Rewrote from ${existing.id}`,
    },
  });

  return getGeneratedContent(next.id, input.brandId);
}

export async function updateGeneratedContent(input: {
  brandId: string;
  contentId: string;
  favorited?: boolean;
  archived?: boolean;
  status?: "DRAFT" | "REVIEWED" | "APPROVED" | "PUSHED" | "ARCHIVED";
  duplicate?: boolean;
  userId?: string;
}) {
  const existing = await prisma.generatedContent.findFirst({
    where: { id: input.contentId, brandId: input.brandId },
    include: {
      variations: {
        include: { score: true, brandValidation: true, visuals: true },
      },
    },
  });
  if (!existing) return null;

  if (input.duplicate) {
    const copy = await prisma.generatedContent.create({
      data: {
        workspaceId: existing.workspaceId,
        brandId: existing.brandId,
        sessionId: existing.sessionId,
        createdById: input.userId || existing.createdById,
        parentId: existing.id,
        platform: existing.platform,
        objective: existing.objective,
        contentType: existing.contentType,
        campaignId: existing.campaignId,
        campaignName: existing.campaignName,
        title: `${existing.title} (copy)`,
        status: "DRAFT",
        version: 1,
        qualityFlags: existing.qualityFlags ?? undefined,
      },
    });
    for (const v of existing.variations) {
      await prisma.generatedVariation.create({
        data: {
          contentId: copy.id,
          label: v.label,
          sortOrder: v.sortOrder,
          title: v.title,
          hook: v.hook,
          body: v.body,
          cta: v.cta,
          visualDirection: v.visualDirection,
          suggestedCover: v.suggestedCover,
          hashtags: v.hashtags,
          keywords: v.keywords,
          estimatedReadTime: v.estimatedReadTime,
          carouselSlides: v.carouselSlides ?? undefined,
          reelBreakdown: v.reelBreakdown ?? undefined,
          reviewNotes: v.reviewNotes ?? undefined,
          overallScore: v.overallScore,
          score: v.score
            ? {
                create: {
                  brandConsistency: v.score.brandConsistency,
                  readability: v.score.readability,
                  ctaStrength: v.score.ctaStrength,
                  emotionalImpact: v.score.emotionalImpact,
                  engagementPotential: v.score.engagementPotential,
                  seoQuality: v.score.seoQuality,
                  platformCompatibility: v.score.platformCompatibility,
                  overall: v.score.overall,
                  explanation: v.score.explanation,
                },
              }
            : undefined,
          brandValidation: v.brandValidation
            ? {
                create: {
                  passed: v.brandValidation.passed,
                  grammarOk: v.brandValidation.grammarOk,
                  voiceOk: v.brandValidation.voiceOk,
                  lengthOk: v.brandValidation.lengthOk,
                  toneOk: v.brandValidation.toneOk,
                  ctaOk: v.brandValidation.ctaOk,
                  formattingOk: v.brandValidation.formattingOk,
                  forbiddenHits: v.brandValidation.forbiddenHits,
                  repetitionNotes: v.brandValidation.repetitionNotes,
                  notes: v.brandValidation.notes,
                },
              }
            : undefined,
          visuals: {
            create: v.visuals.map((vis) => ({
              kind: vis.kind,
              title: vis.title,
              detail: vis.detail,
              sortOrder: vis.sortOrder,
            })),
          },
        },
      });
    }
    return getGeneratedContent(copy.id, input.brandId);
  }

  return prisma.generatedContent.update({
    where: { id: existing.id },
    data: {
      favorited:
        typeof input.favorited === "boolean" ? input.favorited : undefined,
      status: input.archived ? "ARCHIVED" : input.status,
    },
    include: contentInclude,
  });
}

export async function restoreVersion(input: {
  brandId: string;
  contentId: string;
  userId: string;
}) {
  const source = await prisma.generatedContent.findFirst({
    where: { id: input.contentId, brandId: input.brandId },
    include: {
      variations: {
        include: { score: true, brandValidation: true, visuals: true },
      },
    },
  });
  if (!source) return null;

  const rootId = source.parentId || source.id;
  const latest = await prisma.generatedContent.findFirst({
    where: {
      brandId: input.brandId,
      OR: [{ id: rootId }, { parentId: rootId }],
    },
    orderBy: { version: "desc" },
  });

  const restored = await prisma.generatedContent.create({
    data: {
      workspaceId: source.workspaceId,
      brandId: source.brandId,
      sessionId: source.sessionId,
      createdById: input.userId,
      parentId: rootId,
      platform: source.platform,
      objective: source.objective,
      contentType: source.contentType,
      campaignId: source.campaignId,
      campaignName: source.campaignName,
      title: `${source.title} (restored)`,
      status: "REVIEWED",
      version: (latest?.version || source.version) + 1,
      qualityFlags: source.qualityFlags ?? undefined,
    },
  });

  for (const v of source.variations) {
    await prisma.generatedVariation.create({
      data: {
        contentId: restored.id,
        label: v.label,
        sortOrder: v.sortOrder,
        status: "RESTORED",
        title: v.title,
        hook: v.hook,
        body: v.body,
        cta: v.cta,
        visualDirection: v.visualDirection,
        suggestedCover: v.suggestedCover,
        hashtags: v.hashtags,
        keywords: v.keywords,
        estimatedReadTime: v.estimatedReadTime,
        carouselSlides: v.carouselSlides ?? undefined,
        reelBreakdown: v.reelBreakdown ?? undefined,
        reviewNotes: v.reviewNotes ?? undefined,
        overallScore: v.overallScore,
        score: v.score
          ? {
              create: {
                brandConsistency: v.score.brandConsistency,
                readability: v.score.readability,
                ctaStrength: v.score.ctaStrength,
                emotionalImpact: v.score.emotionalImpact,
                engagementPotential: v.score.engagementPotential,
                seoQuality: v.score.seoQuality,
                platformCompatibility: v.score.platformCompatibility,
                overall: v.score.overall,
                explanation: v.score.explanation,
              },
            }
          : undefined,
      },
    });
  }

  await prisma.generationFeedback.create({
    data: {
      contentId: restored.id,
      action: "restore",
      note: `Restored from ${source.id}`,
    },
  });

  return getGeneratedContent(restored.id, input.brandId);
}

export async function setVariationFavorite(input: {
  brandId: string;
  variationId: string;
  favorited: boolean;
}) {
  const variation = await prisma.generatedVariation.findFirst({
    where: { id: input.variationId, content: { brandId: input.brandId } },
  });
  if (!variation) return null;
  return prisma.generatedVariation.update({
    where: { id: variation.id },
    data: { status: input.favorited ? "FAVORITED" : "ACTIVE" },
  });
}

export async function pushVariationToStudio(input: {
  workspaceId: string;
  brandId: string;
  userId: string;
  workspaceSlug: string;
  brandSlug: string;
  contentId: string;
  variationId: string;
}) {
  const content = await prisma.generatedContent.findFirst({
    where: { id: input.contentId, brandId: input.brandId },
    include: { variations: { where: { id: input.variationId }, take: 1 } },
  });
  if (!content || !content.variations[0]) return null;
  const v = content.variations[0];

  const body = [v.hook, "", v.body, v.cta ? `\n\nCTA: ${v.cta}` : ""]
    .filter(Boolean)
    .join("\n");

  const studio = await prisma.contentItem.create({
    data: {
      brandId: input.brandId,
      title: v.title || content.title,
      body,
      description: v.visualDirection,
      objective: content.objective,
      targetAudience: null,
      notes: `From AI Content Creator · score ${v.overallScore ?? "—"}`,
      status: "DRAFT",
      platform:
        content.platform === "LANDING"
          ? "OTHER"
          : content.platform === "THREADS"
            ? "OTHER"
            : (content.platform as "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "X" | "TIKTOK" | "YOUTUBE" | "BLOG" | "EMAIL" | "NEWSLETTER" | "OTHER"),
      format:
        content.contentType === "CAROUSEL"
          ? "INSTAGRAM_CAROUSEL"
          : content.contentType === "REEL_SCRIPT"
            ? "INSTAGRAM_REEL"
            : content.contentType === "STORY"
              ? "INSTAGRAM_STORY"
              : content.contentType === "BLOG_ARTICLE"
                ? "BLOG"
                : content.contentType === "NEWSLETTER" ||
                    content.contentType === "EMAIL_CAMPAIGN"
                  ? "NEWSLETTER"
                  : "INSTAGRAM_POST",
      priority: "MEDIUM",
      campaignId: content.campaignId,
      brief: {
        create: {
          goal: content.objective,
          hook: v.hook,
          cta: v.cta,
          keywords: v.keywords,
          hashtags: v.hashtags,
        },
      },
      checklist: {
        create: DEFAULT_CHECKLIST.map((label, idx) => ({
          label,
          sortOrder: idx,
        })),
      },
    },
  });

  await prisma.generatedContent.update({
    where: { id: content.id },
    data: { status: "PUSHED", studioContentId: studio.id },
  });

  await prisma.generationFeedback.create({
    data: {
      contentId: content.id,
      variationId: v.id,
      action: "push_studio",
      note: studio.id,
    },
  });

  await recordActivity({
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    userId: input.userId,
    kind: "CONTENT_CREATED",
    title: `Pushed AI content to Studio: ${studio.title}`,
    href: `/w/${input.workspaceSlug}/b/${input.brandSlug}/studio`,
  });

  return {
    studioContentId: studio.id,
    content: await getGeneratedContent(content.id, input.brandId),
  };
}

export function variationToMarkdown(v: {
  title: string;
  hook: string;
  body: string;
  cta: string | null;
  hashtags: string[];
  keywords: string[];
  visualDirection: string | null;
  suggestedCover: string | null;
  estimatedReadTime: string | null;
}) {
  return [
    `# ${v.title}`,
    "",
    `**Hook:** ${v.hook}`,
    "",
    v.body,
    "",
    v.cta ? `**CTA:** ${v.cta}` : "",
    "",
    v.visualDirection ? `**Visual direction:** ${v.visualDirection}` : "",
    v.suggestedCover ? `**Cover:** ${v.suggestedCover}` : "",
    v.hashtags.length ? `**Hashtags:** ${v.hashtags.join(" ")}` : "",
    v.keywords.length ? `**Keywords:** ${v.keywords.join(", ")}` : "",
    v.estimatedReadTime ? `**Read time:** ${v.estimatedReadTime}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
