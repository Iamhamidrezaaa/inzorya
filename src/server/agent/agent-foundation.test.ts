import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AgentError,
  AgentRegistry,
  ToolRegistry,
  bootstrapAgentTools,
  createMemoryAgentRuntimeStore,
  executeTool,
  hasToolPermission,
  resetAgentBootstrap,
  resetDefaultToolRegistry,
  runAgentExecution,
  systemEchoTool,
} from "@/server/agent";
import type { ToolContext, ToolDefinition } from "@/server/agent/types";

function baseContext(
  overrides: Partial<ToolContext> = {},
): ToolContext {
  return {
    userId: "user_1",
    workspaceId: "ws_1",
    brandId: "brand_1",
    agentExecutionId: "exec_1",
    allowedPermissions: ["READ", "WRITE", "EXECUTE"],
    ...overrides,
  };
}

function makeFailTool(): ToolDefinition {
  return {
    id: "system.fail",
    name: "Fail",
    description: "Always throws",
    version: "1.0.0",
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    permission: "EXECUTE",
    enabled: true,
    async execute() {
      throw new Error("secret internal stack");
    },
  };
}

function makeWriteTool(): ToolDefinition {
  return {
    id: "system.write",
    name: "Write",
    description: "Write-permission tool",
    version: "1.0.0",
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    permission: "WRITE",
    enabled: true,
    async execute(input) {
      return input;
    },
  };
}

describe("Agent foundation — Tool Registry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.registerTool(systemEchoTool);
  });

  it("registers and looks up tools", () => {
    expect(registry.hasTool("system.echo")).toBe(true);
    expect(registry.getTool("system.echo")?.name).toBe("System Echo");
    expect(registry.listTools()).toHaveLength(1);
  });

  it("prevents duplicate tool registration", () => {
    expect(() => registry.registerTool(systemEchoTool)).toThrow(AgentError);
    try {
      registry.registerTool(systemEchoTool);
    } catch (err) {
      expect(err).toBeInstanceOf(AgentError);
      expect((err as AgentError).code).toBe("TOOL_ALREADY_REGISTERED");
    }
  });
});

describe("Agent foundation — Tool Executor", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.registerTool(systemEchoTool);
  });

  it("executes valid tool input and returns structured success", async () => {
    const result = await registry.executeTool(
      "system.echo",
      { message: "hello Inzorya" },
      baseContext(),
    );
    expect(result.success).toBe(true);
    expect(result.tool).toBe("system.echo");
    expect(result.data).toEqual({ message: "hello Inzorya" });
  });

  it("rejects invalid input", async () => {
    const result = await executeTool(registry, {
      toolId: "system.echo",
      input: { message: 123 },
      context: baseContext(),
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_INPUT");
  });

  it("handles tool failures without exposing raw exceptions", async () => {
    registry.registerTool(makeFailTool());
    const result = await registry.executeTool("system.fail", {}, baseContext());
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INTERNAL");
    expect(result.error?.message).toBe("Tool execution failed.");
    expect(JSON.stringify(result)).not.toContain("secret internal stack");
  });

  it("rejects when permission is not granted", async () => {
    registry.registerTool(makeWriteTool());
    const result = await registry.executeTool(
      "system.write",
      { value: "x" },
      baseContext({ allowedPermissions: ["READ"] }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("PERMISSION_DENIED");
  });

  it("rejects incomplete workspace/brand scoping", async () => {
    const result = await registry.executeTool(
      "system.echo",
      { message: "x" },
      baseContext({ brandId: "" }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("SCOPE_VIOLATION");
  });
});

describe("Agent foundation — permissions helper", () => {
  it("distinguishes READ vs WRITE", () => {
    expect(hasToolPermission(["READ"], "READ")).toBe(true);
    expect(hasToolPermission(["READ"], "WRITE")).toBe(false);
    expect(hasToolPermission(["READ", "WRITE"], "WRITE")).toBe(true);
  });
});

describe("Agent foundation — execution lifecycle + logging", () => {
  beforeEach(() => {
    resetDefaultToolRegistry();
    resetAgentBootstrap();
  });

  afterEach(() => {
    resetDefaultToolRegistry();
    resetAgentBootstrap();
  });

  it("runs system.test → system.echo end-to-end with execution log", async () => {
    const store = createMemoryAgentRuntimeStore();
    const registry = bootstrapAgentTools(new ToolRegistry());

    const outcome = await runAgentExecution({
      agentId: "system.test",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      input: { message: "foundation-ok" },
      toolRegistry: registry,
      agentRegistry: new AgentRegistry(),
      store,
    });

    expect(outcome.status).toBe("COMPLETED");
    expect(outcome.toolResults).toHaveLength(1);
    expect(outcome.toolResults[0]?.success).toBe(true);
    expect(outcome.toolResults[0]?.data).toEqual({ message: "foundation-ok" });
    expect(outcome.toolResults[0]?.tool).toBe("system.echo");

    const exec = store.executions.get(outcome.executionId);
    expect(exec?.status).toBe("COMPLETED");
    expect(exec?.agentId).toBe("system.test");
    expect(exec?.userId).toBe("user_1");
    expect(exec?.workspaceId).toBe("ws_1");
    expect(exec?.brandId).toBe("brand_1");

    const tools = store.toolExecutions.get(outcome.executionId) ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0]?.toolId).toBe("system.echo");
    expect(tools[0]?.sequence).toBe(1);
    expect(tools[0]?.status).toBe("COMPLETED");
    expect(typeof tools[0]?.durationMs).toBe("number");
  });

  it("records failed tool execution in the log", async () => {
    const store = createMemoryAgentRuntimeStore();
    const registry = new ToolRegistry();
    registry.registerTool(makeFailTool());
    const agents = new AgentRegistry([
      {
        id: "system.test",
        name: "System Test Agent",
        version: "1.0.0",
        description: "test",
      },
    ]);

    const outcome = await runAgentExecution({
      agentId: "system.test",
      userId: "user_1",
      workspaceId: "ws_1",
      brandId: "brand_1",
      input: { toolCalls: [{ toolId: "system.fail", input: {} }] },
      toolRegistry: registry,
      agentRegistry: agents,
      store,
    });

    expect(outcome.status).toBe("FAILED");
    const tools = store.toolExecutions.get(outcome.executionId) ?? [];
    expect(tools[0]?.status).toBe("FAILED");
    expect(tools[0]?.errorCode).toBe("INTERNAL");
  });

  it("requires scoped ids for agent execution", async () => {
    await expect(
      runAgentExecution({
        agentId: "system.test",
        userId: "user_1",
        workspaceId: "",
        brandId: "brand_1",
        store: createMemoryAgentRuntimeStore(),
      }),
    ).rejects.toMatchObject({ code: "SCOPE_VIOLATION" });
  });
});
