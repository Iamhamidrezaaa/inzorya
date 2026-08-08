import { afterEach, describe, expect, it, vi } from "vitest";
import { mapHttpToCrawlError, mapHttpToSearchError } from "@/server/research/errors";
import { FirecrawlCrawlProvider } from "@/server/research/firecrawl";
import {
  isAbortTimeoutError,
  isConnectNetworkError,
  normalizeSecret,
} from "@/server/research/http";
import { TavilyWebSearchProvider } from "@/server/research/tavily";
import { ResearchProviderError } from "@/server/research/types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("research http helpers", () => {
  it("normalizes quoted secrets", () => {
    expect(normalizeSecret('"abc"')).toBe("abc");
    expect(normalizeSecret("'abc'")).toBe("abc");
    expect(normalizeSecret("  abc  ")).toBe("abc");
  });

  it("classifies abort vs connect errors", () => {
    expect(isAbortTimeoutError(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(
      true,
    );
    expect(
      isConnectNetworkError(
        Object.assign(new Error("fetch failed"), {
          cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
        }),
      ),
    ).toBe(true);
  });

  it("maps HTTP categories for search", () => {
    expect(mapHttpToSearchError(401, "http").code).toBe(
      "WEB_SEARCH_PROVIDER_AUTH_FAILED",
    );
    expect(mapHttpToSearchError(403, "http").code).toBe(
      "WEB_SEARCH_PROVIDER_AUTH_FAILED",
    );
    expect(mapHttpToSearchError(429, "http").code).toBe(
      "WEB_SEARCH_PROVIDER_RATE_LIMITED",
    );
    expect(mapHttpToSearchError(500, "http").code).toBe(
      "WEB_SEARCH_PROVIDER_REQUEST_FAILED",
    );
    expect(mapHttpToSearchError(null, "abort").code).toBe(
      "WEB_SEARCH_PROVIDER_TIMEOUT",
    );
    expect(mapHttpToSearchError(null, "network").code).toBe(
      "WEB_SEARCH_PROVIDER_REQUEST_FAILED",
    );
  });

  it("maps HTTP categories for crawl", () => {
    expect(mapHttpToCrawlError(403, "http").code).toBe("CRAWL_PROVIDER_AUTH_FAILED");
    expect(mapHttpToCrawlError(429, "http").code).toBe(
      "CRAWL_PROVIDER_RATE_LIMITED",
    );
    expect(mapHttpToCrawlError(503, "http").code).toBe(
      "CRAWL_PROVIDER_REQUEST_FAILED",
    );
    expect(mapHttpToCrawlError(null, "network").code).toBe(
      "CRAWL_PROVIDER_REQUEST_FAILED",
    );
  });
});

describe("TavilyWebSearchProvider", () => {
  it("throws NOT_CONFIGURED without key", async () => {
    const p = new TavilyWebSearchProvider("");
    await expect(p.search({ query: "x" })).rejects.toMatchObject({
      code: "WEB_SEARCH_PROVIDER_NOT_CONFIGURED",
    });
  });

  it("sends Bearer auth and normalizes response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
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
    });
    vi.stubGlobal("fetch", fetchMock);

    const p = new TavilyWebSearchProvider("tvly-test");
    const rows = await p.search({ query: "fruit", limit: 5 });
    expect(rows[0]?.source).toBe("tavily");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tvly-test");
    expect(JSON.parse(String(init.body)).api_key).toBeUndefined();
  });

  it("maps 401/403/429/500/timeout/malformed", async () => {
    for (const [status, code] of [
      [401, "WEB_SEARCH_PROVIDER_AUTH_FAILED"],
      [403, "WEB_SEARCH_PROVIDER_AUTH_FAILED"],
      [429, "WEB_SEARCH_PROVIDER_RATE_LIMITED"],
      [500, "WEB_SEARCH_PROVIDER_REQUEST_FAILED"],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status }),
      );
      const p = new TavilyWebSearchProvider("k");
      await expect(p.search({ query: "x" })).rejects.toMatchObject({ code });
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
    );
    await expect(
      new TavilyWebSearchProvider("k").search({ query: "x" }),
    ).rejects.toMatchObject({ code: "WEB_SEARCH_PROVIDER_TIMEOUT" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        Object.assign(new Error("fetch failed"), {
          cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
        }),
      ),
    );
    await expect(
      new TavilyWebSearchProvider("k").search({ query: "x" }),
    ).rejects.toMatchObject({ code: "WEB_SEARCH_PROVIDER_REQUEST_FAILED" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: "nope" }),
      }),
    );
    await expect(
      new TavilyWebSearchProvider("k").search({ query: "x" }),
    ).rejects.toMatchObject({
      code: "WEB_SEARCH_PROVIDER_MALFORMED_RESPONSE",
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

  it("throws NOT_CONFIGURED without key", async () => {
    const p = new FirecrawlCrawlProvider("");
    await expect(p.crawl({ url: "https://example.com" })).rejects.toMatchObject({
      code: "CRAWL_PROVIDER_NOT_CONFIGURED",
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

  it("maps 401/403/429/500/connect/timeout/malformed", async () => {
    for (const [status, code] of [
      [401, "CRAWL_PROVIDER_AUTH_FAILED"],
      [403, "CRAWL_PROVIDER_AUTH_FAILED"],
      [429, "CRAWL_PROVIDER_RATE_LIMITED"],
      [500, "CRAWL_PROVIDER_REQUEST_FAILED"],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status }),
      );
      await expect(
        new FirecrawlCrawlProvider("k").crawl({ url: "https://example.com" }),
      ).rejects.toMatchObject({ code });
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        Object.assign(new Error("fetch failed"), {
          cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
        }),
      ),
    );
    await expect(
      new FirecrawlCrawlProvider("k").crawl({ url: "https://example.com" }),
    ).rejects.toMatchObject({ code: "CRAWL_PROVIDER_REQUEST_FAILED" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" })),
    );
    await expect(
      new FirecrawlCrawlProvider("k").crawl({ url: "https://example.com" }),
    ).rejects.toMatchObject({ code: "CRAWL_PROVIDER_TIMEOUT" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );
    await expect(
      new FirecrawlCrawlProvider("k").crawl({ url: "https://example.com" }),
    ).rejects.toBeInstanceOf(ResearchProviderError);
  });
});
