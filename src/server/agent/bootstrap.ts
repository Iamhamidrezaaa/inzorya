import {
  getDefaultToolRegistry,
  type ToolRegistry,
} from "@/server/agent/tool-registry";
import { systemEchoTool } from "@/server/agent/tools/system-echo";

let bootstrapped = false;

/** Registers foundation tools once on the default (or provided) registry. */
export function bootstrapAgentTools(registry?: ToolRegistry): ToolRegistry {
  const target = registry ?? getDefaultToolRegistry();
  if (!registry) {
    if (bootstrapped) return target;
    bootstrapped = true;
  }
  if (!target.hasTool(systemEchoTool.id)) {
    target.registerTool(systemEchoTool);
  }
  return target;
}

/** Tests only. */
export function resetAgentBootstrap(): void {
  bootstrapped = false;
}
