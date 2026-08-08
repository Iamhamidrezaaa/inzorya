import type { ToolPermission } from "@/server/agent/types";

const ORDER: ToolPermission[] = ["READ", "WRITE", "EXECUTE", "PUBLISH"];

export function isToolPermission(value: string): value is ToolPermission {
  return (ORDER as string[]).includes(value);
}

/** True when the execution is allowed to invoke a tool with `required`. */
export function hasToolPermission(
  allowed: ToolPermission[],
  required: ToolPermission,
): boolean {
  return allowed.includes(required);
}

export function defaultAllowedPermissions(): ToolPermission[] {
  return ["READ", "WRITE", "EXECUTE"];
}
