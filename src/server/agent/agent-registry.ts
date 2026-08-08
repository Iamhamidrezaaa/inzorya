import { AgentError } from "@/server/agent/errors";
import type { AgentDefinition } from "@/server/agent/types";

/**
 * In-code agent catalog for the foundation layer.
 * Autonomous / marketing agents are intentionally not registered here.
 */
export const FOUNDATION_AGENTS: AgentDefinition[] = [
  {
    id: "system.test",
    name: "System Test Agent",
    version: "1.0.0",
    description:
      "Minimal foundation agent used to verify Agent Runtime → Tool Registry → Executor.",
  },
  {
    id: "marketing.readonly",
    name: "Marketing Intelligence",
    version: "1.0.0",
    description:
      "Read-only marketing analyst that gathers Inzorya evidence via Tools and answers evidence-based questions.",
  },
  {
    id: "trend.intelligence",
    name: "Trend Intelligence",
    version: "1.0.0",
    description:
      "Read-only specialist that finds public research signals, evaluates brand relevance, and returns structured trend intelligence.",
  },
  {
    id: "viral.content.analyst",
    name: "Viral Content Analyst",
    version: "1.0.0",
    description:
      "Read-only specialist that analyzes content and research signals to identify observable effectiveness patterns — analysis and blueprint only.",
  },
];

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  constructor(seed: AgentDefinition[] = FOUNDATION_AGENTS) {
    for (const agent of seed) {
      this.agents.set(agent.id, agent);
    }
  }

  registerAgent(agent: AgentDefinition): void {
    if (this.agents.has(agent.id)) {
      throw new AgentError(
        "AGENT_ALREADY_REGISTERED",
        `Agent already registered: ${agent.id}`,
        { meta: { agentId: agent.id } },
      );
    }
    this.agents.set(agent.id, agent);
  }

  getAgent(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  listAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }
}

let defaultAgentRegistry: AgentRegistry | null = null;

export function getDefaultAgentRegistry(): AgentRegistry {
  if (!defaultAgentRegistry) {
    defaultAgentRegistry = new AgentRegistry();
  }
  return defaultAgentRegistry;
}

export function resetDefaultAgentRegistry(): void {
  defaultAgentRegistry = new AgentRegistry();
}
