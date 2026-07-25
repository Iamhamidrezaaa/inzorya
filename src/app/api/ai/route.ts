import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireWorkspaceAccess } from "@/server/access";
import {
  AIPlatformError,
  bootstrapAIPlatform,
  composeContext,
  createPromptVersion,
  getActivePrompt,
  getUsageDashboard,
  listProviderAdapters,
  listQueue,
  rollbackPrompt,
  runAITask,
} from "@/server/ai";
import { ensureAICatalog } from "@/server/ai/routing/router";
import { PLATFORM_TASKS } from "@/server/ai/tasks/registry";

async function scope(workspaceSlug: string, userId: string) {
  const workspace = await requireWorkspaceAccess(workspaceSlug, userId);
  return workspace;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const view = searchParams.get("view") || "overview";
    const workspace = await scope(workspaceSlug, user.id!);
    if (!workspace) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await bootstrapAIPlatform(workspace.id);

    if (view === "usage") {
      const dashboard = await getUsageDashboard(workspace.id);
      return NextResponse.json({ dashboard });
    }

    if (view === "catalog") {
      const [providers, models, tasks, prompts] = await Promise.all([
        prisma.aIProvider.findMany({ orderBy: { priority: "asc" } }),
        prisma.aIModel.findMany({
          include: { provider: true },
          orderBy: { key: "asc" },
        }),
        prisma.aITask.findMany({ orderBy: { category: "asc" } }),
        prisma.prompt.findMany({
          where: { OR: [{ workspaceId: workspace.id }, { workspaceId: null }] },
          include: { versions: { orderBy: { version: "desc" } } },
          orderBy: { key: "asc" },
        }),
      ]);
      const adapters = listProviderAdapters().map((a) => ({
        key: a.key,
        name: a.displayName,
        available: a.isAvailable(),
      }));
      return NextResponse.json({
        providers,
        models,
        tasks,
        prompts,
        adapters,
        taskContracts: PLATFORM_TASKS.map((t) => ({
          key: t.key,
          name: t.name,
          category: t.category,
        })),
      });
    }

    if (view === "queue") {
      const queue = await listQueue(workspace.id);
      return NextResponse.json({ queue });
    }

    if (view === "prompt") {
      const key = searchParams.get("key") || "platform.echo";
      const prompt = await getActivePrompt(key, workspace.id);
      return NextResponse.json({ prompt });
    }

    const dashboard = await getUsageDashboard(workspace.id);
    const adapters = listProviderAdapters().map((a) => ({
      key: a.key,
      name: a.displayName,
      available: a.isAvailable(),
    }));
    return NextResponse.json({
      dashboard,
      adapters,
      config: {
        forceMock: process.env.AI_FORCE_MOCK !== "false",
        enabled: process.env.AI_PLATFORM_ENABLED !== "false",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load AI platform." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const intent = body.intent as string;
    const workspace = await scope(body.workspaceSlug, user.id!);
    if (!workspace) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (intent === "run_task") {
      const parsed = z
        .object({
          taskKey: z.string(),
          brandSlug: z.string().optional(),
          input: z.record(z.string(), z.unknown()).default({}),
          preference: z
            .enum(["cost", "latency", "quality", "balanced"])
            .optional(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid task run." }, { status: 400 });
      }

      let brandId: string | null = null;
      if (parsed.data.brandSlug) {
        const brand = await prisma.brand.findFirst({
          where: {
            workspaceId: workspace.id,
            slug: parsed.data.brandSlug,
            archivedAt: null,
          },
        });
        brandId = brand?.id || null;
      }

      const result = await runAITask({
        workspaceId: workspace.id,
        brandId,
        taskKey: parsed.data.taskKey,
        input: parsed.data.input,
        userId: user.id!,
        preference: parsed.data.preference,
      });
      return NextResponse.json({ ok: true, result });
    }

    if (intent === "inspect_context") {
      const brandSlug = z.string().parse(body.brandSlug);
      const brand = await prisma.brand.findFirst({
        where: { workspaceId: workspace.id, slug: brandSlug, archivedAt: null },
      });
      if (!brand) {
        return NextResponse.json({ error: "Brand not found." }, { status: 404 });
      }
      const composed = await composeContext({
        brandId: brand.id,
        providers: [
          "business_brain",
          "brand_voice",
          "connected_channels",
          "analytics_summary",
          "knowledge_base",
          "content_history",
        ],
        taskKey: "platform.inspect_context",
      });
      return NextResponse.json({ ok: true, composed });
    }

    if (intent === "prompt_version") {
      const parsed = z
        .object({
          promptId: z.string(),
          systemPrompt: z.string().min(1),
          developerPrompt: z.string().optional(),
          variables: z.array(z.string()).optional(),
          changelog: z.string().optional(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid prompt." }, { status: 400 });
      }
      const version = await createPromptVersion(parsed.data);
      return NextResponse.json({ ok: true, version });
    }

    if (intent === "prompt_rollback") {
      const promptId = z.string().parse(body.promptId);
      const version = z.number().int().positive().parse(body.version);
      const prompt = await rollbackPrompt(promptId, version);
      return NextResponse.json({ ok: true, prompt });
    }

    if (intent === "bootstrap") {
      await ensureAICatalog();
      await bootstrapAIPlatform(workspace.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown intent." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof AIPlatformError) {
      return NextResponse.json(
        { error: error.message, code: error.code, meta: error.meta },
        { status: 400 },
      );
    }
    console.error(error);
    return NextResponse.json({ error: "AI platform action failed." }, { status: 500 });
  }
}
