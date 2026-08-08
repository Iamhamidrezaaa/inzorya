import {
  getCrawlProvider,
  getWebSearchProvider,
} from "@/server/research/registry";

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
  const tavily = getWebSearchProvider();
  const firecrawl = getCrawlProvider();
  return {
    firecrawl: {
      usable: firecrawl.isConfigured(),
      reason: firecrawl.isConfigured()
        ? "CONFIGURED"
        : "CRAWL_PROVIDER_NOT_CONFIGURED",
    },
    tavily: {
      usable: tavily.isConfigured(),
      reason: tavily.isConfigured()
        ? "CONFIGURED"
        : "WEB_SEARCH_PROVIDER_NOT_CONFIGURED",
    },
    exa: { usable: false, reason: "PROVIDER_MISSING" },
    apify: { usable: false, reason: "PROVIDER_MISSING" },
    semrush: { usable: false, reason: "PROVIDER_MISSING" },
  };
}

export function webSearchAvailability(): {
  available: boolean;
  reason?: string;
} {
  const provider = getWebSearchProvider();
  if (!provider.isConfigured()) {
    return {
      available: false,
      reason: "WEB_SEARCH_PROVIDER_NOT_CONFIGURED",
    };
  }
  return { available: true };
}

export function crawlAvailability(): {
  available: boolean;
  reason?: string;
} {
  const provider = getCrawlProvider();
  if (!provider.isConfigured()) {
    return {
      available: false,
      reason: "CRAWL_PROVIDER_NOT_CONFIGURED",
    };
  }
  return { available: true };
}

export function trendResearchAvailability(): {
  available: boolean;
  reason?: string;
} {
  return webSearchAvailability().available
    ? { available: true }
    : {
        available: false,
        reason: "TREND_RESEARCH_PROVIDER_NOT_CONFIGURED",
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
