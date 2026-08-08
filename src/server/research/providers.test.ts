import { afterEach, describe, expect, it, vi } from "vitest";
import { FirecrawlCrawlProvider } from "@/server/research/firecrawl";
import { TavilyWebSearchProvider } from "@/server/research/tavily";
import { ResearchProviderError } from "@/server/research/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TavilyWebSearchProvider", () => {
  it("throws NOT_CONFIGURED without key", async () => {
    const p = new TavilyWebSearchProvider("");
    await expect(p.search({ query: "x" })).rejects.toMatchObject({
      code: "WEB_SEARCH_PROVIDER_NOT_CONFIGURED",
    });
  });

  it("normalizes successful search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              title: "A",
              url: "https://a.example",
              content: "hello",
              published_date: "2026-01-01",
            },
          ],
        }),
      }),
    );
    const p = new TavilyWebSearchProvider("tvly-test");
    const rows = await p.search({ query: "fruit", limit: 5 });
    expect(rows).toEqual([
      {
        title: "A",
        url: "https://a.example",
        snippet: "hello",
        source: "tavily",
        publishedAt: "2026-01-01",
      },
    ]);
  });

  it("maps 401 to AUTH_FAILED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    const p = new TavilyWebSearchProvider("bad");
    await expect(p.search({ query: "x" })).rejects.toMatchObject({
      code: "WEB_SEARCH_PROVIDER_AUTH_FAILED",
    });
  });
});

describe("FirecrawlCrawlProvider", () => {
  it("blocks private URLs", async () => {
    const p = new FirecrawlCrawlProvider("fc-test");
    await expect(p.crawl({ url: "http://127.0.0.1/admin" })).rejects.toMatchObject({
      code: "CRAWL_URL_NOT_ALLOWED",
    });
  });

  it("normalizes scrape response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            markdown: "# Hi",
            metadata: {
              title: "Hi",
              description: "d",
              language: "en",
              sourceURL: "https://example.com",
              statusCode: 200,
            },
          },
        }),
      }),
    );
    const p = new FirecrawlCrawlProvider("fc-test");
    const page = await p.crawl({ url: "https://example.com" });
    expect(page).toMatchObject({
      title: "Hi",
      content: "# Hi",
      source: "firecrawl",
    });
  });

  it("maps rate limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );
    const p = new FirecrawlCrawlProvider("fc-test");
    await expect(p.crawl({ url: "https://example.com" })).rejects.toBeInstanceOf(
      ResearchProviderError,
    );
    await expect(p.crawl({ url: "https://example.com" })).rejects.toMatchObject({
      code: "CRAWL_PROVIDER_RATE_LIMITED",
    });
  });
});
