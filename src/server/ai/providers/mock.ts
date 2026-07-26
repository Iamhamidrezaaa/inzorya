import type {
  AIProviderAdapter,
  ProviderGenerateRequest,
  ProviderGenerateResult,
  StreamChunk,
} from "@/server/ai/providers/types";
import { AIPlatformError } from "@/server/ai/errors";
import {
  campaignFa,
  communityFa,
  creatorFa,
  decisionsFa,
  detectOutputLang,
  opportunityFa,
  plannerFa,
  strategistFa,
  taskAssistFa,
} from "@/server/ai/providers/mock-i18n";

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
        const lang = detectOutputLang(joined);
        let question =
          lang === "fa"
            ? "اولویت‌های فعلی بازاریابی شما"
            : "your current marketing priorities";
        try {
          const inputMatch = joined.match(/"question"\s*:\s*"([^"]+)"/);
          if (inputMatch?.[1]) question = inputMatch[1];
        } catch {
          /* ignore */
        }
        const payload =
          lang === "fa"
            ? {
                ok: true,
                executiveSummary: strategistFa.executiveSummary(question),
                findings: strategistFa.findings,
                reasoning: strategistFa.reasoning,
                recommendations: strategistFa.recommendations.map((r, i) => ({
                  title: r.title,
                  body: r.body,
                  priority: i < 2 ? "HIGH" : "MEDIUM",
                  difficulty: i === 2 ? "EASY" : "MEDIUM",
                  expectedImpact: r.expectedImpact,
                  estimatedTime: r.estimatedTime,
                  dependencies:
                    i === 0
                      ? ["مغز کسب‌وکار", "استراتژی بازاریابی"]
                      : i === 1
                        ? ["کمپین‌ها", "کانال‌های متصل"]
                        : ["مغز کسب‌وکار"],
                })),
                risks: strategistFa.risks,
                expectedImpact: strategistFa.expectedImpact,
                actionItems: strategistFa.actionItems,
                confidence: 0.72,
              }
            : {
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
        const lang = detectOutputLang(joined);
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
        const titles =
          lang === "fa"
            ? plannerFa.titles
            : [
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
          const pillars =
            lang === "fa" ? plannerFa.pillars : (["Education", "Trust", "Offer"] as const);
          const insights =
            lang === "fa"
              ? plannerFa.insights
              : [
                  "This fills a gap in your weekly schedule.",
                  "This audience is currently under-served.",
                  "This topic performed well in previous campaigns.",
                ];
          return {
            title: `${title} #${i + 1}`,
            goal:
              lang === "fa"
                ? plannerFa.goal
                : "Advance the active business goal with channel-fit content",
            platform: platforms[i % platforms.length],
            contentType: formats[i % formats.length],
            suggestedDate: d.toISOString().slice(0, 10),
            targetAudience:
              lang === "fa" ? plannerFa.audience : "Primary persona from strategy",
            contentPillar: pillars[i % 3],
            campaignName:
              i % 4 === 0
                ? lang === "fa"
                  ? plannerFa.campaign
                  : "Active campaign"
                : null,
            priority: i % 5 === 0 ? "HIGH" : "MEDIUM",
            expectedOutcome:
              lang === "fa"
                ? plannerFa.outcome
                : "Improve engagement quality and schedule coverage",
            mixCategory,
            insight: insights[i % 3],
          };
        });
        const distribution = Object.fromEntries(
          mix.map((k) => [k, items.filter((it) => it.mixCategory === k).length]),
        );
        const payload = {
          ok: true,
          summary:
            lang === "fa"
              ? plannerFa.summary
              : "Strategic publishing plan balanced across educational, promotional, and community slots. Titles are planning labels only — no captions or scripts.",
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
              message:
                lang === "fa"
                  ? plannerFa.conflict
                  : "Weekend density is lower — intentional for steady weekday presence.",
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
        const lang = detectOutputLang(joined);
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
          const hook =
            lang === "fa"
              ? creatorFa.hook(n, rewriteStyle)
              : rewriteStyle
                ? `(${rewriteStyle}) Hook ${n}: Your audience already feels the gap — name it in one line.`
                : `Hook ${n}: Stop scrolling — this is the angle your competitors skip.`;
          const body =
            contentType === "HASHTAGS"
              ? lang === "fa"
                ? creatorFa.hashtags
                : `#BrandVoice #AudienceFirst #CampaignReady #GrowthLoop #ContentSystem`
              : lang === "fa"
                ? creatorFa.body(n)
                : `Body ${n}: Built from Business Brain and brand voice. Lead with the audience problem, prove the point with one concrete insight, then invite a clear next step. Keep the tone aligned to marketing goals and prior content performance.`;
          const slides =
            contentType === "CAROUSEL"
              ? lang === "fa"
                ? creatorFa.slides
                : [
                    { order: 1, title: "The gap", text: "What your audience already feels.", isCta: false },
                    { order: 2, title: "The insight", text: "One proof point from your positioning.", isCta: false },
                    { order: 3, title: "The move", text: "A practical next step.", isCta: false },
                    { order: 4, title: "CTA", text: "Save this and take action today.", isCta: true },
                  ]
              : undefined;
          const reel =
            contentType === "REEL_SCRIPT"
              ? lang === "fa"
                ? creatorFa.reel(hook)
                : {
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
            title:
              lang === "fa"
                ? creatorFa.variationTitle(n, rewriteStyle)
                : `Variation ${n}${rewriteStyle ? ` · ${rewriteStyle}` : ""}`,
            hook,
            body,
            cta:
              lang === "fa"
                ? creatorFa.cta
                : "Comment READY and we’ll outline your next step.",
            visualDirection:
              lang === "fa"
                ? creatorFa.visualDirection
                : "Clean brand palette, high-contrast text, authentic lifestyle stills.",
            suggestedCover:
              lang === "fa"
                ? creatorFa.suggestedCover
                : "Bold headline on muted brand background with one product cue.",
            hashtags:
              lang === "fa"
                ? creatorFa.hashtagsList
                : ["#Brand", "#Strategy", "#Content", "#Growth"],
            keywords:
              lang === "fa"
                ? creatorFa.keywords
                : ["audience", "campaign", "brand voice", "engagement"],
            estimatedReadTime: lang === "fa" ? creatorFa.readTime : "1 min",
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
                lang === "fa"
                  ? creatorFa.scoreExplanation
                  : "Scores reflect brand-fit, clarity, CTA strength, and platform norms using business context — not a generic prompt.",
            },
            review: {
              grammarOk: true,
              voiceOk: true,
              lengthOk: true,
              toneOk: true,
              ctaOk: true,
              formattingOk: true,
              forbiddenHits: [],
              repetitionNotes:
                i === 0
                  ? null
                  : lang === "fa"
                    ? creatorFa.repetitionNotes
                    : "Hook pattern similar to earlier variation — differentiated by angle.",
              notes:
                lang === "fa"
                  ? creatorFa.reviewNotes
                  : "Self-review passed. Ready for human approval.",
              passed: true,
            },
            visuals:
              lang === "fa"
                ? creatorFa.visuals
                : [
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
          title:
            lang === "fa"
              ? creatorFa.title(contentType)
              : `${contentType.replaceAll("_", " ")} set`,
          variations,
          qualityFlags: [
            {
              kind: "info",
              message:
                lang === "fa"
                  ? creatorFa.qualityInfo
                  : "All variations grounded in Business Brain and brand voice context.",
            },
            {
              kind: "watch",
              message:
                lang === "fa"
                  ? creatorFa.qualityWatch
                  : "Compare hooks side-by-side before approving to avoid repetition.",
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

      if (joined.includes("campaign.generate")) {
        const lang = detectOutputLang(joined);
        let opportunityIds: string[] = [];
        try {
          const m = joined.match(/"id"\s*:\s*"([^"]+)"/g);
          if (m) {
            opportunityIds = m
              .map((x) => x.match(/"([^"]+)"$/)?.[1] || "")
              .filter(Boolean)
              .slice(0, 6);
          }
        } catch {
          /* ignore */
        }
        if (!opportunityIds.length) opportunityIds = ["opp-demo-1"];
        const strategies = [
          "SEASONAL",
          "PROMOTION",
          "AWARENESS",
          "SALES",
          "COMMUNITY",
        ];
        const proposals = opportunityIds.flatMap((opportunityId, i) => {
          const priority = 70 + ((i * 7) % 25);
          const strategy = strategies[i % strategies.length];
          return [
            {
              opportunityId,
              name:
                lang === "fa"
                  ? campaignFa.name(i)
                  : `Campaign blueprint · option ${i + 1}`,
              objective:
                lang === "fa"
                  ? campaignFa.objective(strategy)
                  : `Capitalize on the matched opportunity with a ${strategy.toLowerCase()} push — human approval required before any launch.`,
              strategy,
              targetAudience:
                lang === "fa"
                  ? campaignFa.audience
                  : "Primary brand audience overlapping with the event's relevant segments.",
              primaryChannel: "INSTAGRAM",
              supportingChannels: ["EMAIL", "STORIES"],
              suggestedDurationDays: 10 + (i % 3) * 4,
              priority,
              confidence: 0.72 + (i % 4) * 0.05,
              components: {
                offer:
                  lang === "fa"
                    ? campaignFa.offer
                    : "Time-boxed value proposition aligned to brand positioning (direction only).",
                theme:
                  lang === "fa"
                    ? campaignFa.theme
                    : "Moment-led creative theme tied to the opportunity.",
                visualDirection:
                  lang === "fa"
                    ? campaignFa.visual
                    : "Clean product-forward visuals; avoid generic holiday clichés.",
                messaging:
                  lang === "fa"
                    ? campaignFa.messaging
                    : "Lead with relevance + proof; keep tone consistent with Brand DNA.",
                cta:
                  lang === "fa"
                    ? campaignFa.cta
                    : "Soft conversion CTA toward owned landing/offer page.",
                landingPage:
                  lang === "fa"
                    ? campaignFa.landing
                    : "Single-purpose landing focused on the campaign objective.",
                email:
                  lang === "fa"
                    ? campaignFa.email
                    : "2–3 touch email sequence structure (subjects/outline only).",
                storySequence: [
                  {
                    step: 1,
                    purpose: lang === "fa" ? campaignFa.story[0] : "Tease the moment",
                  },
                  {
                    step: 2,
                    purpose: lang === "fa" ? campaignFa.story[1] : "Show social proof",
                  },
                  {
                    step: 3,
                    purpose: lang === "fa" ? campaignFa.story[2] : "Drive to CTA",
                  },
                ],
                reelSeries: [
                  {
                    episode: 1,
                    purpose: lang === "fa" ? campaignFa.reel[0] : "Hook + problem",
                  },
                  {
                    episode: 2,
                    purpose: lang === "fa" ? campaignFa.reel[1] : "Solution demo",
                  },
                ],
                carouselSeries: [
                  {
                    slide: 1,
                    purpose: lang === "fa" ? campaignFa.carousel[0] : "Context",
                  },
                  {
                    slide: 2,
                    purpose: lang === "fa" ? campaignFa.carousel[1] : "Benefits",
                  },
                  {
                    slide: 3,
                    purpose: lang === "fa" ? campaignFa.carousel[2] : "CTA",
                  },
                ],
              },
              contentPlan: {
                items: [
                  {
                    contentType: "REEL",
                    quantity: 2,
                    publishOffsetDays: -7,
                    dependencies: ["brief"],
                  },
                  {
                    contentType: "CAROUSEL",
                    quantity: 1,
                    publishOffsetDays: -3,
                    dependencies: ["design"],
                  },
                  {
                    contentType: "STORY",
                    quantity: 3,
                    publishOffsetDays: 0,
                    dependencies: ["reel"],
                  },
                  {
                    contentType: "EMAIL",
                    quantity: 2,
                    publishOffsetDays: -2,
                    dependencies: ["landing"],
                  },
                ],
              },
              execution: {
                preparation:
                  lang === "fa" ? campaignFa.prep : "Confirm offer, audience, and channel readiness.",
                design:
                  lang === "fa" ? campaignFa.design : "Produce visual system and asset checklist.",
                approval:
                  lang === "fa" ? campaignFa.approval : "Human review of blueprint before any publish.",
                publishing:
                  lang === "fa"
                    ? campaignFa.publishing
                    : "Stagger posts across primary + supporting channels.",
                followUp:
                  lang === "fa" ? campaignFa.followUp : "Engage comments and nurture warm leads.",
                measurement:
                  lang === "fa"
                    ? campaignFa.measurement
                    : "Track reach, engagement, leads vs baseline.",
                steps: [
                  {
                    phase: "preparation",
                    detail: lang === "fa" ? "بریف شروع" : "Kickoff brief",
                    offsetDays: -14,
                  },
                  {
                    phase: "design",
                    detail: lang === "fa" ? "آمادگی دارایی‌ها" : "Assets ready",
                    offsetDays: -7,
                  },
                  {
                    phase: "approval",
                    detail: lang === "fa" ? "تأیید ذی‌نفعان" : "Stakeholder sign-off",
                    offsetDays: -3,
                  },
                  {
                    phase: "publishing",
                    detail: lang === "fa" ? "پنجره انتشار" : "Go-live window",
                    offsetDays: 0,
                  },
                  {
                    phase: "followUp",
                    detail: lang === "fa" ? "جامعه + CRM" : "Community + CRM",
                    offsetDays: 3,
                  },
                  {
                    phase: "measurement",
                    detail: lang === "fa" ? "جمع‌بندی" : "Post-mortem",
                    offsetDays: 10,
                  },
                ],
              },
              resources: {
                complexity: i % 2 === 0 ? "medium" : "high",
                requiredTeam: ["marketer", "designer", "copywriter"],
                estimatedHours: 18 + i * 4,
                assetsNeeded:
                  lang === "fa"
                    ? ["تصویر اصلی", "شات محصول", "لوگو"]
                    : ["hero visual", "product shots", "logo lockup"],
                riskLevel: i % 3 === 0 ? "low" : "medium",
              },
              impact: {
                expectedReach: 60 + i * 5,
                expectedEngagement: 55 + i * 4,
                expectedLeads: 50 + i * 3,
                expectedRevenueImpact: 48 + i * 6,
                brandImpact: 62,
                confidence: 0.7,
                notes:
                  lang === "fa"
                    ? "فقط برآورد — پیش‌بینی قطعی نیست. قضاوت انسان لازم است."
                    : "Estimates only — not forecasts. Requires human judgment.",
              },
              scenarios: [
                {
                  kind: "CONSERVATIVE",
                  name: lang === "fa" ? "محافظه‌کارانه" : "Conservative",
                  summary:
                    lang === "fa"
                      ? "دارایی کمتر، فقط کانال‌های اختصاصی، ریسک هزینه پایین‌تر."
                      : "Fewer assets, owned channels only, lower spend risk.",
                  priority: priority - 12,
                  confidence: 0.78,
                  adjustments: { channels: 1, contentItems: 4 },
                },
                {
                  kind: "BALANCED",
                  name: lang === "fa" ? "متعادل" : "Balanced",
                  summary:
                    lang === "fa"
                      ? "ترکیب اصلی ریل + کاروسل + ایمیل با تلاش متوسط."
                      : "Core mix of reel + carousel + email with moderate effort.",
                  priority,
                  confidence: 0.74,
                  adjustments: { channels: 2, contentItems: 7 },
                  selected: true,
                },
                {
                  kind: "AGGRESSIVE",
                  name: lang === "fa" ? "تهاجمی" : "Aggressive",
                  summary:
                    lang === "fa"
                      ? "فشار چندکاناله کامل با ریتم انتشار فشرده‌تر."
                      : "Full multi-channel push with denser publishing cadence.",
                  priority: priority + 10,
                  confidence: 0.62,
                  adjustments: { channels: 3, contentItems: 12 },
                },
              ],
              explanation: {
                whyThisCampaign:
                  lang === "fa"
                    ? "امتیاز فرصت و شواهد تناسب قوی با اهداف و مخاطب برند را نشان می‌دهد."
                    : "Opportunity score and evidence show strong fit with brand goals and audience.",
                whyNow:
                  lang === "fa"
                    ? "پنجره آماده‌سازی باز است؛ تأخیر ریسک از دست دادن اوج رویداد را دارد."
                    : "Preparation window is open; delaying risks missing the event peak.",
                supportingEvidence: [
                  {
                    source: "opportunity",
                    label: lang === "fa" ? "امتیاز کل" : "Overall score",
                    detail:
                      lang === "fa"
                        ? "بالای آستانه با شواهد پشتیبان قوانین."
                        : "Eligible above threshold with supporting rule evidence.",
                  },
                  {
                    source: "knowledge_graph",
                    label: lang === "fa" ? "تناسب صنعت / مخاطب" : "Industry / audience fit",
                    detail:
                      lang === "fa"
                        ? "صنایع و مخاطبان رویداد با DNA برند هم‌پوشانی دارند."
                        : "Event industries and audiences overlap brand DNA.",
                  },
                ],
                tradeOffs:
                  lang === "fa"
                    ? "دیده‌شدن بیشتر در برابر پهنای باند سایر کمپین‌های فعال."
                    : "Higher visibility vs bandwidth for other active campaigns.",
                potentialRisks:
                  lang === "fa"
                    ? "خستگی خلاق اگر پیام از DNA برند دور شود؛ تداخل زمان‌بندی."
                    : "Creative fatigue if messaging drifts from Brand DNA; schedule collisions.",
              },
            },
          ];
        });
        const payload = { ok: true, proposals };
        const content = JSON.stringify(payload, null, 2);
        return {
          content,
          finishReason: "stop",
          promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
          completionTokens: Math.ceil(content.length / 4),
          raw: { mock: true, task: "campaign.generate" },
        };
      }

      if (joined.includes("opportunity.match")) {
        const lang = detectOutputLang(joined);
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
            title:
              lang === "fa"
                ? opportunityFa.title(eventKey)
                : `Opportunity · ${eventKey.replaceAll("_", " ")}`,
            summary: lang === "fa" ? opportunityFa.summary : "A high-signal marketing moment matched to your audience, goals, and brand voice — not a generic calendar entry.",
            matchReason:
              lang === "fa"
                ? opportunityFa.matchReason
                : "Aligns with active marketing goals, audience interests, and past campaign themes in Business Brain context.",
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
                lang === "fa"
                  ? opportunityFa.scoreExplanation
                  : "Overall reflects business relevance first, then urgency and expected engagement for this brand.",
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
        const lang = detectOutputLang(joined);
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
          const replyBody =
            lang === "fa"
              ? intent === "COMPLAINT"
                ? communityFa.replyComplaint
                : intent === "SALES_LEAD"
                  ? communityFa.replyLead
                  : communityFa.replyDefault
              : intent === "COMPLAINT"
                ? "Thanks for flagging this — I'm sorry for the friction. I've noted the details and a teammate will follow up shortly with a clear next step. Could you share your order/reference if you have one?"
                : intent === "SALES_LEAD"
                  ? "Thanks for reaching out! Happy to help you choose the right option. What's the main outcome you're aiming for, and which product/service are you considering?"
                  : "Thanks for your message — happy to help. Based on what you asked, here's the clearest next step. If I missed anything, tell me and I'll clarify.";
          return {
            conversationId,
            intent: {
              type: intent,
              confidence: 0.72 + (i % 20) / 100,
              labels: [intent.toLowerCase()],
              explanation:
                lang === "fa"
                  ? communityFa.explanation(intent)
                  : `Classified as ${intent} from recent inbound message intent signals.`,
            },
            priority: {
              score: intent === "COMPLAINT" || intent === "VIP" ? 90 - i : 70 - i * 2,
              rankReason:
                lang === "fa"
                  ? intent === "VIP"
                    ? communityFa.rankVip
                    : intent === "COMPLAINT"
                      ? communityFa.rankComplaint
                      : intent === "SALES_LEAD"
                        ? communityFa.rankLead
                        : communityFa.rankDefault
                  : intent === "VIP"
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
              explanation:
                lang === "fa"
                  ? communityFa.sentimentExplanation
                  : "Sentiment inferred from tone and request type.",
            },
            profile: {
              isVip: intent === "VIP",
              isInfluencer: intent === "INFLUENCER",
              isReturning: intent === "RETURNING" || i % 3 === 0,
              summary:
                lang === "fa"
                  ? communityFa.profileSummary
                  : "Customer context from inbox history and tags.",
              tags: intent === "VIP" ? ["vip"] : ["inbox"],
            },
            suggestions: [
              {
                kind: "REPLY",
                body: replyBody,
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
                  lang === "fa"
                    ? "پیش‌نویس به DNA برند احترام می‌گذارد؛ پیشنهاد یا ادعای محصول ساختگی ندارد."
                    : "Draft respects Brand DNA; no invented offers or product claims.",
              },
              {
                kind: intent === "COMPLAINT" ? "ESCALATE" : "FOLLOW_UP",
                body:
                  lang === "fa"
                    ? intent === "COMPLAINT"
                      ? "به پشتیبانی انسان ارجاع دهید — بازپرداخت یا زمان‌بندی را خودکار وعده ندهید."
                      : "پیگیری سریع: چیز دیگری لازم دارید قبل از بستن این گفتگو؟"
                    : intent === "COMPLAINT"
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

      if (joined.includes("decision.brief")) {
        if (detectOutputLang(joined) === "fa") {
          const faPayload = {
            ok: true,
            daily: decisionsFa.daily,
            morning: decisionsFa.morning,
            recommendations: [
              {
                type: "ANSWER_VIP",
                title: decisionsFa.rec.title,
                summary: decisionsFa.rec.summary,
                priority: 96,
                confidence: 0.9,
                businessImpact: 88,
                expectedRoi: 75,
                effort: 25,
                urgency: 95,
                reason: decisionsFa.rec.reason,
                whatHappened: decisionsFa.rec.whatHappened,
                whyItMatters: decisionsFa.rec.whyItMatters,
                consequences: decisionsFa.rec.consequences,
                recommendedAction: decisionsFa.rec.recommendedAction,
                alternatives: decisionsFa.rec.alternatives,
                risks: decisionsFa.rec.risks,
                evidence: [
                  {
                    source: "اینباکس جامعه",
                    label: "VIP بدون پاسخ",
                    detail: decisionsFa.rec.evidenceDetail,
                    metricValue: "3",
                  },
                ],
              },
            ],
          };
          const content = JSON.stringify(faPayload, null, 2);
          return {
            content,
            finishReason: "stop",
            promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
            completionTokens: Math.ceil(content.length / 4),
            raw: { mock: true, task: "decision.brief" },
          };
        }
        const payload = {
          ok: true,
          daily: {
            todaysSummary:
              "Three decisions need attention: VIP replies, a high-performing carousel pattern, and a near-term calendar opportunity.",
            topPriorities: [
              "Respond to VIP customers within two hours",
              "Publish one educational Reel to recover engagement",
              "Prepare limited combo for the upcoming food calendar day",
            ],
            biggestOpportunities: [
              "Carousel posts are outperforming Reels — lean the mix",
              "World food calendar moment in five days fits brand",
            ],
            biggestRisks: [
              "VIP threads aging unanswered hurt retention",
              "Underperforming campaign may waste remaining budget",
            ],
            campaignHealth:
              "Most campaigns are stable; one underperformer needs a pause-or-test decision.",
            contentHealth:
              "Educational carousels lead engagement; Reels need a stronger hook today.",
            communityHealth:
              "Inbox has unanswered VIP and sales-lead threads requiring human attention.",
            salesSignals:
              "Two warm inbound leads asked about offers — convert or assign quickly.",
            recommendedActions: [
              "Answer VIP customers",
              "Publish educational Reel",
              "Draft limited-time combo campaign",
            ],
            motivationalInsight:
              "Clarity beats volume — one decisive move today outperforms ten reports.",
          },
          morning: {
            greeting: "Good morning.",
            todaysFocus: "Protect relationships and ship one high-signal content move.",
            topTasks: [
              { title: "Reply to VIP threads", urgency: 95 },
              { title: "Publish educational Reel", urgency: 85 },
              { title: "Review underperforming campaign", urgency: 78 },
              { title: "Outline food-day combo offer", urgency: 70 },
              { title: "Adjust next week's content mix", urgency: 62 },
            ],
            criticalNotifications: [
              "Three VIP customers are waiting",
              "Engagement dipped on Reels vs last week",
            ],
            aiRecommendation:
              "Start with VIP replies, then ship one educational Reel before noon.",
            motivationalQuote:
              "Do the important work first — momentum follows decisive action.",
            estimatedWorkload: "About 2.5 focused hours",
            suggestedSchedule:
              "09:00 VIP replies · 10:00 Reel publish · 11:30 campaign review · afternoon food-day brief",
          },
          recommendations: [
            {
              type: "ANSWER_VIP",
              title: "Three VIP customers are waiting",
              summary: "Unanswered VIP threads are aging and risk retention.",
              priority: 96,
              confidence: 0.9,
              businessImpact: 88,
              expectedRoi: 75,
              effort: 25,
              urgency: 95,
              reason: "VIP response SLA is the highest-leverage relationship action today.",
              whatHappened: "Three VIP conversations remain unanswered beyond expected response window.",
              whyItMatters: "VIP customers disproportionately affect retention and referral.",
              consequences: "Fast replies protect loyalty; delay increases churn risk.",
              recommendedAction: "Respond within two hours.",
              alternatives: ["Assign to community lead", "Send holding reply then escalate"],
              risks: "Generic auto-replies may feel off-brand for VIP.",
              evidence: [
                {
                  source: "Community Inbox",
                  label: "VIP unanswered",
                  detail: "Three VIP threads waiting for human reply",
                  metricValue: "3",
                },
              ],
            },
            {
              type: "CREATE_REEL",
              title: "Instagram engagement soft on Reels",
              summary: "Engagement dropped versus last week; educational Reel can recover attention.",
              priority: 84,
              confidence: 0.78,
              businessImpact: 72,
              expectedRoi: 68,
              effort: 45,
              urgency: 80,
              reason: "Content health needs one corrective publish today, not a full audit.",
              whatHappened: "Reel engagement lagged while carousels stayed stronger.",
              whyItMatters: "Reach and brand presence depend on timely high-signal posts.",
              consequences: "One strong educational Reel can stabilize the week’s content health.",
              recommendedAction: "Publish one educational Reel today.",
              alternatives: ["Boost best carousel", "Publish Story teaser first"],
              risks: "Rushing a weak hook may waste the slot.",
              evidence: [
                {
                  source: "Content Performance",
                  label: "Engagement change",
                  detail: "Reels underperformed relative to carousel posts this period",
                  metricValue: "-18%",
                },
              ],
            },
            {
              type: "CREATE_PROMOTION",
              title: "Calendar moment in five days",
              summary: "A food calendar opportunity aligns with brand — prep a limited combo.",
              priority: 76,
              confidence: 0.74,
              businessImpact: 80,
              expectedRoi: 82,
              effort: 55,
              urgency: 70,
              reason: "Near-term calendar fit with clear commercial upside.",
              whatHappened: "Opportunity Engine flagged a relevant food calendar day in five days.",
              whyItMatters: "Limited-time offers convert best when prepared before the day.",
              consequences: "Early launch captures attention; late launch feels reactive.",
              recommendedAction: "Launch a limited-time combo campaign.",
              alternatives: ["Story-only teaser", "Postpone to next similar day"],
              risks: "Offer too aggressive may dilute brand positioning.",
              evidence: [
                {
                  source: "Opportunity Engine",
                  label: "Days until event",
                  detail: "Relevant calendar opportunity approaching",
                  metricValue: "5 days",
                },
              ],
            },
            {
              type: "BOOST_CONTENT",
              title: "Carousels outperform Reels this month",
              summary: "Shift next week's mix toward educational carousels.",
              priority: 68,
              confidence: 0.8,
              businessImpact: 65,
              expectedRoi: 70,
              effort: 30,
              urgency: 55,
              reason: "Performance pattern should change planning, not just reporting.",
              whatHappened: "Carousel posts outperformed Reels across recent publishes.",
              whyItMatters: "Content mix should follow evidence tied to goals.",
              consequences: "Adjusting mix improves efficiency; ignoring it wastes slots.",
              recommendedAction: "Adjust next week's content mix.",
              alternatives: ["A/B test Reel hooks", "Archive weakest Reels"],
              risks: "Over-correcting may reduce video reach experiments.",
              evidence: [
                {
                  source: "Content Performance",
                  label: "Format winner",
                  detail: "Carousels led engagement versus Reels this month",
                  metricValue: "Carousel > Reel",
                },
              ],
            },
          ],
          insights: [
            {
              kind: "focus",
              title: "Protect VIP + ship one Reel",
              detail: "Relationship risk outranks optimization busywork today.",
              severity: "high",
            },
          ],
          memories: [
            {
              category: "preference",
              key: "vip_first",
              content: "Manager consistently prioritizes VIP replies before content experiments.",
            },
          ],
        };
        const content = JSON.stringify(payload, null, 2);
        return {
          content,
          finishReason: "stop",
          promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
          completionTokens: Math.ceil(content.length / 4),
          raw: { mock: true, task: "decision.brief" },
        };
      }

      if (joined.includes("task.assist")) {
        const lang = detectOutputLang(joined);
        let taskIds: string[] = [];
        try {
          const matches = joined.match(/"id"\s*:\s*"([^"]+)"/g) || [];
          taskIds = matches
            .map((m) => m.match(/"([^"]+)"$/)?.[1] || "")
            .filter(Boolean)
            .slice(0, 8);
        } catch {
          /* ignore */
        }
        if (!taskIds.length) taskIds = ["task-1"];
        const mode = joined.includes("breakdown")
          ? "breakdown"
          : joined.includes("workload")
            ? "workload"
            : joined.includes("order")
              ? "order"
              : joined.includes("blocker")
                ? "blockers"
                : joined.includes("estimate")
                  ? "estimate"
                  : "next_action";
        const faSubs = taskAssistFa.subtasks;
        const payload =
          mode === "breakdown"
            ? {
                ok: true,
                subtasks: [
                  {
                    parentId: taskIds[0],
                    title: lang === "fa" ? faSubs[0].title : "Write caption",
                    type: "COPYWRITING",
                    estimatedMinutes: 30,
                    priority: "HIGH",
                  },
                  {
                    parentId: taskIds[0],
                    title: lang === "fa" ? faSubs[1].title : "Design carousel",
                    type: "DESIGN",
                    estimatedMinutes: 60,
                    priority: "HIGH",
                  },
                  {
                    parentId: taskIds[0],
                    title: lang === "fa" ? faSubs[2].title : "Review",
                    type: "APPROVAL",
                    estimatedMinutes: 20,
                    priority: "MEDIUM",
                  },
                  {
                    parentId: taskIds[0],
                    title: lang === "fa" ? faSubs[3].title : "Approve",
                    type: "APPROVAL",
                    estimatedMinutes: 15,
                    priority: "MEDIUM",
                  },
                  {
                    parentId: taskIds[0],
                    title: lang === "fa" ? faSubs[4].title : "Schedule",
                    type: "PUBLISHING",
                    estimatedMinutes: 15,
                    priority: "MEDIUM",
                  },
                  {
                    parentId: taskIds[0],
                    title: lang === "fa" ? faSubs[5].title : "Publish",
                    type: "PUBLISHING",
                    estimatedMinutes: 10,
                    priority: "HIGH",
                  },
                ],
                dependencies:
                  lang === "fa"
                    ? taskAssistFa.deps.map(([from, to]) => ({
                        fromTitle: from,
                        toTitle: to,
                      }))
                    : [
                        { fromTitle: "Write caption", toTitle: "Design carousel" },
                        { fromTitle: "Design carousel", toTitle: "Review" },
                        { fromTitle: "Review", toTitle: "Approve" },
                        { fromTitle: "Approve", toTitle: "Schedule" },
                        { fromTitle: "Schedule", toTitle: "Publish" },
                      ],
              }
            : mode === "workload"
              ? {
                  ok: true,
                  workload: {
                    dailyMinutes: 240,
                    weeklyMinutes: 1200,
                    overloaded: [
                      lang === "fa"
                        ? "مالک با ۳ وظیفه فوری"
                        : "Owner with 3 urgent tasks",
                    ],
                    free: [
                      lang === "fa" ? "پنجره بعدازظهر باز است" : "Afternoon window open",
                    ],
                    redistribution: [
                      lang === "fa"
                        ? "یک وظیفه طراحی را به فردا صبح منتقل کنید"
                        : "Move one design task to tomorrow morning",
                    ],
                    note: lang === "fa" ? taskAssistFa.workloadNote : undefined,
                  },
                }
              : mode === "order"
                ? { ok: true, order: taskIds, note: lang === "fa" ? taskAssistFa.orderNote : undefined }
                : mode === "blockers"
                  ? {
                      ok: true,
                      blockers: taskIds.map((id) => ({
                        taskId: id,
                        reason:
                          lang === "fa"
                            ? "در انتظار تأیید بالادستی"
                            : "Waiting on upstream approval",
                      })),
                      note: lang === "fa" ? taskAssistFa.blockersNote : undefined,
                    }
                  : mode === "estimate"
                    ? {
                        ok: true,
                        estimates: taskIds.map((id, i) => ({
                          taskId: id,
                          estimatedMinutes: 45 + i * 15,
                          dueInDays: 1 + i,
                        })),
                        note: lang === "fa" ? taskAssistFa.estimateNote : undefined,
                      }
                    : {
                        ok: true,
                        nextActions: taskIds.map((id) => ({
                          taskId: id,
                          action:
                            lang === "fa"
                              ? taskAssistFa.nextAction
                              : "Start the first unfinished subtask today",
                        })),
                      };
        const content = JSON.stringify(payload, null, 2);
        return {
          content,
          finishReason: "stop",
          promptTokens: Math.ceil(JSON.stringify(req.messages).length / 4),
          completionTokens: Math.ceil(content.length / 4),
          raw: { mock: true, task: "task.assist" },
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
