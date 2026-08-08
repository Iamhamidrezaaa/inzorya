import { z } from "zod";
import { prisma } from "@/lib/db";
import { ResearchProviderError } from "@/server/research";
import { getWebSearchProvider } from "@/server/research/registry";
import type { ToolDefinition } from "@/server/agent/types";
import {
  clampLimit,
  resolveScopedBrandId,
} from "@/server/agent/tools/scope";

const inputSchema = z.object({
  brandId: z.string().min(1).optional(),
  query: z.string().optional(),
  competitors: z.array(z.string().min(1)).optional(),
  limit: z.number().int().positive().optional(),
});

const findingSchema = z.object({
  title: z.string(),
  url: z.string().nullable(),
  snippet: z.string().nullable(),
  source: z.string(),
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
      stored: z.boolean(),
      informationSource: z.enum(["stored", "requested"]),
      findings: z.array(findingSchema),
      webFindings: z.array(findingSchema),
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
    "Combine stored competitor records with optional Tavily public web research.",
  version: "1.1.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    const brandId = await resolveScopedBrandId(ctx, input.brandId);
    const limit = clampLimit(input.limit, 5, 10);
    const provider = getWebSearchProvider();
    const webConfigured = provider.isConfigured();

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
        select: {
          competitors: true,
          industry: true,
          businessSummary: true,
        },
      }),
    ]);

    type Comp = {
      name: string;
      url: string | null;
      instagram: string | null;
      notes: string | null;
      stored: boolean;
      informationSource: "stored" | "requested";
      findings: {
        title: string;
        url: string | null;
        snippet: string | null;
        source: string;
      }[];
      webFindings: {
        title: string;
        url: string | null;
        snippet: string | null;
        source: string;
      }[];
    };

    const byName = new Map<string, Comp>();

    for (const c of strategy?.competitors ?? []) {
      byName.set(c.name.toLowerCase(), {
        name: c.name,
        url: c.website,
        instagram: c.instagram,
        notes: c.notes,
        stored: true,
        informationSource: "stored",
        findings: [],
        webFindings: [],
      });
    }

    if (profile?.competitors?.trim() && byName.size === 0) {
      byName.set("__profile__", {
        name: "Stored competitor notes",
        url: null,
        instagram: null,
        notes: profile.competitors.trim(),
        stored: true,
        informationSource: "stored",
        findings: [
          {
            title: "Business profile competitors field",
            url: null,
            snippet: profile.competitors.trim().slice(0, 500),
            source: "stored_business_profile",
          },
        ],
        webFindings: [],
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
          stored: false,
          informationSource: "requested",
          findings: [],
          webFindings: [],
        });
      }
    }

    let list = Array.from(byName.values());

    // No stored/requested names: optional query-only discovery via web search.
    if (list.length === 0 && input.query?.trim() && webConfigured) {
      try {
        const industryHint = profile?.industry
          ? ` in ${profile.industry}`
          : "";
        const q = `${input.query.trim()} competitors${industryHint}`.slice(
          0,
          400,
        );
        const hits = await provider.search({
          query: q,
          limit: Math.min(limit, 5),
          searchDepth: "basic",
        });
        return {
          available: true,
          webResearch: { available: true },
          competitors: [
            {
              name: input.query.trim(),
              url: null,
              instagram: null,
              notes: null,
              stored: false,
              informationSource: "requested" as const,
              findings: [],
              webFindings: hits.map((h) => ({
                title: h.title,
                url: h.url,
                snippet: h.snippet,
                source: h.source,
              })),
            },
          ],
        };
      } catch (err) {
        const reason =
          err instanceof ResearchProviderError
            ? err.code
            : "WEB_SEARCH_PROVIDER_ERROR";
        return {
          available: false,
          reason,
          webResearch: { available: false, reason },
          competitors: [],
        };
      }
    }

    if (list.length === 0) {
      return {
        available: false,
        reason: webConfigured
          ? "NO_COMPETITORS_FOUND"
          : "NO_STORED_COMPETITORS_AND_NO_RESEARCH_PROVIDER",
        webResearch: {
          available: false,
          reason: webConfigured
            ? "NO_COMPETITORS_FOUND"
            : "WEB_SEARCH_PROVIDER_NOT_CONFIGURED",
        },
        competitors: [],
      };
    }

    if (input.query?.trim()) {
      const q = input.query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.notes?.toLowerCase().includes(q) ?? false),
      );
    }
    list = list.slice(0, limit);

    let webReason: string | undefined;
    let webOk = webConfigured;

    if (webConfigured) {
      const industryHint = profile?.industry ? ` ${profile.industry}` : "";
      // Cap expensive calls: max 5 competitor lookups, 3 findings each.
      const toResearch = list
        .filter((c) => c.name !== "Stored competitor notes")
        .slice(0, 5);

      for (const comp of toResearch) {
        try {
          const hits = await provider.search({
            query: `"${comp.name}" competitor${industryHint}`.slice(0, 400),
            limit: 3,
            searchDepth: "basic",
          });
          comp.webFindings = hits.map((h) => ({
            title: h.title,
            url: h.url,
            snippet: h.snippet,
            source: h.source,
          }));
        } catch (err) {
          webOk = false;
          webReason =
            err instanceof ResearchProviderError
              ? err.code
              : "WEB_SEARCH_PROVIDER_ERROR";
          break;
        }
      }
    } else {
      webReason = "WEB_SEARCH_PROVIDER_NOT_CONFIGURED";
    }

    return {
      available: true,
      webResearch: {
        available: webOk,
        ...(webReason ? { reason: webReason } : {}),
      },
      competitors: list,
    };
  },
};
