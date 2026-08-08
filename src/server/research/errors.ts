import {
  ResearchProviderError,
  type ResearchProviderErrorCode,
} from "@/server/research/types";

/** Map HTTP status / abort / network errors to safe provider codes. */
export function mapHttpToSearchError(
  status: number | null,
  kind: "abort" | "network" | "http" | "parse",
): ResearchProviderError {
  if (kind === "abort") {
    return new ResearchProviderError(
      "WEB_SEARCH_PROVIDER_TIMEOUT",
      "Web search timed out.",
    );
  }
  if (kind === "parse") {
    return new ResearchProviderError(
      "WEB_SEARCH_PROVIDER_MALFORMED_RESPONSE",
      "Web search returned a malformed response.",
    );
  }
  if (status === 401 || status === 403) {
    return new ResearchProviderError(
      "WEB_SEARCH_PROVIDER_AUTH_FAILED",
      "Web search authentication failed.",
    );
  }
  if (status === 429) {
    return new ResearchProviderError(
      "WEB_SEARCH_PROVIDER_RATE_LIMITED",
      "Web search rate limit exceeded.",
    );
  }
  return new ResearchProviderError(
    "WEB_SEARCH_PROVIDER_ERROR",
    "Web search provider request failed.",
  );
}

export function mapHttpToCrawlError(
  status: number | null,
  kind: "abort" | "network" | "http" | "parse",
): ResearchProviderError {
  if (kind === "abort") {
    return new ResearchProviderError(
      "CRAWL_PROVIDER_TIMEOUT",
      "Crawl timed out.",
    );
  }
  if (kind === "parse") {
    return new ResearchProviderError(
      "CRAWL_PROVIDER_MALFORMED_RESPONSE",
      "Crawl returned a malformed response.",
    );
  }
  if (status === 401 || status === 403) {
    return new ResearchProviderError(
      "CRAWL_PROVIDER_AUTH_FAILED",
      "Crawl authentication failed.",
    );
  }
  if (status === 429) {
    return new ResearchProviderError(
      "CRAWL_PROVIDER_RATE_LIMITED",
      "Crawl rate limit exceeded.",
    );
  }
  return new ResearchProviderError(
    "CRAWL_PROVIDER_ERROR",
    "Crawl provider request failed.",
  );
}

export function asProviderUnavailable(
  code: ResearchProviderErrorCode,
): { available: false; reason: string } {
  return { available: false, reason: code };
}
