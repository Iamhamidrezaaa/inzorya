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
      const joined = req.messages.map((m) => m.content).join("\n");
      if (joined.includes("strategist.advise")) {
        let question = "your current marketing priorities";
        try {
          const inputMatch = joined.match(/"question"\s*:\s*"([^"]+)"/);
          if (inputMatch?.[1]) question = inputMatch[1];
        } catch {
          /* ignore */
        }
        const payload = {
          ok: true,
          executiveSummary: `Based on your current business context, the highest-leverage move is to tighten positioning around ${question.slice(0, 80)} and concentrate distribution on the channels you already operate.`,
          findings: [
            "Business context is available and should lead every recommendation.",
            "Goals and brand voice should constrain creative and messaging choices.",
            "Channel and campaign history suggest focusing before expanding.",
          ],
          reasoning:
            "A senior strategist prioritizes clarity, focus, and measurable next steps over broad ideation. Recommendations below balance impact with execution difficulty using the supplied context slices.",
          recommendations: [
            {
              title: "Clarify one primary growth thesis",
              body: "Pick a single near-term outcome (engagement, acquisition, or retention) and align content, offers, and channel effort to it for the next 30 days.",
              priority: "HIGH",
              difficulty: "MEDIUM",
              expectedImpact: "Higher signal in creative and clearer KPI ownership",
              estimatedTime: "3–5 days",
              dependencies: ["Business Brain", "Marketing Strategy"],
            },
            {
              title: "Ship one focused campaign test",
              body: "Design a small campaign around that thesis with one audience segment, one offer, and two creative variants.",
              priority: "HIGH",
              difficulty: "MEDIUM",
              expectedImpact: "Faster learning loop with limited spend/effort",
              estimatedTime: "1–2 weeks",
              dependencies: ["Campaigns", "Connected Channels"],
            },
            {
              title: "Close context gaps",
              body: "Fill thin areas in Business Brain / Strategy so future advice stays sharper and less generic.",
              priority: "MEDIUM",
              difficulty: "EASY",
              expectedImpact: "Better strategist confidence and fewer assumptions",
              estimatedTime: "1–2 hours",
              dependencies: ["Business Brain"],
            },
          ],
          risks: [
            "Spreading effort across too many goals will dilute results.",
            "Advice quality drops when critical context sources are disabled.",
          ],
          expectedImpact:
            "A tighter thesis plus one campaign test should produce clearer engagement or conversion signal within two weeks.",
          actionItems: [
            "Confirm the primary 30-day marketing goal",
            "Select one audience segment to prioritize",
            "Draft a one-page campaign brief",
            "Define 2–3 success metrics before launch",
          ],
          confidence: 0.72,
        };
        const content = JSON.stringify(payload, null, 2);
        return {
          content,
          finishReason: "stop",
          promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
          completionTokens: Math.ceil(content.length / 4),
          raw: { mock: true, task: "strategist.advise" },
        };
      }

      if (joined.includes("planner.generate")) {
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        try {
          const m = joined.match(/"startDate"\s*:\s*"([^"]+)"/);
          if (m?.[1]) startDate = new Date(m[1]);
        } catch {
          /* ignore */
        }
        const mix = [
          "EDUCATIONAL",
          "PROMOTIONAL",
          "COMMUNITY",
          "SOCIAL_PROOF",
          "BEHIND_THE_SCENES",
          "ENTERTAINMENT",
          "OFFERS",
        ];
        const titles = [
          "Pillar deep-dive for primary audience",
          "Campaign-aligned proof point",
          "Community question prompt",
          "Behind-the-scenes process share",
          "Educational carousel outline",
          "Offer window announcement slot",
          "Social proof highlight",
          "Product value explainer",
          "Seasonal relevance angle",
          "Audience gap filler",
        ];
        const platforms = ["INSTAGRAM", "LINKEDIN", "INSTAGRAM"];
        const formats = ["INSTAGRAM_CAROUSEL", "LINKEDIN", "INSTAGRAM_REEL", "INSTAGRAM_POST"];
        const count = 10;
        const items = Array.from({ length: count }, (_, i) => {
          const d = new Date(startDate);
          d.setDate(d.getDate() + (i % 7) + Math.floor(i / 7));
          const mixCategory = mix[i % mix.length];
          const title = titles[i % titles.length];
          return {
            title: `${title} #${i + 1}`,
            goal: "Advance the active business goal with channel-fit content",
            platform: platforms[i % platforms.length],
            contentType: formats[i % formats.length],
            suggestedDate: d.toISOString().slice(0, 10),
            targetAudience: "Primary persona from strategy",
            contentPillar: i % 3 === 0 ? "Education" : i % 3 === 1 ? "Trust" : "Offer",
            campaignName: i % 4 === 0 ? "Active campaign" : null,
            priority: i % 5 === 0 ? "HIGH" : "MEDIUM",
            expectedOutcome: "Improve engagement quality and schedule coverage",
            mixCategory,
            insight:
              i % 3 === 0
                ? "This fills a gap in your weekly schedule."
                : i % 3 === 1
                  ? "This audience is currently under-served."
                  : "This topic performed well in previous campaigns.",
          };
        });
        const distribution = Object.fromEntries(
          mix.map((k) => [k, items.filter((it) => it.mixCategory === k).length]),
        );
        const payload = {
          ok: true,
          summary:
            "Strategic publishing plan balanced across educational, promotional, and community slots. Titles are planning labels only — no captions or scripts.",
          items,
          insights: items.map((it) => ({
            kind: "why",
            message: it.insight,
            itemTitle: it.title,
            severity: "info",
          })),
          distribution,
          conflicts: [
            {
              kind: "coverage",
              message: "Weekend density is lower — intentional for steady weekday presence.",
            },
          ],
        };
        const content = JSON.stringify(payload, null, 2);
        return {
          content,
          finishReason: "stop",
          promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
          completionTokens: Math.ceil(content.length / 4),
          raw: { mock: true, task: "planner.generate" },
        };
      }

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
