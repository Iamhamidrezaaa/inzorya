export type ResearchProviderErrorCode =
  | "WEB_SEARCH_PROVIDER_NOT_CONFIGURED"
  | "WEB_SEARCH_PROVIDER_AUTH_FAILED"
  | "WEB_SEARCH_PROVIDER_RATE_LIMITED"
  | "WEB_SEARCH_PROVIDER_TIMEOUT"
  | "WEB_SEARCH_PROVIDER_ERROR"
  | "WEB_SEARCH_PROVIDER_MALFORMED_RESPONSE"
  | "CRAWL_PROVIDER_NOT_CONFIGURED"
  | "CRAWL_PROVIDER_AUTH_FAILED"
  | "CRAWL_PROVIDER_RATE_LIMITED"
  | "CRAWL_PROVIDER_TIMEOUT"
  | "CRAWL_PROVIDER_ERROR"
  | "CRAWL_PROVIDER_MALFORMED_RESPONSE"
  | "CRAWL_URL_NOT_ALLOWED";

export class ResearchProviderError extends Error {
  readonly code: ResearchProviderErrorCode;

  constructor(code: ResearchProviderErrorCode, message: string) {
    super(message);
    this.name = "ResearchProviderError";
    this.code = code;
  }
}

export type WebSearchResultItem = {
  title: string;
  url: string;
  snippet: string | null;
  source: string;
  publishedAt?: string | null;
};

export type WebSearchInput = {
  query: string;
  limit?: number;
  searchDepth?: string;
  /** Optional ISO date (YYYY-MM-DD) — mapped to Tavily start_date when supported. */
  startDate?: string;
  topic?: "general" | "news";
};

export interface WebSearchProvider {
  readonly id: string;
  isConfigured(): boolean;
  search(input: WebSearchInput): Promise<WebSearchResultItem[]>;
}

export type CrawlResult = {
  url: string;
  title: string | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
  source: string;
};

export type CrawlInput = {
  url: string;
};

export interface CrawlProvider {
  readonly id: string;
  isConfigured(): boolean;
  crawl(input: CrawlInput): Promise<CrawlResult>;
}

export const RESEARCH_TIMEOUT_MS = 15_000;
export const MAX_SEARCH_RESULTS = 10;
export const MAX_CRAWL_CONTENT_CHARS = 40_000;
