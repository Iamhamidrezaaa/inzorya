import { prisma } from "@/lib/db";

export type PerformanceAvailability =
  | {
      available: true;
      source: string;
      lastUpdatedAt?: string | null;
      sampleSize?: number;
      limitations?: string[];
    }
  | { available: false; reason: string; limitations?: string[] };

const NON_REAL_SOURCES = ["mock", "legacy"] as const;

/**
 * Real performance = non-mock snapshots, ContentItem-linked metrics,
 * or EPIC-017 ingested SocialPublication metrics (source *_API).
 * Never treats missing data as zeros.
 */
export async function resolvePerformanceAvailability(
  brandId: string,
): Promise<PerformanceAvailability> {
  const realSnapshot = await prisma.analyticsSnapshot.findFirst({
    where: {
      brandId,
      NOT: { source: "mock" },
    },
    select: { source: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  if (realSnapshot) {
    return {
      available: true,
      source: realSnapshot.source,
      lastUpdatedAt: realSnapshot.updatedAt.toISOString(),
    };
  }

  const ingested = await prisma.contentMetric.findFirst({
    where: {
      brandId,
      NOT: { source: { in: [...NON_REAL_SOURCES] } },
      OR: [
        { socialPublicationId: { not: null } },
        { externalPostId: { not: null } },
      ],
    },
    select: { source: true, collectedAt: true, updatedAt: true },
    orderBy: { collectedAt: "desc" },
  });
  if (ingested) {
    const count = await prisma.contentMetric.count({
      where: {
        brandId,
        NOT: { source: { in: [...NON_REAL_SOURCES] } },
        OR: [
          { socialPublicationId: { not: null } },
          { externalPostId: { not: null } },
        ],
      },
    });
    return {
      available: true,
      source: ingested.source,
      lastUpdatedAt: (ingested.collectedAt ?? ingested.updatedAt).toISOString(),
      sampleSize: count,
      limitations:
        count < 5 ? ["SMALL_SAMPLE: fewer than 5 ingested metric rows"] : [],
    };
  }

  const contentIds = await prisma.contentItem.findMany({
    where: { brandId, deletedAt: null },
    select: { id: true },
    take: 500,
  });
  if (contentIds.length === 0) {
    return {
      available: false,
      reason: "SOCIAL_ANALYTICS_NOT_CONNECTED",
      limitations: ["No connected analytics source or ingested metrics"],
    };
  }

  const linked = await prisma.contentMetric.count({
    where: {
      brandId,
      externalId: { in: contentIds.map((c) => c.id) },
      NOT: { source: "mock" },
    },
  });

  if (linked > 0) {
    return { available: true, source: "content_metrics", sampleSize: linked };
  }

  // Mock seed exists but is not treated as real
  const mockOnly = await prisma.contentMetric.count({
    where: {
      brandId,
      externalId: { in: contentIds.map((c) => c.id) },
      source: "mock",
    },
  });
  if (mockOnly > 0) {
    return {
      available: false,
      reason: "SOCIAL_ANALYTICS_NOT_CONNECTED",
      limitations: ["Only mock analytics seed present — not treated as real"],
    };
  }

  return {
    available: false,
    reason: "SOCIAL_ANALYTICS_NOT_CONNECTED",
    limitations: ["No real ContentMetric or snapshot for this brand"],
  };
}

/**
 * Resolve ContentMetric rows for analytics tools:
 * - ContentItem.id === externalId (legacy path)
 * - SocialPublication.externalPostId === ContentMetric.externalPostId (EPIC-017)
 */
export async function resolveMetricQueryScope(brandId: string): Promise<{
  contentItemIds: string[];
  externalPostIds: string[];
  publicationIds: string[];
}> {
  const contentItems = await prisma.contentItem.findMany({
    where: { brandId, deletedAt: null },
    select: { id: true },
    take: 500,
  });
  const publications = await prisma.socialPublication.findMany({
    where: {
      brandId,
      status: "PUBLISHED",
      externalPostId: { not: null },
    },
    select: { id: true, externalPostId: true },
    take: 500,
  });
  return {
    contentItemIds: contentItems.map((c) => c.id),
    externalPostIds: publications
      .map((p) => p.externalPostId)
      .filter((id): id is string => Boolean(id)),
    publicationIds: publications.map((p) => p.id),
  };
}

export function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function sumNullable(
  values: Array<number | null | undefined>,
): number | null {
  let sum = 0;
  let any = false;
  for (const v of values) {
    if (v == null) continue;
    sum += v;
    any = true;
  }
  return any ? sum : null;
}
