/**
 * Research provider status for Agent tools.
 * ENV placeholders alone are not enough — no SDK/client is wired in the app.
 */

export type ProviderUsability = {
  usable: boolean;
  reason: string;
};

export function getResearchProviderStatus(): {
  firecrawl: ProviderUsability;
  tavily: ProviderUsability;
  exa: ProviderUsability;
  apify: ProviderUsability;
  semrush: ProviderUsability;
} {
  return {
    firecrawl: {
      usable: false,
      reason: "NOT_IMPLEMENTED",
    },
    tavily: {
      usable: false,
      reason: "NOT_IMPLEMENTED",
    },
    exa: {
      usable: false,
      reason: "PROVIDER_MISSING",
    },
    apify: {
      usable: false,
      reason: "PROVIDER_MISSING",
    },
    semrush: {
      usable: false,
      reason: "PROVIDER_MISSING",
    },
  };
}

export function webSearchAvailability(): {
  available: false;
  reason: string;
} {
  return {
    available: false,
    reason: "WEB_SEARCH_PROVIDER_NOT_WIRED",
  };
}

export function crawlAvailability(): {
  available: false;
  reason: string;
} {
  return {
    available: false,
    reason: "CRAWL_PROVIDER_NOT_WIRED",
  };
}

export function trendResearchAvailability(): {
  available: false;
  reason: string;
} {
  return {
    available: false,
    reason: "TREND_RESEARCH_PROVIDER_NOT_WIRED",
  };
}

const URL_RE = /^https?:\/\/.+/i;

export function isValidHttpUrl(url: string): boolean {
  if (!URL_RE.test(url.trim())) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
