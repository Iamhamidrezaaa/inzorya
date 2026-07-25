import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { OutputFormat } from "@/server/ai/config";
import type { ContextProviderKey } from "@/server/ai/context/engine";

export type TaskDefinition = {
  key: string;
  name: string;
  description: string;
  category: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  outputFormat: OutputFormat;
  promptKey: string;
  contextProviders: ContextProviderKey[];
  requiredOutputKeys?: string[];
  priority?: number;
  timeoutMs?: number;
  maxRetries?: number;
  defaultModelKey?: string;
};

export const PLATFORM_TASKS: TaskDefinition[] = [
  {
    key: "platform.echo",
    name: "Platform Echo",
    description: "Developer task — echoes input through the AI platform.",
    category: "platform",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: { text: { type: "string" } },
    },
    outputSchema: {
      type: "object",
      required: ["ok", "summary"],
      properties: {
        ok: { type: "boolean" },
        summary: { type: "string" },
        echo: { type: "string" },
      },
    },
    outputFormat: "json",
    promptKey: "platform.echo",
    contextProviders: ["brand_voice"],
    requiredOutputKeys: ["ok", "summary"],
    priority: 10,
  },
  {
    key: "platform.inspect_context",
    name: "Inspect Context",
    description: "Returns composed context for debugging.",
    category: "platform",
    inputSchema: {
      type: "object",
      properties: { note: { type: "string" } },
    },
    outputSchema: {
      type: "object",
      required: ["ok", "summary"],
      properties: { ok: { type: "boolean" }, summary: { type: "string" } },
    },
    outputFormat: "json",
    promptKey: "platform.inspect_context",
    contextProviders: [
      "business_brain",
      "brand_voice",
      "connected_channels",
      "analytics_summary",
    ],
    requiredOutputKeys: ["ok", "summary"],
  },
  // Registered task shapes for future product features — not exposed as product UI.
  {
    key: "content.generate_caption",
    name: "Generate Caption",
    description: "Future task contract — not exposed this sprint.",
    category: "content",
    inputSchema: { type: "object", properties: { brief: { type: "string" } } },
    outputSchema: { type: "object", properties: { caption: { type: "string" } } },
    outputFormat: "json",
    promptKey: "content.generate_caption",
    contextProviders: ["brand_voice", "content_history"],
    requiredOutputKeys: ["ok"],
  },
  {
    key: "campaign.generate",
    name: "Generate Campaign",
    description: "Future task contract — not exposed this sprint.",
    category: "campaign",
    inputSchema: { type: "object", properties: { goal: { type: "string" } } },
    outputSchema: { type: "object", properties: { outline: { type: "string" } } },
    outputFormat: "json",
    promptKey: "campaign.generate",
    contextProviders: ["marketing_strategy", "brand_voice"],
  },
  {
    key: "conversation.analyze",
    name: "Analyze Conversation",
    description: "Future task contract — not exposed this sprint.",
    category: "conversation",
    inputSchema: { type: "object", properties: { conversationId: { type: "string" } } },
    outputSchema: { type: "object", properties: { summary: { type: "string" } } },
    outputFormat: "json",
    promptKey: "conversation.analyze",
    contextProviders: ["conversation", "customer"],
  },
  {
    key: "analytics.summarize",
    name: "Summarize Analytics",
    description: "Future task contract — not exposed this sprint.",
    category: "analytics",
    inputSchema: { type: "object", properties: { range: { type: "string" } } },
    outputSchema: { type: "object", properties: { summary: { type: "string" } } },
    outputFormat: "json",
    promptKey: "analytics.summarize",
    contextProviders: ["analytics_summary"],
  },
  {
    key: "lead.classify",
    name: "Classify Lead",
    description: "Future task contract — not exposed this sprint.",
    category: "crm",
    inputSchema: { type: "object", properties: { contactId: { type: "string" } } },
    outputSchema: { type: "object", properties: { label: { type: "string" } } },
    outputFormat: "json",
    promptKey: "lead.classify",
    contextProviders: ["customer"],
  },
  {
    key: "text.rewrite",
    name: "Rewrite Text",
    description: "Future task contract — not exposed this sprint.",
    category: "writing",
    inputSchema: { type: "object", properties: { text: { type: "string" } } },
    outputSchema: { type: "object", properties: { text: { type: "string" } } },
    outputFormat: "json",
    promptKey: "text.rewrite",
    contextProviders: ["brand_voice"],
  },
  {
    key: "strategist.advise",
    name: "Marketing Strategist Advise",
    description: "Senior marketing strategist advice grounded in business context.",
    category: "strategist",
    inputSchema: {
      type: "object",
      required: ["question"],
      properties: {
        question: { type: "string" },
        conversationType: { type: "string" },
        followUpKind: { type: "string" },
        priorSummary: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["ok", "executiveSummary", "findings", "recommendations", "actionItems"],
      properties: {
        ok: { type: "boolean" },
        executiveSummary: { type: "string" },
        findings: { type: "array" },
        reasoning: { type: "string" },
        recommendations: { type: "array" },
        risks: { type: "array" },
        expectedImpact: { type: "string" },
        actionItems: { type: "array" },
        confidence: { type: "number" },
      },
    },
    outputFormat: "json",
    promptKey: "strategist.advise",
    contextProviders: [
      "business_brain",
      "brand_voice",
      "marketing_strategy",
      "campaign",
      "analytics_summary",
      "knowledge_base",
      "connected_channels",
      "content_history",
      "customer",
      "conversation",
    ],
    requiredOutputKeys: [
      "ok",
      "executiveSummary",
      "findings",
      "recommendations",
      "actionItems",
    ],
    priority: 80,
    timeoutMs: 45_000,
  },
  {
    key: "planner.generate",
    name: "Content Plan Generate",
    description: "Strategic publishing plan — titles and slots only, never captions or scripts.",
    category: "planner",
    inputSchema: {
      type: "object",
      required: ["planType", "settings", "startDate", "endDate"],
      properties: {
        planType: { type: "string" },
        settings: { type: "object" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        regenerateItemIds: { type: "array" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["ok", "summary", "items", "insights", "distribution"],
      properties: {
        ok: { type: "boolean" },
        summary: { type: "string" },
        items: { type: "array" },
        insights: { type: "array" },
        distribution: { type: "object" },
        conflicts: { type: "array" },
      },
    },
    outputFormat: "json",
    promptKey: "planner.generate",
    contextProviders: [
      "business_brain",
      "brand_voice",
      "marketing_strategy",
      "campaign",
      "analytics_summary",
      "knowledge_base",
      "connected_channels",
      "content_history",
      "customer",
    ],
    requiredOutputKeys: ["ok", "summary", "items", "insights", "distribution"],
    priority: 85,
    timeoutMs: 60_000,
  },
  {
    key: "creator.generate",
    name: "Content Creator Generate",
    description: "Produce scored content variations grounded in business context.",
    category: "creator",
    inputSchema: {
      type: "object",
      required: ["platform", "objective", "contentType", "variationCount"],
      properties: {
        platform: { type: "string" },
        objective: { type: "string" },
        contentType: { type: "string" },
        variationCount: { type: "number" },
        campaignName: { type: "string" },
        rewriteStyle: { type: "string" },
        sourceVariation: { type: "object" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["ok", "variations", "qualityFlags"],
      properties: {
        ok: { type: "boolean" },
        title: { type: "string" },
        variations: { type: "array" },
        qualityFlags: { type: "array" },
      },
    },
    outputFormat: "json",
    promptKey: "creator.generate",
    contextProviders: [
      "business_brain",
      "brand_voice",
      "marketing_strategy",
      "campaign",
      "analytics_summary",
      "knowledge_base",
      "content_history",
      "connected_channels",
      "customer",
    ],
    requiredOutputKeys: ["ok", "variations", "qualityFlags"],
    priority: 90,
    timeoutMs: 60_000,
  },
  {
    key: "opportunity.match",
    name: "Opportunity Match",
    description: "Match marketing events to business context and score opportunities.",
    category: "opportunity",
    inputSchema: {
      type: "object",
      required: ["events", "planningMode"],
      properties: {
        events: { type: "array" },
        planningMode: { type: "string" },
        constraints: { type: "object" },
        learningSignals: { type: "object" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["ok", "matches"],
      properties: {
        ok: { type: "boolean" },
        matches: { type: "array" },
      },
    },
    outputFormat: "json",
    promptKey: "opportunity.match",
    contextProviders: [
      "business_brain",
      "brand_voice",
      "marketing_strategy",
      "campaign",
      "analytics_summary",
      "content_history",
      "connected_channels",
      "customer",
      "knowledge_base",
    ],
    requiredOutputKeys: ["ok", "matches"],
    priority: 88,
    timeoutMs: 60_000,
  },
];

export async function ensureAITasks() {
  for (const task of PLATFORM_TASKS) {
    await prisma.aITask.upsert({
      where: { key: task.key },
      create: {
        key: task.key,
        name: task.name,
        description: task.description,
        category: task.category,
        inputSchema: task.inputSchema as Prisma.InputJsonValue,
        outputSchema: task.outputSchema as Prisma.InputJsonValue,
        outputFormat: task.outputFormat,
        promptKey: task.promptKey,
        priority: task.priority || 50,
        timeoutMs: task.timeoutMs || 30_000,
        maxRetries: task.maxRetries || 2,
        defaultModelKey: task.defaultModelKey || "mock-general",
        status: "active",
        meta: { contextProviders: task.contextProviders } as Prisma.InputJsonValue,
      },
      update: {
        name: task.name,
        description: task.description,
        inputSchema: task.inputSchema as Prisma.InputJsonValue,
        outputSchema: task.outputSchema as Prisma.InputJsonValue,
        meta: { contextProviders: task.contextProviders } as Prisma.InputJsonValue,
      },
    });
  }
}

export function getTaskDefinition(key: string) {
  return PLATFORM_TASKS.find((t) => t.key === key);
}
