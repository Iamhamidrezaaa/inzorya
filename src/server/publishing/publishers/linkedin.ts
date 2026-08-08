import type {
  NormalizedPublishRequest,
  PublisherPublishResult,
  PublisherValidateResult,
  SocialPublisher,
} from "@/server/publishing/types";
import { PublisherError } from "@/server/publishing/types";

export type LinkedInPublishHttp = {
  createTextPost(input: {
    accessToken: string;
    authorUrn: string;
    text: string;
  }): Promise<{ id: string }>;
};

const MAX_CAPTION = 3000;

function mapStatus(status: number, body: string): never {
  if (status === 401 || status === 403) {
    throw new PublisherError("AUTH_ERROR", `LinkedIn auth ${status}: ${body.slice(0, 200)}`);
  }
  if (status === 429) {
    const retryAfter = Number(/retry.after["\s:]*(\d+)/i.exec(body)?.[1] || 60);
    throw new PublisherError("RATE_LIMIT", `LinkedIn rate limit: ${body.slice(0, 200)}`, {
      retryable: true,
      retryAfterMs: retryAfter * 1000,
    });
  }
  if (status >= 500) {
    throw new PublisherError("PROVIDER_ERROR", `LinkedIn provider ${status}`, {
      retryable: true,
    });
  }
  throw new PublisherError("PROVIDER_ERROR", `LinkedIn error ${status}: ${body.slice(0, 200)}`);
}

export const liveLinkedInPublishHttp: LinkedInPublishHttp = {
  async createTextPost(input) {
    let res: Response;
    try {
      res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: input.authorUrn,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: input.text },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        }),
      });
    } catch (e) {
      throw new PublisherError(
        "NETWORK_ERROR",
        e instanceof Error ? e.message : "LinkedIn network error",
        { retryable: true },
      );
    }
    const text = await res.text();
    if (!res.ok) mapStatus(res.status, text);
    let id =
      res.headers.get("x-restli-id") ||
      res.headers.get("x-linkedin-id") ||
      "";
    if (!id && text) {
      try {
        const json = JSON.parse(text) as { id?: string };
        id = json.id || "";
      } catch {
        /* ignore */
      }
    }
    if (!id) {
      throw new PublisherError(
        "PROVIDER_ERROR",
        "LinkedIn publish response missing post id",
      );
    }
    return { id };
  },
};

const TEXT_FORMATS = new Set([
  "post",
  "static",
  "static_post",
  "text",
  "linkedin_post",
  "article",
  "update",
]);

export function createLinkedInPublisher(
  http: LinkedInPublishHttp = liveLinkedInPublishHttp,
): SocialPublisher {
  return {
    platform: "linkedin",

    supportedFormats() {
      return [...TEXT_FORMATS];
    },

    maxCaptionLength() {
      return MAX_CAPTION;
    },

    mediaRequiredFor(format: string) {
      const f = format.toLowerCase();
      return f === "reel" || f === "video" || f === "carousel";
    },

    async validate(request: NormalizedPublishRequest): Promise<PublisherValidateResult> {
      const errors: PublisherValidateResult["errors"] = [];
      const format = (request.format || "post").toLowerCase();

      if (this.mediaRequiredFor(format)) {
        errors.push({
          code: "UNSUPPORTED_FORMAT",
          message: `LinkedIn media publishing for format "${format}" is not implemented (text-only).`,
        });
      } else if (!TEXT_FORMATS.has(format) && format !== "reel" && format !== "carousel") {
        // unknown formats: allow as text if caption present
      }

      if (!request.content.caption?.trim()) {
        errors.push({
          code: "VALIDATION_ERROR",
          message: "Caption/text is required for LinkedIn text posts.",
        });
      }
      if (request.content.caption.length > MAX_CAPTION) {
        errors.push({
          code: "VALIDATION_ERROR",
          message: `Caption exceeds LinkedIn limit (${MAX_CAPTION}).`,
        });
      }
      if (request.content.media.length > 0) {
        errors.push({
          code: "MEDIA_ERROR",
          message: "LinkedIn media upload is not available in this release (text-only publishing).",
        });
      }
      return { ok: errors.length === 0, errors };
    },

    async publish(
      request: NormalizedPublishRequest,
      ctx: { accessToken: string; platformAccountId: string },
    ): Promise<PublisherPublishResult> {
      const validation = await this.validate(request);
      if (!validation.ok) {
        const first = validation.errors[0]!;
        throw new PublisherError(first.code, first.message);
      }

      const authorUrn = ctx.platformAccountId.startsWith("urn:")
        ? ctx.platformAccountId
        : `urn:li:person:${ctx.platformAccountId}`;

      const created = await http.createTextPost({
        accessToken: ctx.accessToken,
        authorUrn,
        text: request.content.caption.trim(),
      });

      return {
        externalPostId: created.id,
        externalUrl: null,
        publishedAt: new Date(),
        rawStatus: "PUBLISHED",
      };
    },
  };
}

export const linkedInPublisher = createLinkedInPublisher();
