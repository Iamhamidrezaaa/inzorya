import type { SocialAnalyticsProvider } from "@/server/social-analytics-ingestion/provider";
import { SocialAnalyticsError } from "@/server/social-analytics-ingestion/types";
import { linkedInAnalyticsProvider } from "@/server/social-analytics-ingestion/providers/linkedin";

const EXPLICITLY_UNAVAILABLE = new Set([
  "meta",
  "facebook",
  "instagram",
  "tiktok",
]);
const REMOVED = new Set(["pinterest"]);

/**
 * Analytics provider registry — reuses the same platform policy as SocialProviderRegistry.
 * Does not invent a second unrelated architecture.
 */
export class SocialAnalyticsProviderRegistry {
  private readonly providers = new Map<string, SocialAnalyticsProvider>();

  registerProvider(provider: SocialAnalyticsProvider): void {
    const id = provider.platform.toLowerCase();
    if (EXPLICITLY_UNAVAILABLE.has(id) || REMOVED.has(id)) {
      throw new SocialAnalyticsError(
        "INVALID_REQUEST",
        `Refusing to register unavailable analytics platform: ${id}`,
      );
    }
    if (this.providers.has(id)) {
      throw new SocialAnalyticsError(
        "INVALID_REQUEST",
        `Analytics provider already registered: ${id}`,
      );
    }
    this.providers.set(id, provider);
  }

  getAnalyticsProvider(platform: string): SocialAnalyticsProvider | null {
    const normalized = platform.toLowerCase();
    if (EXPLICITLY_UNAVAILABLE.has(normalized) || REMOVED.has(normalized)) {
      return null;
    }
    return this.providers.get(normalized) ?? null;
  }

  hasAnalyticsProvider(platform: string): boolean {
    return this.getAnalyticsProvider(platform) != null;
  }

  listAnalyticsProviders(): SocialAnalyticsProvider[] {
    return [...this.providers.values()];
  }

  requireAnalyticsProvider(platform: string): SocialAnalyticsProvider {
    const normalized = platform.toLowerCase();
    if (REMOVED.has(normalized)) {
      throw new SocialAnalyticsError(
        "INVALID_REQUEST",
        "Pinterest is not part of Inzorya.",
        { userMessage: "This platform is not part of Inzorya." },
      );
    }
    if (EXPLICITLY_UNAVAILABLE.has(normalized)) {
      throw new SocialAnalyticsError(
        "CAPABILITY_NOT_AVAILABLE",
        `${normalized} analytics is unavailable.`,
        { userMessage: "This platform's analytics are not available yet." },
      );
    }
    const provider = this.getAnalyticsProvider(normalized);
    if (!provider) {
      throw new SocialAnalyticsError(
        "CAPABILITY_NOT_AVAILABLE",
        `No analytics provider for ${normalized}.`,
      );
    }
    return provider;
  }
}

let defaultRegistry: SocialAnalyticsProviderRegistry | null = null;

export function createDefaultSocialAnalyticsProviderRegistry(): SocialAnalyticsProviderRegistry {
  const registry = new SocialAnalyticsProviderRegistry();
  registry.registerProvider(linkedInAnalyticsProvider);
  return registry;
}

export function getSocialAnalyticsProviderRegistry(): SocialAnalyticsProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultSocialAnalyticsProviderRegistry();
  }
  return defaultRegistry;
}

export function resetSocialAnalyticsProviderRegistry(): void {
  defaultRegistry = null;
}

export function setSocialAnalyticsProviderRegistryForTests(
  registry: SocialAnalyticsProviderRegistry | null,
): void {
  defaultRegistry = registry;
}

export function isAnalyticsPlatformUnavailable(platform: string): boolean {
  return EXPLICITLY_UNAVAILABLE.has(platform.toLowerCase());
}

export function isAnalyticsPlatformRemoved(platform: string): boolean {
  return REMOVED.has(platform.toLowerCase());
}
