/**
 * Verify research Tools propagate provider results (mocked + live if available).
 * Does not print secrets.
 */
import { config } from "dotenv";
config({ path: ".env" });

import { bootstrapAgentTools } from "../src/server/agent/bootstrap";
import { executeTool } from "../src/server/agent/tool-executor";
import { ToolRegistry } from "../src/server/agent/tool-registry";
import {
  resetResearchProviders,
  setCrawlProvider,
  setWebSearchProvider,
} from "../src/server/research/registry";
import { FirecrawlCrawlProvider } from "../src/server/research/firecrawl";
import { TavilyWebSearchProvider } from "../src/server/research/tavily";

const ctx = {
  userId: "smoke",
  workspaceId: "ws",
  brandId: "brand",
  agentExecutionId: "exec",
  allowedPermissions: ["READ" as const],
};

async function run(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`${label}: PASS`);
  } catch (err) {
    console.log(
      `${label}: FAIL`,
      err instanceof Error ? err.message.slice(0, 120) : "error",
    );
  }
}

async function main() {
  resetResearchProviders();
  const registry = bootstrapAgentTools(new ToolRegistry());

  // Contract propagation with mocks (always)
  setWebSearchProvider({
    id: "mock",
    isConfigured: () => true,
    search: async () => [
      {
        title: "Mock",
        url: "https://example.org/a",
        snippet: "s",
        source: "tavily",
      },
    ],
  });
  setCrawlProvider({
    id: "mock",
    isConfigured: () => true,
    crawl: async ({ url }) => ({
      url,
      title: "Example",
      content: "# hi",
      metadata: {},
      source: "firecrawl",
    }),
  });

  await run("research.searchWeb (mock)", async () => {
    const r = await executeTool(registry, {
      toolId: "research.searchWeb",
      input: { query: "latest marketing trends" },
      context: ctx,
    });
    if (!r.success || !(r.data as { available?: boolean }).available) {
      throw new Error(JSON.stringify(r.error || r.data));
    }
  });

  await run("research.crawlUrl (mock)", async () => {
    const r = await executeTool(registry, {
      toolId: "research.crawlUrl",
      input: { url: "https://example.com" },
      context: ctx,
    });
    if (!r.success || !(r.data as { available?: boolean }).available) {
      throw new Error(JSON.stringify(r.error || r.data));
    }
  });

  await run("research.findTrendingTopics (mock)", async () => {
    const r = await executeTool(registry, {
      toolId: "research.findTrendingTopics",
      input: { topic: "marketing" },
      context: ctx,
    });
    if (!r.success || !(r.data as { available?: boolean }).available) {
      throw new Error(JSON.stringify(r.error || r.data));
    }
  });

  // Live providers through Tools (truthful)
  resetResearchProviders();
  setWebSearchProvider(new TavilyWebSearchProvider());
  setCrawlProvider(new FirecrawlCrawlProvider());

  await run("research.searchWeb (live)", async () => {
    const r = await executeTool(registry, {
      toolId: "research.searchWeb",
      input: { query: "latest marketing trends" },
      context: ctx,
    });
    const data = r.data as { available?: boolean; reason?: string };
    if (!r.success) throw new Error(r.error?.code || "tool_failed");
    if (!data.available) throw new Error(data.reason || "unavailable");
  });

  await run("research.crawlUrl (live)", async () => {
    const r = await executeTool(registry, {
      toolId: "research.crawlUrl",
      input: { url: "https://example.com" },
      context: ctx,
    });
    const data = r.data as { available?: boolean; reason?: string };
    if (!r.success) throw new Error(r.error?.code || "tool_failed");
    if (!data.available) throw new Error(data.reason || "unavailable");
  });

  resetResearchProviders();
}

main().catch((e) => {
  console.error("VERIFY_FATAL", e instanceof Error ? e.name : "error");
  process.exit(1);
});
