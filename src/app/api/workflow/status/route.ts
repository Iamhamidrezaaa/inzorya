import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandAccess, requireUser } from "@/server/access";
import {
  getWorkflowStatus,
  updateWorkflowStatus,
} from "@/server/services/execution-pipeline";

const scopeSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const id = searchParams.get("id") || searchParams.get("workflowId") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const workflow = await getWorkflowStatus(id, access.brand.id);
    if (!workflow) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ workflow });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to load workflow status." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const scope = scopeSchema.parse(body);
    const access = await requireBrandAccess(
      scope.workspaceSlug,
      scope.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const workflow = await updateWorkflowStatus({
      brandId: access.brand.id,
      userId: user.id!,
      workflowId: String(body.workflowId || body.id || ""),
      status: String(body.status || ""),
      note: body.note,
    });
    if (!workflow) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ workflow });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status update failed." },
      { status: 500 },
    );
  }
}
