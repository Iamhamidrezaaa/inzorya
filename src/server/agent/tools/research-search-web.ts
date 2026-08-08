import { z } from "zod";
import type { ToolDefinition } from "@/server/agent/types";
import { clampLimit } from "@/server/agent/tools/scope";
import { webSearchAvailability } from "@/server/agent/tools/research-providers";

const inputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
  searchDepth: z.string().optional(),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  query: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string().nullable(),
      source: z.string().nullable(),
    }),
  ),
});

export const researchSearchWebTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "research.searchWeb",
  name: "Web Search",
  description:
    "Provider-agnostic web search for Agents. Returns unavailable until a research provider is wired.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input) {
    const limit = clampLimit(input.limit, 5, 20);
    const status = webSearchAvailability();
    // searchDepth reserved for future providers; unused while unwired.
    void input.searchDepth;
    void limit;
    return {
      available: false,
      reason: status.reason,
      query: input.query,
      results: [],
    };
  },
};
