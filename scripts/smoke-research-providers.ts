/**
 * Live smoke test for Tavily + Firecrawl. Does not print secrets.
 * Run: npx tsx scripts/smoke-research-providers.ts
 */
import { config } from "dotenv";
config({ path: ".env" });

import { FirecrawlCrawlProvider } from "../src/server/research/firecrawl";
import { TavilyWebSearchProvider } from "../src/server/research/tavily";
import { ResearchProviderError } from "../src/server/research/types";

function status(label: string, ok: boolean, detail: string) {
  console.log(`${label}: ${ok ? "PASSED" : "FAILED"} (${detail})`);
}

async function main() {
  const tavilyKey = Boolean(process.env.TAVILY_API_KEY?.trim());
  const firecrawlKey = Boolean(process.env.FIRECRAWL_API_KEY?.trim());
  console.log("Tavily configured:", tavilyKey);
  console.log("Firecrawl configured:", firecrawlKey);

  if (tavilyKey) {
    try {
      const p = new TavilyWebSearchProvider();
      const rows = await p.search({
        query: "exotic fruit marketing trends",
        limit: 2,
        searchDepth: "basic",
      });
      status(
        "Tavily smoke",
        rows.length > 0 && Boolean(rows[0]?.url),
        `results=${rows.length}`,
      );
    } catch (err) {
      const code =
        err instanceof ResearchProviderError ? err.code : "WEB_SEARCH_PROVIDER_ERROR";
      status("Tavily smoke", false, code);
    }
  } else {
    console.log("Tavily smoke: NOT RUN");
  }

  if (firecrawlKey) {
    try {
      const p = new FirecrawlCrawlProvider();
      const page = await p.crawl({ url: "https://example.com" });
      status(
        "Firecrawl smoke",
        Boolean(page.url) && (page.content != null || page.title != null),
        `title=${page.title ? "present" : "null"} contentChars=${page.content?.length ?? 0}`,
      );
    } catch (err) {
      const code =
        err instanceof ResearchProviderError ? err.code : "CRAWL_PROVIDER_ERROR";
      status("Firecrawl smoke", false, code);
    }
  } else {
    console.log("Firecrawl smoke: NOT RUN");
  }
}

main().catch((e) => {
  console.error("SMOKE_FATAL", e instanceof Error ? e.name : "error");
  process.exit(1);
});
