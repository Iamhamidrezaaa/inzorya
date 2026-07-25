import { prisma } from "@/lib/db";
import { uniqueSlug } from "@/lib/utils";

export async function getUserWorkspaces(userId: string) {
  return prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    include: {
      brands: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
      },
      members: {
        where: { userId },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getWorkspaceForUser(slug: string, userId: string) {
  return prisma.workspace.findFirst({
    where: {
      slug,
      members: { some: { userId } },
    },
    include: {
      brands: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
      },
      members: {
        where: { userId },
        take: 1,
      },
    },
  });
}

export async function getBrandForWorkspace(
  workspaceId: string,
  brandSlug: string,
) {
  return prisma.brand.findFirst({
    where: {
      workspaceId,
      slug: brandSlug,
      archivedAt: null,
    },
  });
}

export async function createWorkspaceForUser(params: {
  userId: string;
  name: string;
}) {
  const existing = await prisma.workspace.findMany({
    select: { slug: true },
  });
  const slug = uniqueSlug(params.name, existing.map((w) => w.slug));

  return prisma.workspace.create({
    data: {
      name: params.name,
      slug,
      members: {
        create: {
          userId: params.userId,
          role: "OWNER",
        },
      },
    },
  });
}

export async function createBrand(params: {
  workspaceId: string;
  name: string;
  description?: string;
  website?: string;
}) {
  const existing = await prisma.brand.findMany({
    where: { workspaceId: params.workspaceId },
    select: { slug: true },
  });
  const slug = uniqueSlug(params.name, existing.map((b) => b.slug));

  return prisma.brand.create({
    data: {
      workspaceId: params.workspaceId,
      name: params.name.trim(),
      slug,
      description: params.description?.trim() || null,
      website: params.website?.trim() || null,
    },
  });
}
