import { NextResponse } from "next/server";
import { contentWorkspace } from "@/server/content-workspace";
import { contentWorkspaceErrorResponse } from "@/server/content-workspace/http";

/** Explicit rejection — publishing is out of scope for EPIC-013. */
export async function POST() {
  try {
    contentWorkspace.assertNoPublish();
    return NextResponse.json({ error: "Unreachable" }, { status: 500 });
  } catch (error) {
    return contentWorkspaceErrorResponse(error);
  }
}

export async function PUT() {
  return POST();
}
