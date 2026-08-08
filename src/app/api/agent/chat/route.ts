import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  AgentError,
  runMarketingReadonlyAgent,
} from "@/server/agent";

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  message: z.string().min(1).max(8_000),
});

/**
 * Authenticated Marketing Intelligence Agent endpoint.
 * Brand scope is always taken from requireBrandAccess — never from LLM.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());
    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const result = await runMarketingReadonlyAgent({
      message: body.message,
      userId: user.id!,
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
    });

    return NextResponse.json({
      success: result.success,
      response: result.response,
      executionId: result.executionId,
      status: result.status,
      rounds: result.rounds,
      error: result.error,
    });
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
      const status =
        err.code === "SCOPE_VIOLATION"
          ? 403
          : err.meta?.code === "LLM_NOT_CONFIGURED"
            ? 503
            : 400;
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Agent chat request failed." },
      { status: 500 },
    );
  }
}
