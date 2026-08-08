import { z } from "zod";
import type { ToolDefinition } from "@/server/agent/types";
import { socialAccounts } from "@/server/social/service";
import { getSocialProviderRegistry } from "@/server/social/registry";
import { assertNoTokenLeak, redactSecrets } from "@/server/social/credentials";

const emptyInput = z.object({});

const accountsOutput = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      platform: z.string(),
      accountName: z.string().nullable(),
      username: z.string().nullable(),
      status: z.string(),
      capabilities: z.record(z.string(), z.boolean()),
    }),
  ),
});

export const socialGetConnectedAccountsTool: ToolDefinition<
  z.infer<typeof emptyInput>,
  z.infer<typeof accountsOutput>
> = {
  id: "social.getConnectedAccounts",
  name: "Get Connected Social Accounts",
  description:
    "Lists connected social accounts for the current brand. Never returns credentials.",
  version: "1.0.0",
  inputSchema: emptyInput,
  outputSchema: accountsOutput,
  permission: "READ",
  enabled: true,
  async execute(_input, ctx) {
    const accounts = await socialAccounts.listAccounts({
      workspaceId: ctx.workspaceId,
      brandId: ctx.brandId,
    });
    const safe = {
      accounts: accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        accountName: a.accountName,
        username: a.username,
        status: a.status,
        capabilities: {
          connect: a.capabilities.connect,
          accountInfo: a.capabilities.accountInfo,
          profile: a.capabilities.profile,
          publishing: a.capabilities.publishing,
          analytics: a.capabilities.analytics,
          mediaUpload: a.capabilities.mediaUpload,
          deleteContent: a.capabilities.deleteContent,
        },
      })),
    };
    assertNoTokenLeak(safe);
    return redactSecrets(safe);
  },
};

const capsInput = z.object({
  accountId: z.string().optional(),
});

const capsOutput = z.object({
  providers: z
    .array(
      z.object({
        platform: z.string(),
        configured: z.boolean(),
        capabilities: z.record(z.string(), z.boolean()),
      }),
    )
    .optional(),
  account: z
    .object({
      platform: z.string(),
      account: z.string(),
      capabilities: z.record(z.string(), z.boolean()),
    })
    .optional(),
});

export const socialGetCapabilitiesTool: ToolDefinition<
  z.infer<typeof capsInput>,
  z.infer<typeof capsOutput>
> = {
  id: "social.getCapabilities",
  name: "Get Social Capabilities",
  description:
    "Returns provider/account capability metadata. Never returns credentials.",
  version: "1.0.0",
  inputSchema: capsInput,
  outputSchema: capsOutput,
  permission: "READ",
  enabled: true,
  async execute(input, ctx) {
    if (input.accountId) {
      const account = await socialAccounts.getCapabilities(input.accountId, {
        workspaceId: ctx.workspaceId,
        brandId: ctx.brandId,
      });
      const safe = { account };
      assertNoTokenLeak(safe);
      return redactSecrets(safe);
    }
    const providers = getSocialProviderRegistry()
      .listProviders()
      .map((p) => {
        const d = p.descriptor();
        return {
          platform: d.platform,
          configured: d.configured,
          capabilities: {
            connect: d.capabilities.connect,
            accountInfo: d.capabilities.accountInfo,
            profile: d.capabilities.profile,
            publishing: d.capabilities.publishing,
            analytics: d.capabilities.analytics,
            mediaUpload: d.capabilities.mediaUpload,
            deleteContent: d.capabilities.deleteContent,
          },
        };
      });
    const safe = { providers };
    assertNoTokenLeak(safe);
    return redactSecrets(safe);
  },
};
