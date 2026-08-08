import { z } from "zod";
import { AgentError } from "@/server/agent/errors";
import type { ToolDefinition } from "@/server/agent/types";
import {
  crawlAvailability,
  isValidHttpUrl,
} from "@/server/agent/tools/research-providers";

const inputSchema = z.object({
  url: z.string().min(1),
});

const outputSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  url: z.string(),
  title: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const researchCrawlUrlTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "research.crawlUrl",
  name: "Crawl URL",
  description:
    "Inspect a public webpage via the existing Firecrawl integration when wired. No general-purpose scraper.",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  permission: "READ",
  enabled: true,
  async execute(input) {
    if (!isValidHttpUrl(input.url)) {
      throw new AgentError("INVALID_INPUT", "URL must be a valid http(s) URL.", {
        meta: { url: input.url },
      });
    }

    const status = crawlAvailability();
    return {
      available: false,
      reason: status.reason,
      url: input.url,
      title: null,
      content: null,
      metadata: null,
    };
  },
};
