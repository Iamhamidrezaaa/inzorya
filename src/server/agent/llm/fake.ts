import {
  type LLMChatRequest,
  type LLMChatResult,
  type LLMProvider,
  type LLMToolCall,
} from "@/server/agent/llm/types";

export type FakeLLMStep =
  | {
      type: "tool_calls";
      calls: Array<{ name: string; arguments?: Record<string, unknown> }>;
    }
  | { type: "message"; content: string };

/**
 * Deterministic LLM for Agent loop tests — no live OpenAI.
 */
export class FakeLLMProvider implements LLMProvider {
  readonly id = "fake";
  private stepIndex = 0;

  constructor(private readonly steps: FakeLLMStep[]) {}

  isConfigured(): boolean {
    return true;
  }

  reset(): void {
    this.stepIndex = 0;
  }

  async chat(req: LLMChatRequest): Promise<LLMChatResult> {
    const step = this.steps[this.stepIndex] ?? {
      type: "message" as const,
      content: "No further steps configured.",
    };
    this.stepIndex += 1;

    if (step.type === "tool_calls") {
      const toolCalls: LLMToolCall[] = step.calls.map((c, i) => ({
        id: `call_${this.stepIndex}_${i}`,
        name: c.name,
        arguments: c.arguments ?? {},
      }));
      return {
        content: null,
        toolCalls,
        finishReason: "tool_calls",
        model: req.model || "fake-model",
        provider: "fake",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    }

    return {
      content: step.content,
      toolCalls: [],
      finishReason: "stop",
      model: req.model || "fake-model",
      provider: "fake",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  }
}
