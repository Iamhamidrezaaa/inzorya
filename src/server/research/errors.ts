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
  if (kind === "network") {
    return new ResearchProviderError(
      "WEB_SEARCH_PROVIDER_REQUEST_FAILED",
      "Web search network connectivity failed.",
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
      "Web search authentication or authorization failed.",
    );
  }
  if (status === 429) {
    return new ResearchProviderError(
      "WEB_SEARCH_PROVIDER_RATE_LIMITED",
      "Web search rate limit exceeded.",
    );
  }
  if (status != null && status >= 500) {
    return new ResearchProviderError(
      "WEB_SEARCH_PROVIDER_REQUEST_FAILED",
      "Web search provider returned a server error.",
    );
  }
  return new ResearchProviderError(
    "WEB_SEARCH_PROVIDER_REQUEST_FAILED",
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
  if (kind === "network") {
    return new ResearchProviderError(
      "CRAWL_PROVIDER_REQUEST_FAILED",
      "Crawl network connectivity failed.",
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
      "Crawl authentication or authorization failed.",
    );
  }
  if (status === 429) {
    return new ResearchProviderError(
      "CRAWL_PROVIDER_RATE_LIMITED",
      "Crawl rate limit exceeded.",
    );
  }
  if (status != null && status >= 500) {
    return new ResearchProviderError(
      "CRAWL_PROVIDER_REQUEST_FAILED",
      "Crawl provider returned a server error.",
    );
  }
  return new ResearchProviderError(
    "CRAWL_PROVIDER_REQUEST_FAILED",
    "Crawl provider request failed.",
  );
}

export function asProviderUnavailable(
  code: ResearchProviderErrorCode,
): { available: false; reason: string } {
  return { available: false, reason: code };
}
