import { FirecrawlCrawlProvider } from "@/server/research/firecrawl";
import { TavilyWebSearchProvider } from "@/server/research/tavily";
import type { CrawlProvider, WebSearchProvider } from "@/server/research/types";

let webSearchProvider: WebSearchProvider | null = null;
let crawlProvider: CrawlProvider | null = null;

export function getWebSearchProvider(): WebSearchProvider {
  if (!webSearchProvider) {
    webSearchProvider = new TavilyWebSearchProvider();
  }
  return webSearchProvider;
}

export function getCrawlProvider(): CrawlProvider {
  if (!crawlProvider) {
    crawlProvider = new FirecrawlCrawlProvider();
  }
  return crawlProvider;
}

/** Test-only overrides. */
export function setWebSearchProvider(provider: WebSearchProvider | null): void {
  webSearchProvider = provider;
}

export function setCrawlProvider(provider: CrawlProvider | null): void {
  crawlProvider = provider;
}

export function resetResearchProviders(): void {
  webSearchProvider = null;
  crawlProvider = null;
}
