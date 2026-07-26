import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import { createPipelineTasks } from "@/server/services/execution-pipeline";

const scopeSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  workflowId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = scopeSchema.parse(await request.json());
    const access = await requireBrandAccess(
      body.workspaceSlug,
      body.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const result = await createPipelineTasks({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      userId: user.id!,
      workspaceSlug: body.workspaceSlug,
      brandSlug: body.brandSlug,
      workflowId: body.workflowId,
    });
    if (!result) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task create failed." },
      { status: 500 },
    );
  }
}
