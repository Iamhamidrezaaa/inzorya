import { prisma } from "@/lib/db";

export type PerformanceAvailability =
  | { available: true; source: string }
  | { available: false; reason: string };

/**
 * Real performance = metrics tied to actual ContentItems, or non-mock snapshots.
 * Mock analytics seed (source "mock" / synthetic externalIds) is NOT treated as real.
 */
export async function resolvePerformanceAvailability(
  brandId: string,
): Promise<PerformanceAvailability> {
  const realSnapshot = await prisma.analyticsSnapshot.findFirst({
    where: {
      brandId,
      NOT: { source: "mock" },
    },
    select: { source: true },
  });
  if (realSnapshot) {
    return { available: true, source: realSnapshot.source };
  }

  const contentIds = await prisma.contentItem.findMany({
    where: { brandId, deletedAt: null },
    select: { id: true },
    take: 500,
  });
  if (contentIds.length === 0) {
    return { available: false, reason: "SOCIAL_ANALYTICS_NOT_CONNECTED" };
  }

  const linked = await prisma.contentMetric.count({
    where: {
      brandId,
      externalId: { in: contentIds.map((c) => c.id) },
    },
  });

  if (linked > 0) {
    return { available: true, source: "content_metrics" };
  }

  return { available: false, reason: "SOCIAL_ANALYTICS_NOT_CONNECTED" };
}

export function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
