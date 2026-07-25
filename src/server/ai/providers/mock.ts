import type {
  AIProviderAdapter,
  ProviderGenerateRequest,
  ProviderGenerateResult,
  StreamChunk,
} from "@/server/ai/providers/types";
import { AIPlatformError } from "@/server/ai/errors";

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AIPlatformError("CANCELLED", "Request cancelled", { retryable: false }));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new AIPlatformError("CANCELLED", "Request cancelled", { retryable: false }));
    });
  });
}

/** Deterministic mock provider for tests and local platform development. */
export class MockAIProvider implements AIProviderAdapter {
  readonly key = "mock" as const;
  readonly displayName = "Mock Provider";

  isAvailable() {
    return true;
  }

  async generate(req: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    await delay(40 + Math.min(200, JSON.stringify(req.messages).length / 20), req.signal);
    const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
    const inputPreview = (lastUser?.content || "").slice(0, 180);

    if (req.outputFormat === "json") {
      const payload = {
        ok: true,
        provider: "mock",
        model: req.modelKey,
        summary: "Mock structured response — no external AI called.",
        echo: inputPreview,
        suggestions: ["Inspect context", "Compare prompt versions", "Review usage metrics"],
      };
      const content = JSON.stringify(payload, null, 2);
      return {
        content,
        finishReason: "stop",
        promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
        completionTokens: Math.ceil(content.length / 4),
        raw: { mock: true },
      };
    }

    if (req.outputFormat === "markdown") {
      const content = `## Mock response\n\nModel: \`${req.modelKey}\`\n\n> ${inputPreview || "No user input"}\n\n- Provider-agnostic platform check\n- Streaming and retries are simulated\n`;
      return {
        content,
        finishReason: "stop",
        promptTokens: 120,
        completionTokens: 80,
        raw: { mock: true },
      };
    }

    const content = `Mock plain-text response from ${req.modelKey}. Input: ${inputPreview || "(empty)"}`;
    return {
      content,
      finishReason: "stop",
      promptTokens: 80,
      completionTokens: 40,
      raw: { mock: true },
    };
  }

  async *stream(req: ProviderGenerateRequest): AsyncGenerator<StreamChunk> {
    const full = await this.generate(req);
    const parts: string[] = [];
    for (let i = 0; i < full.content.length; i += 24) {
      parts.push(full.content.slice(i, i + 24));
    }
    if (parts.length === 0) parts.push(full.content);
    for (const part of parts) {
      if (req.signal?.aborted) {
        yield { type: "error", error: "cancelled" };
        return;
      }
      await delay(15, req.signal);
      yield { type: "token", text: part };
      yield { type: "partial", text: part };
    }
    yield { type: "done", text: full.content };
  }
}
