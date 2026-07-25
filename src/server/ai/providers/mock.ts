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

      if (joined.includes("creator.generate")) {
        let count = 3;
        let contentType = "INSTAGRAM_CAPTION";
        let rewriteStyle = "";
        try {
          const c = joined.match(/"variationCount"\s*:\s*(\d+)/);
          if (c?.[1]) count = Math.min(10, Math.max(1, Number(c[1])));
          const t = joined.match(/"contentType"\s*:\s*"([^"]+)"/);
          if (t?.[1]) contentType = t[1];
          const r = joined.match(/"rewriteStyle"\s*:\s*"([^"]+)"/);
          if (r?.[1]) rewriteStyle = r[1];
        } catch {
          /* ignore */
        }
        const variations = Array.from({ length: count }, (_, i) => {
          const n = i + 1;
          const hook = rewriteStyle
            ? `(${rewriteStyle}) Hook ${n}: Your audience already feels the gap — name it in one line.`
            : `Hook ${n}: Stop scrolling — this is the angle your competitors skip.`;
          const body =
            contentType === "HASHTAGS"
              ? `#BrandVoice #AudienceFirst #CampaignReady #GrowthLoop #ContentSystem`
              : `Body ${n}: Built from Business Brain and brand voice. Lead with the audience problem, prove the point with one concrete insight, then invite a clear next step. Keep the tone aligned to marketing goals and prior content performance.`;
          const slides =
            contentType === "CAROUSEL"
              ? [
                  { order: 1, title: "The gap", text: "What your audience already feels.", isCta: false },
                  { order: 2, title: "The insight", text: "One proof point from your positioning.", isCta: false },
                  { order: 3, title: "The move", text: "A practical next step.", isCta: false },
                  { order: 4, title: "CTA", text: "Save this and take action today.", isCta: true },
                ]
              : undefined;
          const reel =
            contentType === "REEL_SCRIPT"
              ? {
                  openingHook: hook,
                  scenes: [
                    { title: "Scene 1", visual: "Close-up talking head", script: "Name the pain in 3 seconds." },
                    { title: "Scene 2", visual: "Product / process B-roll", script: "Show the simple fix." },
                    { title: "Scene 3", visual: "Result frame", script: "Prove it with one outcome." },
                  ],
                  endingCta: "Follow for the full playbook.",
                }
              : undefined;
          const overall = 78 + ((i * 3) % 15);
          return {
            label: `V${n}`,
            title: `Variation ${n}${rewriteStyle ? ` · ${rewriteStyle}` : ""}`,
            hook,
            body,
            cta: "Comment READY and we’ll outline your next step.",
            visualDirection: "Clean brand palette, high-contrast text, authentic lifestyle stills.",
            suggestedCover: "Bold headline on muted brand background with one product cue.",
            hashtags: ["#Brand", "#Strategy", "#Content", "#Growth"],
            keywords: ["audience", "campaign", "brand voice", "engagement"],
            estimatedReadTime: "1 min",
            carouselSlides: slides,
            reelBreakdown: reel,
            score: {
              brandConsistency: overall - 2,
              readability: overall + 1,
              ctaStrength: overall - 4,
              emotionalImpact: overall - 1,
              engagementPotential: overall,
              seoQuality: overall - 6,
              platformCompatibility: overall + 2,
              overall,
              explanation:
                "Scores reflect brand-fit, clarity, CTA strength, and platform norms using business context — not a generic prompt.",
            },
            review: {
              grammarOk: true,
              voiceOk: true,
              lengthOk: true,
              toneOk: true,
              ctaOk: true,
              formattingOk: true,
              forbiddenHits: [],
              repetitionNotes: i === 0 ? null : "Hook pattern similar to earlier variation — differentiated by angle.",
              notes: "Self-review passed. Ready for human approval.",
              passed: true,
            },
            visuals: [
              { kind: "image", title: "Hero still", detail: "Audience in-context using the product benefit." },
              { kind: "video", title: "Hook clip", detail: "0–3s pattern interrupt matching opening line." },
              { kind: "thumbnail", title: "Cover frame", detail: "High-contrast title + brand color block." },
              { kind: "broll", title: "B-roll", detail: "Hands, workspace, outcome moment." },
              { kind: "shot_list", title: "Shot list", detail: "1) Hook CU 2) Demo MS 3) Proof insert 4) CTA end card" },
            ],
          };
        });
        const payload = {
          ok: true,
          title: `${contentType.replaceAll("_", " ")} set`,
          variations,
          qualityFlags: [
            {
              kind: "info",
              message: "All variations grounded in Business Brain and brand voice context.",
            },
            {
              kind: "watch",
              message: "Compare hooks side-by-side before approving to avoid repetition.",
            },
          ],
        };
        const content = JSON.stringify(payload, null, 2);
        return {
          content,
          finishReason: "stop",
          promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
          completionTokens: Math.ceil(content.length / 4),
          raw: { mock: true, task: "creator.generate" },
        };
      }

      if (joined.includes("opportunity.match")) {
        let eventKeys: string[] = [];
        try {
          const m = joined.match(/"key"\s*:\s*"([^"]+)"/g);
          if (m) {
            eventKeys = m
              .map((x) => x.match(/"([^"]+)"$/)?.[1] || "")
              .filter(Boolean)
              .slice(0, 8);
          }
        } catch {
          /* ignore */
        }
        if (!eventKeys.length) {
          eventKeys = ["black_friday", "earth_day", "back_to_school"];
        }
        const matches = eventKeys.map((eventKey, i) => {
          const overall = 72 + ((i * 5) % 20);
          return {
            eventKey,
            title: `Opportunity · ${eventKey.replaceAll("_", " ")}`,
            summary:
              "A high-signal marketing moment matched to your audience, goals, and brand voice — not a generic calendar entry.",
            matchReason:
              "Aligns with active marketing goals, audience interests, and past campaign themes in Business Brain context.",
            impactTier: overall >= 85 ? "high" : overall >= 75 ? "medium" : "low",
            score: {
              relevance: overall + 2,
              urgency: overall - 4,
              expectedReach: overall - 1,
              salesPotential: overall - 6,
              engagementPotential: overall + 1,
              difficulty: 40 + (i % 30),
              confidence: overall - 3,
              overall,
              explanation:
                "Overall reflects business relevance first, then urgency and expected engagement for this brand.",
            },
            recommendations: [
              {
                kind: "campaign",
                title: "Campaign angle",
                detail: "Lead with audience value tied to the moment; keep offer secondary.",
              },
              {
                kind: "promotion",
                title: "Promotion idea",
                detail: "Limited-time bundle or early-access perk for engaged segments.",
              },
              {
                kind: "content_series",
                title: "Content series",
                detail: "3-part educational → social proof → offer sequence.",
              },
              {
                kind: "reel",
                title: "Reel idea",
                detail: "Hook on the cultural moment, then show your product as the practical fix.",
              },
              {
                kind: "carousel",
                title: "Carousel idea",
                detail: "Problem → insight → proof → CTA slides.",
              },
              {
                kind: "story",
                title: "Stories",
                detail: "Poll + behind-the-scenes + swipe-up/CTA sequence.",
              },
              {
                kind: "email",
                title: "Email campaign",
                detail: "Subject line around the moment; body focused on one clear action.",
              },
              {
                kind: "landing_page",
                title: "Landing page",
                detail: "Moment-specific hero, one offer, one CTA.",
              },
              {
                kind: "cta",
                title: "CTA",
                detail: "Claim your early access / Shop the moment / Join the challenge.",
              },
              {
                kind: "offer",
                title: "Offer suggestion",
                detail: "Time-boxed incentive that fits brand positioning.",
              },
              {
                kind: "hashtags",
                title: "Hashtag direction",
                detail: "Blend moment tags with 2–3 brand-owned tags.",
              },
            ],
          };
        });
        const payload = { ok: true, matches };
        const content = JSON.stringify(payload, null, 2);
        return {
          content,
          finishReason: "stop",
          promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
          completionTokens: Math.ceil(content.length / 4),
          raw: { mock: true, task: "opportunity.match" },
        };
      }

      if (joined.includes("community.assist")) {
        let ids: string[] = [];
        try {
          const matches = joined.match(/"id"\s*:\s*"([^"]+)"/g) || [];
          ids = matches
            .map((m) => m.match(/"([^"]+)"$/)?.[1] || "")
            .filter(Boolean)
            .slice(0, 12);
        } catch {
          /* ignore */
        }
        if (!ids.length) ids = ["demo-1", "demo-2", "demo-3"];
        const intents = [
          "QUESTION",
          "SALES_LEAD",
          "COMPLAINT",
          "COMPLIMENT",
          "SUPPORT",
          "VIP",
        ];
        const results = ids.map((conversationId, i) => {
          const intent = intents[i % intents.length];
          const overall = 74 + ((i * 4) % 18);
          return {
            conversationId,
            intent: {
              type: intent,
              confidence: 0.72 + (i % 20) / 100,
              labels: [intent.toLowerCase()],
              explanation: `Classified as ${intent} from recent inbound message intent signals.`,
            },
            priority: {
              score: intent === "COMPLAINT" || intent === "VIP" ? 90 - i : 70 - i * 2,
              rankReason:
                intent === "VIP"
                  ? "VIP customer — answer first."
                  : intent === "COMPLAINT"
                    ? "Negative sentiment and urgency elevate priority."
                    : intent === "SALES_LEAD"
                      ? "High revenue potential lead."
                      : "Unanswered inbound needs a timely reply.",
              vip: intent === "VIP",
              urgent: intent === "COMPLAINT",
              revenuePotential: intent === "SALES_LEAD" ? 82 : 40,
              unanswered: true,
              negativeSentiment: intent === "COMPLAINT",
              agingHours: 2 + i,
            },
            sentiment: {
              label:
                intent === "COMPLAINT"
                  ? "negative"
                  : intent === "COMPLIMENT"
                    ? "positive"
                    : "neutral",
              score:
                intent === "COMPLAINT" ? 28 : intent === "COMPLIMENT" ? 86 : 55,
              buyingIntent: intent === "SALES_LEAD" ? 78 : 25,
              urgency: intent === "COMPLAINT" ? 80 : 35,
              satisfaction: intent === "COMPLIMENT" ? 90 : 50,
              spamProbability: intent === "SPAM" ? 85 : 8,
              salesOpportunity: intent === "SALES_LEAD" ? 80 : 20,
              retentionRisk: intent === "COMPLAINT" ? 70 : 15,
              explanation: "Sentiment inferred from tone and request type.",
            },
            profile: {
              isVip: intent === "VIP",
              isInfluencer: intent === "INFLUENCER",
              isReturning: intent === "RETURNING" || i % 3 === 0,
              summary: "Customer context from inbox history and tags.",
              tags: intent === "VIP" ? ["vip"] : ["inbox"],
            },
            suggestions: [
              {
                kind: "REPLY",
                body:
                  intent === "COMPLAINT"
                    ? "Thanks for flagging this — I'm sorry for the friction. I've noted the details and a teammate will follow up shortly with a clear next step. Could you share your order/reference if you have one?"
                    : intent === "SALES_LEAD"
                      ? "Thanks for reaching out! Happy to help you choose the right option. What's the main outcome you're aiming for, and which product/service are you considering?"
                      : "Thanks for your message — happy to help. Based on what you asked, here's the clearest next step. If I missed anything, tell me and I'll clarify.",
                confidence: 0.78,
                quality: {
                  brandConsistency: overall,
                  clarity: overall + 2,
                  professionalism: overall,
                  empathy: overall - 2,
                  actionability: overall - 1,
                  confidence: overall,
                  overall,
                },
                explanation:
                  "Draft respects Brand DNA; no invented offers or product claims.",
              },
              {
                kind: intent === "COMPLAINT" ? "ESCALATE" : "FOLLOW_UP",
                body:
                  intent === "COMPLAINT"
                    ? "Escalate to human support — do not auto-promise a refund or timeline."
                    : "Quick follow-up: Is there anything else you need before we close this out?",
                confidence: 0.7,
                quality: {
                  brandConsistency: overall - 2,
                  clarity: overall,
                  professionalism: overall,
                  empathy: overall,
                  actionability: overall,
                  confidence: overall - 3,
                  overall: overall - 1,
                },
                explanation: "Secondary action based on intent class.",
              },
            ],
            automationHints:
              intent === "SALES_LEAD"
                ? [{ rule: "Lead", action: "Create CRM Contact" }]
                : intent === "COMPLAINT"
                  ? [{ rule: "Complaint", action: "Escalate" }]
                  : intent === "VIP"
                    ? [{ rule: "VIP", action: "Notify Team" }]
                    : intent === "QUESTION"
                      ? [{ rule: "FAQ", action: "Suggest AI Reply" }]
                      : [],
          };
        });
        const payload = { ok: true, results };
        const content = JSON.stringify(payload, null, 2);
        return {
          content,
          finishReason: "stop",
          promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
          completionTokens: Math.ceil(content.length / 4),
          raw: { mock: true, task: "community.assist" },
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
