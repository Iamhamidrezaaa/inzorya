import { mapHttpToCrawlError } from "@/server/research/errors";
import { isTimeoutError } from "@/server/research/http";
import {
  MAX_CRAWL_CONTENT_CHARS,
  RESEARCH_TIMEOUT_MS,
  ResearchProviderError,
  type CrawlInput,
  type CrawlProvider,
  type CrawlResult,
} from "@/server/research/types";

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";

/** Block obvious SSRF targets before calling the crawl provider. */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ResearchProviderError(
      "CRAWL_URL_NOT_ALLOWED",
      "URL must be a valid http(s) address.",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ResearchProviderError(
      "CRAWL_URL_NOT_ALLOWED",
      "Only http(s) URLs are allowed.",
    );
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === "metadata.google.internal"
  ) {
    throw new ResearchProviderError(
      "CRAWL_URL_NOT_ALLOWED",
      "Private or local network URLs are not allowed.",
    );
  }
  return url;
}

export class FirecrawlCrawlProvider implements CrawlProvider {
  readonly id = "firecrawl";

  constructor(
    private readonly apiKey: string | undefined = process.env.FIRECRAWL_API_KEY,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey?.trim());
  }

  async crawl(input: CrawlInput): Promise<CrawlResult> {
    if (!this.isConfigured()) {
      throw new ResearchProviderError(
        "CRAWL_PROVIDER_NOT_CONFIGURED",
        "Firecrawl API key is not configured.",
      );
    }

    const url = assertPublicHttpUrl(input.url);

    let response: Response;
    try {
      response = await fetch(FIRECRAWL_SCRAPE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url: url.toString(),
          formats: ["markdown"],
          onlyMainContent: true,
        }),
        signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (isTimeoutError(err)) {
        throw mapHttpToCrawlError(null, "abort");
      }
      throw mapHttpToCrawlError(null, "network");
    }

    if (!response.ok) {
      throw mapHttpToCrawlError(response.status, "http");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw mapHttpToCrawlError(null, "parse");
    }

    const root = payload as {
      success?: boolean;
      data?: {
        markdown?: string;
        content?: string;
        metadata?: Record<string, unknown>;
      };
    };

    if (!root || typeof root !== "object" || !root.data) {
      throw mapHttpToCrawlError(null, "parse");
    }

    const data = root.data;
    const markdown =
      typeof data.markdown === "string"
        ? data.markdown
        : typeof data.content === "string"
          ? data.content
          : null;
    const meta =
      data.metadata && typeof data.metadata === "object" ? data.metadata : null;
    const title =
      meta && typeof meta.title === "string"
        ? meta.title
        : meta && typeof meta.ogTitle === "string"
          ? meta.ogTitle
          : null;

    const safeMeta = meta
      ? {
          description:
            typeof meta.description === "string" ? meta.description : null,
          language:
            typeof meta.language === "string" ? meta.language : null,
          sourceURL:
            typeof meta.sourceURL === "string" ? meta.sourceURL : url.toString(),
          statusCode:
            typeof meta.statusCode === "number" ? meta.statusCode : null,
        }
      : null;

    return {
      url: url.toString(),
      title,
      content: markdown
        ? markdown.slice(0, MAX_CRAWL_CONTENT_CHARS)
        : null,
      metadata: safeMeta,
      source: "firecrawl",
    };
  }
}
