/**
 * Live smoke test for Tavily + Firecrawl. Does not print secrets.
 * Run: npx tsx scripts/smoke-research-providers.ts
 */
import { config } from "dotenv";
config({ path: ".env" });

import { FirecrawlCrawlProvider } from "../src/server/research/firecrawl";
import { TavilyWebSearchProvider } from "../src/server/research/tavily";
import { ResearchProviderError } from "../src/server/research/types";

function report(
  provider: string,
  result: "PASS" | "FAIL" | "NOT_RUN",
  details: string,
) {
  console.log(`| ${provider} | ${result} | ${details} |`);
}

async function main() {
  console.log("Provider | Result | Details");
  console.log("---|---|---");

  const tavilyConfigured = Boolean(process.env.TAVILY_API_KEY?.trim());
  const firecrawlConfigured = Boolean(process.env.FIRECRAWL_API_KEY?.trim());

  if (!tavilyConfigured) {
    report("Tavily", "NOT_RUN", "TAVILY_API_KEY missing");
  } else {
    const started = Date.now();
    try {
      const p = new TavilyWebSearchProvider();
      const rows = await p.search({
        query: "latest marketing trends",
        limit: 2,
        searchDepth: "basic",
      });
      const ms = Date.now() - started;
      report(
        "Tavily",
        rows.length > 0 && Boolean(rows[0]?.url) ? "PASS" : "FAIL",
        `results=${rows.length}; latencyMs=${ms}`,
      );
    } catch (err) {
      const ms = Date.now() - started;
      const code =
        err instanceof ResearchProviderError
          ? err.code
          : "WEB_SEARCH_PROVIDER_REQUEST_FAILED";
      report("Tavily", "FAIL", `category=${code}; latencyMs=${ms}`);
    }
  }

  if (!firecrawlConfigured) {
    report("Firecrawl", "NOT_RUN", "FIRECRAWL_API_KEY missing");
  } else {
    const started = Date.now();
    try {
      const p = new FirecrawlCrawlProvider();
      const page = await p.crawl({ url: "https://example.com" });
      const ms = Date.now() - started;
      const ok = Boolean(page.url) && (page.content != null || page.title != null);
      report(
        "Firecrawl",
        ok ? "PASS" : "FAIL",
        `title=${page.title ? "present" : "null"}; contentChars=${page.content?.length ?? 0}; latencyMs=${ms}`,
      );
    } catch (err) {
      const ms = Date.now() - started;
      const code =
        err instanceof ResearchProviderError
          ? err.code
          : "CRAWL_PROVIDER_REQUEST_FAILED";
      const phase =
        code === "CRAWL_PROVIDER_REQUEST_FAILED"
          ? "connect_or_network"
          : code === "CRAWL_PROVIDER_TIMEOUT"
            ? "request_timeout"
            : "http_or_parse";
      report(
        "Firecrawl",
        "FAIL",
        `category=${code}; phase=${phase}; latencyMs=${ms}`,
      );
    }
  }
}

main().catch((e) => {
  console.error("SMOKE_FATAL", e instanceof Error ? e.name : "error");
  process.exit(1);
});
