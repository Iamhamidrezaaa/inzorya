import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  AgentError,
  bootstrapAgentTools,
  getDefaultToolRegistry,
  runAgentExecution,
  runContentCreatorAgent,
  runContentPlannerAgent,
  runContentStrategistAgent,
  runMarketingDirectorAgent,
  runMarketingReadonlyAgent,
  runSocialAnalyticsAgent,
  runTrendIntelligenceAgent,
  runViralContentAnalystAgent,
} from "@/server/agent";

const debugBodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  action: z
    .enum([
      "echo",
      "list_tools",
      "list_agents",
      "run_tool",
      "run_agent",
      "run_director",
      "list_social_accounts",
      "inspect_capabilities",
      "provider_health",
    ])
    .default("echo"),
  message: z.string().optional(),
  socialAccountId: z.string().optional(),
  agentId: z
    .enum([
      "marketing.readonly",
      "trend.intelligence",
      "viral.content.analyst",
      "content.strategist",
      "content.creator",
      "content.planner",
      "social.analytics",
      "marketing.director",
    ])
    .optional()
    .default("marketing.readonly"),
  toolId: z.string().optional(),
  toolInput: z.record(z.string(), z.unknown()).optional(),
  /** Optional Content Blueprint / plan item for content.creator */
  blueprint: z.record(z.string(), z.unknown()).optional(),
  blueprintItem: z.record(z.string(), z.unknown()).optional(),
});

const ALLOWED_DEBUG_TOOLS = new Set([
  "system.echo",
  "brand.getContext",
  "brand.getStrategy",
  "content.getHistory",
  "calendar.getEvents",
  "opportunity.getRelevant",
  "knowledge.search",
  "analytics.getPerformance",
  "analytics.getTopContent",
  "analytics.compareContentTypes",
  "analytics.getPublishingPatterns",
  "research.searchWeb",
  "research.crawlUrl",
  "research.searchCompetitors",
  "research.findTrendingTopics",
  "social.getConnectedAccounts",
  "social.getCapabilities",
]);

/**
 * Authenticated debug/test endpoint for Agent Runtime + read-only tools.
 * Not a public Agent API — requires session + workspace/brand access.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = debugBodySchema.parse(await request.json());
    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const registry = bootstrapAgentTools(getDefaultToolRegistry());

    if (body.action === "list_social_accounts") {
      const { socialAccounts } = await import("@/server/social/service");
      const { assertNoTokenLeak, redactSecrets } = await import(
        "@/server/social/credentials"
      );
      const accounts = await socialAccounts.listAccounts({
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      });
      const payload = redactSecrets({ accounts });
      assertNoTokenLeak(payload);
      return NextResponse.json(payload);
    }

    if (body.action === "inspect_capabilities") {
      const { socialAccounts } = await import("@/server/social/service");
      const { getSocialProviderRegistry } = await import(
        "@/server/social/registry"
      );
      const { assertNoTokenLeak, redactSecrets } = await import(
        "@/server/social/credentials"
      );
      if (body.socialAccountId) {
        const caps = await socialAccounts.getCapabilities(body.socialAccountId, {
          workspaceId: access.workspace.id,
          brandId: access.brand.id,
        });
        const payload = redactSecrets(caps);
        assertNoTokenLeak(payload);
        return NextResponse.json(payload);
      }
      const providers = getSocialProviderRegistry()
        .listProviders()
        .map((p) => p.descriptor());
      const payload = redactSecrets({ providers });
      assertNoTokenLeak(payload);
      return NextResponse.json(payload);
    }

    if (body.action === "provider_health") {
      const { socialAccounts } = await import("@/server/social/service");
      const { assertNoTokenLeak, redactSecrets } = await import(
        "@/server/social/credentials"
      );
      if (!body.socialAccountId) {
        return NextResponse.json(
          { error: "socialAccountId required" },
          { status: 400 },
        );
      }
      const account = await socialAccounts.syncHealth(body.socialAccountId, {
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      });
      const payload = redactSecrets({ account });
      assertNoTokenLeak(payload);
      return NextResponse.json(payload);
    }

    if (body.action === "list_tools") {
      return NextResponse.json({
        tools: registry.listTools().map((t) => ({
          id: t.id,
          name: t.name,
          version: t.version,
          permission: t.permission,
          enabled: t.enabled,
          description: t.description,
        })),
      });
    }

    if (body.action === "list_agents") {
      const { getDefaultAgentRegistry } = await import("@/server/agent");
      return NextResponse.json({
        agents: getDefaultAgentRegistry().listAgents(),
      });
    }

    if (body.action === "run_tool") {
      const toolId = body.toolId;
      if (!toolId || !ALLOWED_DEBUG_TOOLS.has(toolId)) {
        return NextResponse.json(
          { error: "Tool not allowed for debug execution." },
          { status: 400 },
        );
      }

      const result = await runAgentExecution({
        agentId: "system.test",
        userId: user.id!,
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
        input: {
          toolCalls: [
            {
              toolId,
              input:
                toolId === "system.echo"
                  ? { message: body.message ?? "hello from Inzorya" }
                  : (body.toolInput ?? {}),
            },
          ],
        },
      });

      return NextResponse.json({ result });
    }

    if (body.action === "run_agent") {
      const agentId = body.agentId ?? "marketing.readonly";
      const scope = {
        userId: user.id!,
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      };

      if (agentId === "trend.intelligence") {
        const result = await runTrendIntelligenceAgent({
          message:
            body.message ||
            "برای برند من ترندهای مهم این هفته را پیدا کن.",
          ...scope,
        });
        return NextResponse.json({ result });
      }

      if (agentId === "viral.content.analyst") {
        const result = await runViralContentAnalystAgent({
          message:
            body.message ||
            "محتواهای موفق این حوزه رو بررسی کن.",
          ...scope,
        });
        return NextResponse.json({ result });
      }

      if (agentId === "content.strategist") {
        const result = await runContentStrategistAgent({
          message:
            body.message ||
            "برای هفته آینده اینستاگرامم برنامه بده.",
          ...scope,
        });
        return NextResponse.json({ result });
      }

      if (agentId === "content.creator") {
        const { contentBlueprintSchema, contentPlanItemSchema } = await import(
          "@/server/agent/content-strategist/output"
        );
        const blueprintParsed = body.blueprint
          ? contentBlueprintSchema.safeParse(body.blueprint)
          : null;
        const itemParsed = body.blueprintItem
          ? contentPlanItemSchema.safeParse(body.blueprintItem)
          : null;

        const result = await runContentCreatorAgent({
          message:
            body.message ||
            "این Blueprint را به محتوای قابل تولید تبدیل کن.",
          ...scope,
          blueprint: blueprintParsed?.success
            ? blueprintParsed.data
            : undefined,
          blueprintItem: itemParsed?.success ? itemParsed.data : undefined,
        });
        return NextResponse.json({ result });
      }

      if (agentId === "content.planner") {
        const result = await runContentPlannerAgent({
          message:
            body.message ||
            "برای محتوای READY هفته آینده یک برنامه زمانی داخلی پیشنهاد بده.",
          ...scope,
        });
        return NextResponse.json({ result });
      }

      if (agentId === "social.analytics") {
        const result = await runSocialAnalyticsAgent({
          message:
            body.message ||
            "پیج من این ماه چطور عمل کرده؟",
          ...scope,
        });
        return NextResponse.json({ result });
      }

      if (agentId === "marketing.director") {
        const result = await runMarketingDirectorAgent({
          message:
            body.message ||
            "برای هفته آینده اینستاگرامم برنامه بده.",
          ...scope,
        });
        return NextResponse.json({
          result: {
            success: result.success,
            response: result.response,
            executionId: result.executionId,
            intent: result.intent,
            constraints: result.constraints,
            steps: result.steps,
            specialistCalls: result.specialistCalls,
            final: result.final,
            error: result.error,
          },
        });
      }

      const result = await runMarketingReadonlyAgent({
        message: body.message || "اطلاعات برند من چیست؟",
        ...scope,
      });
      return NextResponse.json({ result });
    }

    if (body.action === "run_director") {
      const result = await runMarketingDirectorAgent({
        message:
          body.message ||
          "برای هفته آینده اینستاگرامم برنامه بده.",
        userId: user.id!,
        workspaceId: access.workspace.id,
        brandId: access.brand.id,
      });
      return NextResponse.json({
        result: {
          success: result.success,
          response: result.response,
          executionId: result.executionId,
          intent: result.intent,
          constraints: result.constraints,
          steps: result.steps,
          specialistCalls: result.specialistCalls,
          final: result.final,
          error: result.error,
        },
      });
    }

    const result = await runAgentExecution({
      agentId: "system.test",
      userId: user.id!,
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      input: { message: body.message ?? "hello from Inzorya agent foundation" },
    });

    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request.", issues: err.issues },
        { status: 400 },
      );
    }
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (err instanceof AgentError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Agent debug request failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    if (!workspaceSlug || !brandSlug) {
      return NextResponse.json(
        { error: "workspaceSlug and brandSlug are required." },
        { status: 400 },
      );
    }
    const access = await requireBrandAccess(
      workspaceSlug,
      brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const registry = bootstrapAgentTools(getDefaultToolRegistry());
    return NextResponse.json({
      ok: true,
      tools: registry.listTools().map((t) => ({
        id: t.id,
        name: t.name,
        permission: t.permission,
        enabled: t.enabled,
      })),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
