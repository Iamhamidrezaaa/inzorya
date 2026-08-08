import type { SocialPublisher } from "@/server/publishing/types";
import { PublisherError } from "@/server/publishing/types";
import { linkedInPublisher } from "@/server/publishing/publishers/linkedin";

const EXCLUDED = new Set(["meta", "facebook", "instagram", "tiktok", "pinterest"]);

export class SocialPublisherRegistry {
  private readonly publishers = new Map<string, SocialPublisher>();

  register(publisher: SocialPublisher): void {
    const id = publisher.platform.toLowerCase();
    if (EXCLUDED.has(id)) {
      throw new PublisherError(
        "PLATFORM_UNAVAILABLE",
        `Refusing to register publisher for ${id}`,
      );
    }
    this.publishers.set(id, publisher);
  }

  get(platform: string): SocialPublisher | null {
    return this.publishers.get(platform.toLowerCase()) ?? null;
  }

  has(platform: string): boolean {
    return this.publishers.has(platform.toLowerCase());
  }

  list(): SocialPublisher[] {
    return [...this.publishers.values()];
  }

  require(platform: string): SocialPublisher {
    const normalized = platform.toLowerCase();
    if (normalized === "pinterest") {
      throw new PublisherError(
        "PLATFORM_UNAVAILABLE",
        "Pinterest is not part of Inzorya.",
        { userMessage: "This platform is not part of Inzorya." },
      );
    }
    if (
      normalized === "meta" ||
      normalized === "facebook" ||
      normalized === "instagram" ||
      normalized === "tiktok"
    ) {
      throw new PublisherError(
        "PLATFORM_UNAVAILABLE",
        `${normalized} publishing is unavailable.`,
        { userMessage: "This platform is coming later." },
      );
    }
    const publisher = this.get(normalized);
    if (!publisher) {
      throw new PublisherError(
        "UNSUPPORTED_CAPABILITY",
        `No publisher for ${normalized}`,
      );
    }
    return publisher;
  }
}

let defaultRegistry: SocialPublisherRegistry | null = null;

export function createDefaultPublisherRegistry(): SocialPublisherRegistry {
  const registry = new SocialPublisherRegistry();
  registry.register(linkedInPublisher);
  return registry;
}

export function getSocialPublisherRegistry(): SocialPublisherRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultPublisherRegistry();
  }
  return defaultRegistry;
}

export function resetSocialPublisherRegistry(): void {
  defaultRegistry = null;
}

export function setSocialPublisherRegistryForTests(
  registry: SocialPublisherRegistry | null,
): void {
  defaultRegistry = registry;
}
