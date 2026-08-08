import { linkedInProvider } from "@/server/social/providers/linkedin";
import type { SocialPlatformProvider } from "@/server/social/provider";
import { SocialIntegrationError } from "@/server/social/types";

const EXPLICITLY_UNAVAILABLE = new Set([
  "meta",
  "facebook",
  "instagram",
  "tiktok",
]);
const REMOVED = new Set(["pinterest"]);

export class SocialProviderRegistry {
  private readonly providers = new Map<string, SocialPlatformProvider>();

  registerProvider(provider: SocialPlatformProvider): void {
    const id = provider.platform.toLowerCase();
    if (EXPLICITLY_UNAVAILABLE.has(id) || REMOVED.has(id)) {
      throw new SocialIntegrationError(
        "UNSUPPORTED_PLATFORM",
        `Refusing to register unavailable platform: ${id}`,
      );
    }
    if (this.providers.has(id)) {
      throw new SocialIntegrationError(
        "VALIDATION_ERROR",
        `Provider already registered: ${id}`,
      );
    }
    this.providers.set(id, provider);
  }

  getProvider(platform: string): SocialPlatformProvider | null {
    return this.providers.get(platform.toLowerCase()) ?? null;
  }

  hasProvider(platform: string): boolean {
    return this.providers.has(platform.toLowerCase());
  }

  listProviders(): SocialPlatformProvider[] {
    return [...this.providers.values()];
  }

  requireProvider(platform: string): SocialPlatformProvider {
    const normalized = platform.toLowerCase();
    if (REMOVED.has(normalized)) {
      throw new SocialIntegrationError(
        "UNSUPPORTED_PLATFORM",
        "Pinterest is not part of Inzorya.",
        "This platform is not part of Inzorya.",
      );
    }
    if (EXPLICITLY_UNAVAILABLE.has(normalized)) {
      throw new SocialIntegrationError(
        "UNSUPPORTED_PLATFORM",
        `${normalized} is unavailable / postponed.`,
        "This platform is coming later.",
      );
    }
    const provider = this.getProvider(normalized);
    if (!provider) {
      throw new SocialIntegrationError(
        "UNSUPPORTED_PLATFORM",
        `No provider registered for ${normalized}.`,
        "This platform is not available yet.",
      );
    }
    return provider;
  }
}

let defaultRegistry: SocialProviderRegistry | null = null;

export function createDefaultSocialProviderRegistry(): SocialProviderRegistry {
  const registry = new SocialProviderRegistry();
  registry.registerProvider(linkedInProvider);
  return registry;
}

export function getSocialProviderRegistry(): SocialProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultSocialProviderRegistry();
  }
  return defaultRegistry;
}

export function resetSocialProviderRegistry(): void {
  defaultRegistry = null;
}

export function setSocialProviderRegistryForTests(
  registry: SocialProviderRegistry | null,
): void {
  defaultRegistry = registry;
}

export function assertPlatformAllowed(platform: string): void {
  getSocialProviderRegistry().requireProvider(platform);
}
