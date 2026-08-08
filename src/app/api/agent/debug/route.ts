import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  AgentError,
  bootstrapAgentTools,
  getDefaultToolRegistry,
  runAgentExecution,
} from "@/server/agent";

const debugBodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  action: z.enum(["echo", "list_tools", "list_agents"]).default("echo"),
  message: z.string().optional(),
});

/**
 * Authenticated debug/test endpoint for Agent Runtime foundation.
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
