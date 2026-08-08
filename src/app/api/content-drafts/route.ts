import { NextResponse } from "next/server";
import { z } from "zod";
import { ContentDraftStatus } from "@prisma/client";
import { requireBrandAccess, requireUser } from "@/server/access";
import { contentWorkspace } from "@/server/content-workspace";
import { contentAssetSchema } from "@/server/agent/content-creator/output";
import { contentWorkspaceErrorResponse } from "@/server/content-workspace/http";

const createSchema = z.object({
  workspaceSlug: z.string().min(1),
  brandSlug: z.string().min(1),
  asset: contentAssetSchema,
  sourceAgentExecutionId: z.string().optional().nullable(),
  blueprintReference: z
    .object({
      blueprintId: z.string().optional(),
      planItemId: z.string().optional(),
      summary: z.string().optional(),
      strategySummary: z.string().optional(),
      primaryObjective: z.string().optional(),
    })
    .optional()
    .nullable(),
  evidence: z
    .array(
      z.object({
        type: z.string(),
        reference: z.string().optional(),
        summary: z.string(),
      }),
    )
    .optional()
    .nullable(),
  whyNow: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const statusParam = searchParams.get("status");
    let status: ContentDraftStatus | ContentDraftStatus[] | undefined;
    if (statusParam && statusParam !== "ALL") {
      if (statusParam === "needs_review") {
        status = ["IN_REVIEW"];
      } else if (statusParam.includes(",")) {
        status = statusParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean) as ContentDraftStatus[];
      } else {
        status = statusParam as ContentDraftStatus;
      }
    }

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const drafts = await contentWorkspace.list({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      status,
      channel: searchParams.get("channel") || undefined,
      format: searchParams.get("format") || undefined,
      objective: searchParams.get("objective") || undefined,
      q: searchParams.get("q")?.trim() || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return NextResponse.json({ drafts });
  } catch (error) {
    return contentWorkspaceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid creator output.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const access = await requireBrandAccess(
      parsed.data.workspaceSlug,
      parsed.data.brandSlug,
      user.id!,
    );
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const draft = await contentWorkspace.createFromCreatorOutput({
      workspaceId: access.workspace.id,
      brandId: access.brand.id,
      createdById: user.id!,
      asset: parsed.data.asset,
      sourceAgentExecutionId: parsed.data.sourceAgentExecutionId,
      blueprintReference: parsed.data.blueprintReference,
      evidence: parsed.data.evidence,
      whyNow: parsed.data.whyNow,
    });

    return NextResponse.json({ ok: true, draft }, { status: 201 });
  } catch (error) {
    return contentWorkspaceErrorResponse(error);
  }
}
