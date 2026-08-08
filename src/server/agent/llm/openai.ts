import OpenAI from "openai";
import { getAIConfig } from "@/server/ai/config";
import {
  LLMProviderError,
  type LLMChatRequest,
  type LLMChatResult,
  type LLMMessage,
  type LLMProvider,
  type LLMToolCall,
} from "@/server/agent/llm/types";

const DEFAULT_MODEL = process.env.OPENAI_AGENT_MODEL || "gpt-4o-mini";

function toOpenAIMessages(
  messages: LLMMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: m.toolCallId || "",
        content: m.content || "",
      });
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: m.content,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: {
            name: c.name,
            arguments: JSON.stringify(c.arguments ?? {}),
          },
        })),
      });
      continue;
    }
    if (m.role === "system" || m.role === "user" || m.role === "assistant") {
      out.push({
        role: m.role,
        content: m.content || "",
      });
    }
  }
  return out;
}

function parseArgs(raw: string): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { _raw: raw };
  }
}

export class OpenAILLMProvider implements LLMProvider {
  readonly id = "openai";
  private readonly apiKey: string;
  readonly defaultModel: string;

  constructor(
    apiKey: string | undefined = getAIConfig().openaiApiKey,
    defaultModel: string = DEFAULT_MODEL,
  ) {
    this.apiKey = (apiKey || "").trim();
    this.defaultModel = defaultModel;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(req: LLMChatRequest): Promise<LLMChatResult> {
    if (!this.isConfigured()) {
      throw new LLMProviderError(
        "LLM_NOT_CONFIGURED",
        "OpenAI API key is not configured.",
      );
    }

    const client = new OpenAI({ apiKey: this.apiKey });
    const model = req.model || this.defaultModel;

    try {
      const response = await client.chat.completions.create(
        {
          model,
          messages: toOpenAIMessages(req.messages),
          temperature: req.temperature ?? 0.2,
          max_tokens: req.maxTokens ?? 2048,
          tools: req.tools?.map((t) => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })),
          tool_choice: req.tools?.length ? "auto" : undefined,
        },
        { signal: req.signal },
      );

      const choice = response.choices[0];
      if (!choice) {
        throw new LLMProviderError(
          "LLM_INVALID_RESPONSE",
          "OpenAI returned no choices.",
        );
      }

      const toolCalls: LLMToolCall[] = (choice.message.tool_calls || [])
        .filter((c) => c.type === "function")
        .map((c) => ({
          id: c.id,
          name: c.function.name,
          arguments: parseArgs(c.function.arguments || "{}"),
        }));

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: choice.finish_reason || undefined,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        model: response.model || model,
        provider: "openai",
      };
    } catch (err) {
      if (err instanceof LLMProviderError) throw err;
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status?: number }).status)
          : null;
      if (status === 401 || status === 403) {
        throw new LLMProviderError(
          "LLM_AUTH_FAILED",
          "OpenAI authentication failed.",
        );
      }
      if (status === 429) {
        throw new LLMProviderError(
          "LLM_RATE_LIMITED",
          "OpenAI rate limit exceeded.",
        );
      }
      if (
        err instanceof Error &&
        (err.name === "AbortError" || err.name === "TimeoutError")
      ) {
        throw new LLMProviderError("LLM_TIMEOUT", "OpenAI request timed out.");
      }
      throw new LLMProviderError(
        "LLM_REQUEST_FAILED",
        "OpenAI request failed.",
      );
    }
  }
}
