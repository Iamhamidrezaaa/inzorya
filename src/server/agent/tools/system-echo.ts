import { z } from "zod";
import type { ToolDefinition } from "@/server/agent/types";

const echoInputSchema = z.object({
  message: z.string(),
});

const echoOutputSchema = z.object({
  message: z.string(),
});

export type SystemEchoInput = z.infer<typeof echoInputSchema>;
export type SystemEchoOutput = z.infer<typeof echoOutputSchema>;

/** Sole test tool for EPIC AGENT-001. No marketing tools. */
export const systemEchoTool: ToolDefinition<
  SystemEchoInput,
  SystemEchoOutput
> = {
  id: "system.echo",
  name: "System Echo",
  description: "Internal test tool — echoes a message through the Tool Executor.",
  version: "1.0.0",
  inputSchema: echoInputSchema,
  outputSchema: echoOutputSchema,
  permission: "READ",
  enabled: true,
  async execute(input) {
    return { message: input.message };
  },
};
