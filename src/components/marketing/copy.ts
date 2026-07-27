/** English-first landing copy (Persian pass later). */

export const landingCopy = {
  brand: "Inzorya",
  getInzorya: "Get Inzorya",
  signIn: "Sign in",
  nav: [
    { label: "Product", href: "#product" },
    { label: "Platform", href: "#platform" },
    { label: "Intelligence", href: "#intelligence" },
    { label: "Resources", href: "#resources" },
  ],
  hero: {
    headline: "Unforgettable campaigns start with insight.",
    subhead:
      "An AI Marketing Operating System that knows your brand, finds the moment, plans the work, and ships the content.",
    ctaPrimary: "Start free",
    ctaSecondary: "See how it works",
  },
  trusted: {
    title: "Built for teams that treat marketing like a system",
    logos: [
      "Retail",
      "F&B",
      "Beauty",
      "SaaS",
      "Agencies",
      "E-commerce",
      "Hospitality",
      "Local brands",
    ],
  },
  products: {
    title: "Go big. We've got you.",
    subtitle: "How brands grow with Inzorya.",
    tabs: [
      {
        id: "strategist",
        label: "AI Marketing Strategist",
        title: "AI Marketing Strategist",
        body: "Ask why this campaign, audience, channel, CTA, or timing — grounded in Business Brain.",
        bullets: [
          "Strategy from brand context",
          "Clear recommendations with rationale",
          "Aligned to goals and constraints",
          "Ready for planning handoff",
        ],
      },
      {
        id: "planner",
        label: "Planner + Creator",
        title: "Content Planner & Creator",
        body: "Turn strategy into calendars, variations, and on-brand copy across platforms.",
        bullets: [
          "Channel-aware planning",
          "Multi-variation generation",
          "Brand voice consistency",
          "Review-ready drafts",
        ],
      },
      {
        id: "opportunity",
        label: "Opportunity Engine",
        title: "Opportunity & Event Intelligence",
        body: "Surface the moments worth acting on — before you publish.",
        bullets: [
          "Global marketing event database",
          "Brand-fit opportunity matching",
          "Campaign recommendations",
          "Preparation windows that matter",
        ],
      },
      {
        id: "graph",
        label: "Knowledge Graph",
        title: "Knowledge Graph & Business Brain",
        body: "Industry, product, audience, season, and tone — structured so AI never starts blank.",
        bullets: [
          "Structured brand memory",
          "Industry and audience links",
          "Season and event context",
          "Every agent shares the same truth",
        ],
      },
    ],
  },
  platformLine: {
    prefix: "The AI Marketing Operating System powered by real",
    words: ["business", "context", "opportunity", "decision"],
    suffix: "intelligence.",
  },
  stats: {
    title: "The signal is real.",
    items: [
      { value: "8+", label: "brand context layers every recommendation uses" },
      { value: "4", label: "AI teammates in one operating loop today" },
      { value: "90d", label: "opportunity horizon for upcoming moments" },
      { value: "1", label: "shared Business Brain across strategist to creator" },
    ],
  },
  ai: {
    title: "Other brands are guessing. You don’t have to.",
    body: "Inzorya reads industry, product, audience, goals, tone, geography, seasonality, and events — so campaigns are built with confidence, not generic prompts.",
    cta: "Explore intelligence",
  },
  pipeline: {
    title: "The team behind your best campaigns.",
    body: "AI teammates that hand work to each other — strategy to plan to content to community.",
    steps: [
      { title: "Strategist", body: "Decide what deserves attention." },
      { title: "Planner", body: "Turn decisions into a calendar." },
      { title: "Creator", body: "Generate on-brand variations." },
      { title: "Community", body: "Prioritize replies that matter." },
    ],
  },
  work: {
    title: "What teams unlock",
    items: [
      {
        name: "Campaign clarity",
        quote:
          "We stopped drafting from a blank page. Every brief already knew the audience, offer, and why now.",
        role: "Growth lead · Retail brand",
        metrics: [
          { value: "3×", label: "faster brief cycles" },
          { value: "1", label: "shared brand brain" },
        ],
      },
      {
        name: "Moment readiness",
        quote:
          "Event intelligence flagged windows we used to miss — and the plan was ready before the peak.",
        role: "Marketing manager · F&B",
        metrics: [
          { value: "90d", label: "horizon scanned" },
          { value: "2w", label: "prep lead time" },
        ],
      },
      {
        name: "On-brand output",
        quote:
          "Creator variations felt like our voice because Business Brain was already in the loop.",
        role: "Brand designer · DTC",
        metrics: [
          { value: "10", label: "variations / run" },
          { value: "0", label: "blank prompts" },
        ],
      },
    ],
  },
  resources: {
    title: "The latest from Inzorya.",
    cards: [
      {
        kind: "Guide",
        title: "How an AI Marketing OS replaces scattered tools",
      },
      {
        kind: "Playbook",
        title: "From opportunity match to published campaign",
      },
      {
        kind: "Insight",
        title: "Why brand context beats generic AI captions",
      },
    ],
  },
  closing: {
    title: "When you get it right, it's impossible to ignore.",
    cta: "Start free",
  },
  footer: {
    columns: [
      {
        title: "Product",
        links: ["Strategist", "Planner", "Creator", "Opportunities", "Knowledge Graph"],
      },
      {
        title: "Platform",
        links: ["Business Brain", "Calendar", "Channels", "Work Engine"],
      },
      {
        title: "Company",
        links: ["About", "Careers", "Contact"],
      },
      {
        title: "Legal",
        links: ["Terms", "Privacy"],
      },
    ],
    rights: "© 2026 Inzorya. All rights reserved.",
  },
} as const;
