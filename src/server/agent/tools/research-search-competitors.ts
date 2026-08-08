import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ToolDefinition } from "@/server/agent/types";
import {
  clampLimit,
  resolveScopedBrandId,
} from "@/server/agent/tools/scope";
import { webSearchAvailability } from "@/server/agent/tools/research-providers";

const inputSchema = z.object({
  brandId: z.string().min(1).optional(),
  query: z.string().optional(),
  competitors: z.array(z.string().min(1)).optional(),
  limit: z.number().int().positive().optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  webResearch: z.object({
    available: z.boolean(),
    reason: z.string().optional(),
  }),
  competitors: z.array(
    z.object({
      name: z.string(),
      url: z.string().nullable(),
      instagram: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      informationSource: z.enum(["stored", "requested"]),
      findings: z.array(
        z.object({
          title: z.string(),
          url: z.string().nullable(),
          snippet: z.string().nullable(),
          source: z.string(),
        }),
      ),
    }),
  ),
});

export const researchSearchCompetitorsTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "research.searchCompetitors",
  name: "Search Competitors",
  description:
    "Return stored competitor records from MarketingStrategy/BusinessProfile. Web research only when a provider is wired.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);
    const limit = clampLimit(input.limit, 10, 20);
    const web = webSearchAvailability();

    const [strategy, profile] = await Promise.all([
      prisma.marketingStrategy.findUnique({
        where: { brandId },
        select: {
          competitors: {
            orderBy: { sortOrder: "asc" },
            select: {
              name: true,
              website: true,
              instagram: true,
              notes: true,
            },
            take: limit,
          },
        },
      }),
      prisma.businessProfile.findUnique({
        where: { brandId },
        select: { competitors: true },
      }),
    ]);

    const byName = new Map<
      string,
      {
        name: string;
        url: string | null;
        instagram: string | null;
        notes: string | null;
        informationSource: "stored" | "requested";
        findings: {
          title: string;
          url: string | null;
          snippet: string | null;
          source: string;
        }[];
      }
    >();

    for (const c of strategy?.competitors ?? []) {
      byName.set(c.name.toLowerCase(), {
        name: c.name,
        url: c.website,
        instagram: c.instagram,
        notes: c.notes,
        informationSource: "stored",
        findings: [],
      });
    }

    // Profile.competitors is free text — expose as a single stored note if present.
    if (profile?.competitors?.trim() && byName.size === 0) {
      byName.set("__profile__", {
        name: "Stored competitor notes",
        url: null,
        instagram: null,
        notes: profile.competitors.trim(),
        informationSource: "stored",
        findings: [
          {
            title: "Business profile competitors field",
            url: null,
            snippet: profile.competitors.trim().slice(0, 500),
            source: "stored_business_profile",
          },
        ],
      });
    }

    for (const name of input.competitors ?? []) {
      const key = name.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, {
          name,
          url: null,
          instagram: null,
          notes: null,
          informationSource: "requested",
          findings: [],
        });
      }
    }

    // Optional query filters stored names (no fabricated web hits).
    let list = Array.from(byName.values());
    if (input.query?.trim()) {
      const q = input.query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.notes?.toLowerCase().includes(q) ?? false),
      );
    }
    list = list.slice(0, limit);

    if (list.length === 0) {
      return {
        available: false,
        reason: web.available
          ? "NO_COMPETITORS_FOUND"
          : "NO_STORED_COMPETITORS_AND_NO_RESEARCH_PROVIDER",
        webResearch: { available: false, reason: web.reason },
        competitors: [],
      };
    }

    return {
      available: true,
      webResearch: { available: false, reason: web.reason },
      competitors: list,
    };
  },
};
