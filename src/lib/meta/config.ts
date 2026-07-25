import type { ChannelPlatform } from "@prisma/client";

export type MetaProduct = "instagram" | "facebook_pages" | "messenger";

export type MetaPermissionDef = {
  scope: string;
  label: string;
  description: string;
  required: boolean;
};

export const META_PRODUCTS: {
  product: MetaProduct;
  platform: ChannelPlatform;
  name: string;
  description: string;
  permissions: MetaPermissionDef[];
}[] = [
  {
    product: "instagram",
    platform: "INSTAGRAM",
    name: "Instagram Business",
    description: "Connect an Instagram Business or Creator account via Meta.",
    permissions: [
      {
        scope: "instagram_basic",
        label: "Basic profile",
        description: "Read Instagram business profile and media metadata.",
        required: true,
      },
      {
        scope: "instagram_manage_messages",
        label: "Manage messages",
        description: "Read and reply to Instagram Direct messages.",
        required: true,
      },
      {
        scope: "instagram_manage_comments",
        label: "Manage comments",
        description: "Read and manage comments on your media.",
        required: false,
      },
      {
        scope: "pages_show_list",
        label: "Pages list",
        description: "List Facebook Pages linked to Instagram.",
        required: true,
      },
    ],
  },
  {
    product: "facebook_pages",
    platform: "FACEBOOK",
    name: "Facebook Pages",
    description: "Connect a Facebook Page you manage.",
    permissions: [
      {
        scope: "pages_show_list",
        label: "Pages list",
        description: "List Pages you administer.",
        required: true,
      },
      {
        scope: "pages_read_engagement",
        label: "Read engagement",
        description: "Read Page posts and engagement metrics.",
        required: false,
      },
      {
        scope: "pages_manage_metadata",
        label: "Manage metadata",
        description: "Manage Page settings and webhooks.",
        required: true,
      },
    ],
  },
  {
    product: "messenger",
    platform: "FACEBOOK",
    name: "Messenger",
    description: "Messenger conversations for a connected Facebook Page.",
    permissions: [
      {
        scope: "pages_messaging",
        label: "Page messaging",
        description: "Send and receive Messenger conversations.",
        required: true,
      },
      {
        scope: "pages_show_list",
        label: "Pages list",
        description: "Select the Page used for Messenger.",
        required: true,
      },
    ],
  },
];

export function getMetaProduct(product: string) {
  return META_PRODUCTS.find((p) => p.product === product);
}

export function getMetaConfig() {
  const appId = process.env.META_APP_ID || "";
  const appSecret = process.env.META_APP_SECRET || "";
  const apiVersion = process.env.META_GRAPH_API_VERSION || "v21.0";
  const redirectUri =
    process.env.META_OAUTH_REDIRECT_URI ||
    `${process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/integrations/meta/callback`;
  const apiEnabled = process.env.META_API_ENABLED === "true";
  const sandbox = process.env.META_OAUTH_SANDBOX !== "false";
  const configured = Boolean(appId && appSecret);

  return {
    appId,
    appSecretConfigured: Boolean(appSecret),
    apiVersion,
    redirectUri,
    apiEnabled,
    sandbox,
    configured,
    graphBaseUrl: `https://graph.facebook.com/${apiVersion}`,
    oauthDialogUrl: `https://www.facebook.com/${apiVersion}/dialog/oauth`,
  };
}

export function buildMetaAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  apiVersion?: string;
}) {
  const version = input.apiVersion || "v21.0";
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.scopes.join(","));
  return url.toString();
}

/** Interface-only Graph client — no network calls until META_API_ENABLED=true. */
export type MetaTokenExchangeResult = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scopes: string[];
  externalAccountId: string;
  businessName: string;
  username: string;
  profilePictureUrl?: string | null;
};

export interface MetaGraphClient {
  exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<MetaTokenExchangeResult>;
  refreshAccessToken(refreshToken: string): Promise<MetaTokenExchangeResult>;
  revokeToken(accessToken: string): Promise<void>;
}

export class MetaGraphClientStub implements MetaGraphClient {
  async exchangeCode(): Promise<MetaTokenExchangeResult> {
    throw new Error(
      "META_API_DISABLED: Token exchange is not enabled. Set META_API_ENABLED=true and provide credentials to call Meta Graph.",
    );
  }
  async refreshAccessToken(): Promise<MetaTokenExchangeResult> {
    throw new Error("META_API_DISABLED: Token refresh is not enabled.");
  }
  async revokeToken(): Promise<void> {
    throw new Error("META_API_DISABLED: Token revocation API call is not enabled.");
  }
}

export function createMetaGraphClient(): MetaGraphClient {
  const config = getMetaConfig();
  if (!config.apiEnabled) return new MetaGraphClientStub();
  // Production Graph client will be wired here when META_API_ENABLED=true.
  return new MetaGraphClientStub();
}
