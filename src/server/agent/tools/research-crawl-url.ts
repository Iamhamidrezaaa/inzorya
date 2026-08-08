import { z } from "zod";
import { AgentError } from "@/server/agent/errors";
import { ResearchProviderError } from "@/server/research";
import { getCrawlProvider } from "@/server/research/registry";
import type { ToolDefinition } from "@/server/agent/types";
import { isValidHttpUrl } from "@/server/agent/tools/research-providers";

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
  source: z.string().optional(),
});

export const researchCrawlUrlTool: ToolDefinition<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "research.crawlUrl",
  name: "Crawl URL",
  description:
    "Inspect a public webpage via Firecrawl when configured. Single-URL only.",
  version: "1.1.0",
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

    const provider = getCrawlProvider();
    if (!provider.isConfigured()) {
      return {
        available: false,
        reason: "CRAWL_PROVIDER_NOT_CONFIGURED",
        url: input.url,
        title: null,
        content: null,
        metadata: null,
      };
    }

    try {
      const page = await provider.crawl({ url: input.url });
      return {
        available: true,
        url: page.url,
        title: page.title,
        content: page.content,
        metadata: page.metadata,
        source: page.source,
      };
    } catch (err) {
      const reason =
        err instanceof ResearchProviderError
          ? err.code
          : "CRAWL_PROVIDER_ERROR";
      return {
        available: false,
        reason,
        url: input.url,
        title: null,
        content: null,
        metadata: null,
      };
    }
  },
};
