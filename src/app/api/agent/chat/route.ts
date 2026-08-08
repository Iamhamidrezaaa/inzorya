import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { AgentError, runMarketingDirectorAgent } from "@/server/agent";

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  message: z.string().min(1).max(8_000),
  brandId: z.string().min(1).optional(),
});

/**
 * Primary authenticated Agent chat endpoint.
 * Routes to marketing.director — brand scope from requireBrandAccess.
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

    if (body.brandId && body.brandId !== access.brand.id) {
      return NextResponse.json(
        { error: "brandId does not match authenticated brand access." },
        { status: 403 },
      );
    }

    const result = await runMarketingDirectorAgent({
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
      intent: result.intent,
      specialistCalls: result.specialistCalls,
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
