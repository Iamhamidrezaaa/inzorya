export const BRAIN_PERSONALITY_TRAITS = [
  "Friendly",
  "Luxury",
  "Professional",
  "Minimal",
  "Playful",
  "Premium",
  "Bold",
  "Modern",
  "Traditional",
] as const;

export const BRAIN_CONTENT_TYPES = [
  "Reels",
  "Carousel",
  "Stories",
  "YouTube",
  "TikTok",
  "Threads",
  "Blog",
  "Newsletter",
] as const;

export const BRAIN_DEFAULT_PILLARS = [
  "Education",
  "Behind The Scenes",
  "Testimonials",
  "Case Studies",
  "Offers",
  "Community",
  "News",
  "Culture",
] as const;

export type BrainInputType =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "multiselect"
  | "chips"
  | "list"
  | "competitors"
  | "pillars"
  | "assets"
  | "colors";

export type BrainQuestionDef = {
  key: string;
  groupKey: string;
  groupLabel: string;
  prompt: string;
  helpText: string;
  inputType: BrainInputType;
  options?: string[];
  estimatedSeconds: number;
  required?: boolean;
};

export const BRAIN_GROUPS = [
  { key: "brand", label: "Brand", minutes: 3 },
  { key: "products", label: "Products", minutes: 3 },
  { key: "audience", label: "Audience", minutes: 5 },
  { key: "personality", label: "Personality", minutes: 2 },
  { key: "communication", label: "Communication", minutes: 3 },
  { key: "marketing", label: "Marketing", minutes: 3 },
  { key: "competitors", label: "Competitors", minutes: 3 },
  { key: "content", label: "Content", minutes: 2 },
  { key: "pillars", label: "Pillars", minutes: 2 },
  { key: "assets", label: "Assets", minutes: 2 },
] as const;

export const BRAIN_QUESTIONS: BrainQuestionDef[] = [
  // Brand
  {
    key: "brand.name",
    groupKey: "brand",
    groupLabel: "Brand",
    prompt: "What is your brand name?",
    helpText: "The name customers recognize you by.",
    inputType: "text",
    estimatedSeconds: 20,
    required: true,
  },
  {
    key: "brand.website",
    groupKey: "brand",
    groupLabel: "Brand",
    prompt: "Do you have a website?",
    helpText: "Paste the full URL if you have one.",
    inputType: "url",
    estimatedSeconds: 25,
  },
  {
    key: "brand.logo",
    groupKey: "brand",
    groupLabel: "Brand",
    prompt: "Want to upload your logo?",
    helpText: "Optional for now — you can add it later in Assets.",
    inputType: "assets",
    estimatedSeconds: 40,
  },
  {
    key: "brand.industry",
    groupKey: "brand",
    groupLabel: "Brand",
    prompt: "What industry are you in?",
    helpText: "E.g. coffee, SaaS, fashion, clinics.",
    inputType: "text",
    estimatedSeconds: 25,
    required: true,
  },
  {
    key: "brand.description",
    groupKey: "brand",
    groupLabel: "Brand",
    prompt: "In a few sentences, what does your business do?",
    helpText: "Imagine explaining it to a smart friend over coffee.",
    inputType: "textarea",
    estimatedSeconds: 60,
    required: true,
  },
  {
    key: "brand.years",
    groupKey: "brand",
    groupLabel: "Brand",
    prompt: "How many years have you been in business?",
    helpText: "Approximate is fine.",
    inputType: "number",
    estimatedSeconds: 15,
  },

  // Products
  {
    key: "products.list",
    groupKey: "products",
    groupLabel: "Products",
    prompt: "What products do you sell?",
    helpText: "List the main ones — comma separated is fine.",
    inputType: "textarea",
    estimatedSeconds: 45,
  },
  {
    key: "products.services",
    groupKey: "products",
    groupLabel: "Products",
    prompt: "What services do you offer?",
    helpText: "Skip if you are product-only.",
    inputType: "textarea",
    estimatedSeconds: 40,
  },
  {
    key: "products.pricing",
    groupKey: "products",
    groupLabel: "Products",
    prompt: "What is your typical pricing range?",
    helpText: "E.g. $20–$80, or mid-premium.",
    inputType: "text",
    estimatedSeconds: 25,
  },
  {
    key: "products.bestsellers",
    groupKey: "products",
    groupLabel: "Products",
    prompt: "What are your best sellers?",
    helpText: "The offers that convert most often.",
    inputType: "textarea",
    estimatedSeconds: 35,
  },
  {
    key: "products.usp",
    groupKey: "products",
    groupLabel: "Products",
    prompt: "What makes you different?",
    helpText: "Your unique selling proposition — why customers choose you.",
    inputType: "textarea",
    estimatedSeconds: 50,
    required: true,
  },

  // Audience
  {
    key: "audience.target",
    groupKey: "audience",
    groupLabel: "Audience",
    prompt: "Who is your target audience?",
    helpText: "Describe the people you most want to reach.",
    inputType: "textarea",
    estimatedSeconds: 50,
    required: true,
  },
  {
    key: "audience.ages",
    groupKey: "audience",
    groupLabel: "Audience",
    prompt: "Which age groups matter most?",
    helpText: "Pick all that apply.",
    inputType: "multiselect",
    options: ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+"],
    estimatedSeconds: 25,
  },
  {
    key: "audience.gender",
    groupKey: "audience",
    groupLabel: "Audience",
    prompt: "Any gender focus?",
    helpText: "Or keep it open.",
    inputType: "multiselect",
    options: ["All", "Women", "Men", "Non-binary"],
    estimatedSeconds: 20,
  },
  {
    key: "audience.countries",
    groupKey: "audience",
    groupLabel: "Audience",
    prompt: "Which countries or regions?",
    helpText: "Comma separated is fine.",
    inputType: "chips",
    estimatedSeconds: 30,
  },
  {
    key: "audience.languages",
    groupKey: "audience",
    groupLabel: "Audience",
    prompt: "Which languages should content use?",
    helpText: "E.g. English, Persian.",
    inputType: "chips",
    estimatedSeconds: 25,
  },
  {
    key: "audience.pains",
    groupKey: "audience",
    groupLabel: "Audience",
    prompt: "What pain points do they have?",
    helpText: "Problems your offer helps solve.",
    inputType: "textarea",
    estimatedSeconds: 50,
  },
  {
    key: "audience.motivation",
    groupKey: "audience",
    groupLabel: "Audience",
    prompt: "What motivates them to buy?",
    helpText: "Status, savings, convenience, trust…",
    inputType: "textarea",
    estimatedSeconds: 40,
  },
  {
    key: "audience.questions",
    groupKey: "audience",
    groupLabel: "Audience",
    prompt: "What do customers ask most often?",
    helpText: "Common questions before they purchase.",
    inputType: "textarea",
    estimatedSeconds: 40,
  },
  {
    key: "audience.objections",
    groupKey: "audience",
    groupLabel: "Audience",
    prompt: "What objections stop them?",
    helpText: "Price, trust, timing, competitors…",
    inputType: "textarea",
    estimatedSeconds: 40,
  },

  // Personality
  {
    key: "personality.traits",
    groupKey: "personality",
    groupLabel: "Personality",
    prompt: "Which traits feel like your brand?",
    helpText: "Pick as many as feel true.",
    inputType: "multiselect",
    options: [...BRAIN_PERSONALITY_TRAITS],
    estimatedSeconds: 35,
    required: true,
  },

  // Communication
  {
    key: "communication.tone",
    groupKey: "communication",
    groupLabel: "Communication",
    prompt: "How should your brand sound?",
    helpText: "Tone of voice in one short line.",
    inputType: "text",
    estimatedSeconds: 30,
    required: true,
  },
  {
    key: "communication.emoji",
    groupKey: "communication",
    groupLabel: "Communication",
    prompt: "How do you feel about emojis?",
    helpText: "Never / sparingly / often.",
    inputType: "text",
    estimatedSeconds: 20,
  },
  {
    key: "communication.style",
    groupKey: "communication",
    groupLabel: "Communication",
    prompt: "Describe your writing style.",
    helpText: "Short & punchy, storytelling, educational…",
    inputType: "textarea",
    estimatedSeconds: 35,
  },
  {
    key: "communication.cta",
    groupKey: "communication",
    groupLabel: "Communication",
    prompt: "How do you like to call people to action?",
    helpText: "Soft invite, direct ask, urgency…",
    inputType: "text",
    estimatedSeconds: 30,
  },
  {
    key: "communication.forbidden",
    groupKey: "communication",
    groupLabel: "Communication",
    prompt: "Any words you never want used?",
    helpText: "Comma separated.",
    inputType: "chips",
    estimatedSeconds: 25,
  },
  {
    key: "communication.preferred",
    groupKey: "communication",
    groupLabel: "Communication",
    prompt: "Any words you love to use?",
    helpText: "Comma separated.",
    inputType: "chips",
    estimatedSeconds: 25,
  },

  // Marketing
  {
    key: "marketing.platforms",
    groupKey: "marketing",
    groupLabel: "Marketing",
    prompt: "Where do you show up today?",
    helpText: "Current platforms.",
    inputType: "multiselect",
    options: [
      "Instagram",
      "TikTok",
      "YouTube",
      "LinkedIn",
      "Facebook",
      "X",
      "WhatsApp",
      "Telegram",
      "Email",
    ],
    estimatedSeconds: 30,
  },
  {
    key: "marketing.frequency",
    groupKey: "marketing",
    groupLabel: "Marketing",
    prompt: "How often do you post?",
    helpText: "E.g. 3× per week.",
    inputType: "text",
    estimatedSeconds: 20,
  },
  {
    key: "marketing.goals",
    groupKey: "marketing",
    groupLabel: "Marketing",
    prompt: "What are your marketing goals?",
    helpText: "Sales, leads, awareness, community…",
    inputType: "textarea",
    estimatedSeconds: 40,
  },
  {
    key: "marketing.challenges",
    groupKey: "marketing",
    groupLabel: "Marketing",
    prompt: "What is hardest about marketing right now?",
    helpText: "Be honest — this shapes future recommendations.",
    inputType: "textarea",
    estimatedSeconds: 40,
  },
  {
    key: "marketing.budget",
    groupKey: "marketing",
    groupLabel: "Marketing",
    prompt: "Rough monthly marketing budget?",
    helpText: "Optional. Ranges are fine.",
    inputType: "text",
    estimatedSeconds: 20,
  },
  {
    key: "marketing.team",
    groupKey: "marketing",
    groupLabel: "Marketing",
    prompt: "How big is the marketing team?",
    helpText: "Just you, 2–3 people, agency…",
    inputType: "text",
    estimatedSeconds: 20,
  },

  // Competitors
  {
    key: "competitors.list",
    groupKey: "competitors",
    groupLabel: "Competitors",
    prompt: "Who are your competitors?",
    helpText: "Add a few. Strengths and weaknesses help later.",
    inputType: "competitors",
    estimatedSeconds: 90,
  },

  // Content preferences
  {
    key: "content.types",
    groupKey: "content",
    groupLabel: "Content",
    prompt: "Which content formats do you prefer?",
    helpText: "Pick what you want to lean into.",
    inputType: "multiselect",
    options: [...BRAIN_CONTENT_TYPES],
    estimatedSeconds: 30,
  },

  // Pillars
  {
    key: "pillars.list",
    groupKey: "pillars",
    groupLabel: "Pillars",
    prompt: "What content pillars should you own?",
    helpText: "Themes you’ll return to again and again.",
    inputType: "pillars",
    estimatedSeconds: 60,
  },

  // Assets
  {
    key: "assets.colors",
    groupKey: "assets",
    groupLabel: "Assets",
    prompt: "What are your brand colors?",
    helpText: "Hex codes or names — e.g. #0F172A, teal.",
    inputType: "colors",
    estimatedSeconds: 35,
  },
  {
    key: "assets.fonts",
    groupKey: "assets",
    groupLabel: "Assets",
    prompt: "Any preferred fonts?",
    helpText: "Optional.",
    inputType: "text",
    estimatedSeconds: 25,
  },
  {
    key: "assets.guidelines",
    groupKey: "assets",
    groupLabel: "Assets",
    prompt: "Anything else about brand guidelines?",
    helpText: "Do’s and don’ts for future content.",
    inputType: "textarea",
    estimatedSeconds: 40,
  },
  {
    key: "assets.files",
    groupKey: "assets",
    groupLabel: "Assets",
    prompt: "Upload brand assets",
    helpText: "Logo, guidelines PDF preview images, mood boards.",
    inputType: "assets",
    estimatedSeconds: 60,
  },
];

export function estimateRemainingSeconds(
  fromIndex: number,
  answeredKeys: Set<string>,
) {
  return BRAIN_QUESTIONS.slice(fromIndex).reduce((sum, q) => {
    if (answeredKeys.has(q.key) && q.key !== BRAIN_QUESTIONS[fromIndex]?.key) {
      return sum;
    }
    return sum + q.estimatedSeconds;
  }, 0);
}

export function formatMinutes(seconds: number) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return m === 1 ? "~1 min" : `~${m} min`;
}

export type BrainCompletion = {
  score: number;
  completionPercent: number;
  sectionsCompleted: number;
  sectionsTotal: number;
  missing: { groupKey: string; groupLabel: string; keys: string[] }[];
  recommendations: string[];
  nextAction: { label: string; hrefSuffix: string } | null;
};

export function computeBrainCompletion(input: {
  answersByKey: Record<string, string>;
  traitsCount: number;
  competitorsCount: number;
  pillarsCount: number;
  assetsCount: number;
}): BrainCompletion {
  const required = BRAIN_QUESTIONS.filter((q) => q.required);
  const groups = BRAIN_GROUPS.map((g) => {
    const qs = BRAIN_QUESTIONS.filter((q) => q.groupKey === g.key);
    const filled = qs.filter((q) => {
      if (q.inputType === "competitors") return input.competitorsCount > 0;
      if (q.inputType === "pillars") return input.pillarsCount > 0;
      if (q.inputType === "assets" && q.key === "assets.files")
        return input.assetsCount > 0;
      if (q.inputType === "assets" && q.key === "brand.logo")
        return input.assetsCount > 0 || Boolean(input.answersByKey[q.key]);
      if (q.key === "personality.traits") return input.traitsCount > 0;
      const v = input.answersByKey[q.key]?.trim();
      return Boolean(v) && v !== "[]" && v !== "{}";
    });
    return {
      ...g,
      total: qs.length,
      filled: filled.length,
      missingKeys: qs
        .filter((q) => !filled.some((f) => f.key === q.key))
        .map((q) => q.key),
    };
  });

  const sectionsCompleted = groups.filter((g) => g.filled === g.total).length;
  const totalSlots = BRAIN_QUESTIONS.length;
  const filledSlots = groups.reduce((s, g) => s + g.filled, 0);
  const completionPercent = Math.round((filledSlots / totalSlots) * 100);

  const requiredFilled = required.filter((q) => {
    if (q.key === "personality.traits") return input.traitsCount > 0;
    return Boolean(input.answersByKey[q.key]?.trim());
  }).length;
  const score = Math.round(
    completionPercent * 0.7 + (requiredFilled / Math.max(required.length, 1)) * 30,
  );

  const missing = groups
    .filter((g) => g.missingKeys.length > 0)
    .map((g) => ({
      groupKey: g.key,
      groupLabel: g.label,
      keys: g.missingKeys,
    }));

  const recommendations: string[] = [];
  if (!input.answersByKey["brand.description"]?.trim()) {
    recommendations.push("Add a clear business description — future AI needs this first.");
  }
  if (input.traitsCount === 0) {
    recommendations.push("Choose brand personality traits so tone stays consistent.");
  }
  if (input.competitorsCount === 0) {
    recommendations.push("Add at least one competitor to sharpen positioning.");
  }
  if (input.pillarsCount === 0) {
    recommendations.push("Define content pillars before planning posts.");
  }
  if (input.assetsCount === 0) {
    recommendations.push("Upload a logo so brand assets are ready.");
  }
  if (recommendations.length === 0 && completionPercent < 100) {
    recommendations.push("Finish remaining interview questions to unlock full Brain score.");
  }
  if (completionPercent === 100) {
    recommendations.push("Business Brain is complete. Strategy and content can build on this.");
  }

  const firstMissing = missing[0];
  const nextAction = firstMissing
    ? {
        label: `Continue ${firstMissing.groupLabel}`,
        hrefSuffix: `/brain/interview?group=${firstMissing.groupKey}`,
      }
    : completionPercent < 100
      ? { label: "Resume interview", hrefSuffix: "/brain/interview" }
      : null;

  return {
    score: Math.min(100, score),
    completionPercent,
    sectionsCompleted,
    sectionsTotal: BRAIN_GROUPS.length,
    missing,
    recommendations: recommendations.slice(0, 4),
    nextAction,
  };
}
