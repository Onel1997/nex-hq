import {
  AGENT_IDS,
  type AgentDefinition,
  type AgentId,
  type AgentStatus,
} from "@/lib/constants/agents";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";

export function getAgentStatusLabels(
  locale: Locale,
): Record<AgentStatus, string> {
  const { common } = getDictionary(locale);
  return {
    active: common.status.active,
    planned: common.status.planned,
  };
}

export function getAgentCatalog(
  locale: Locale,
): Record<AgentId, AgentDefinition> {
  const dict = getDictionary(locale);

  return Object.fromEntries(
    AGENT_IDS.map((id) => {
      const entry = dict.agents.catalog[id];
      const base = {
        id,
        reportsTo:
          id === "ceo"
            ? ("human" as const)
            : ("ceo" as const),
        status: (id === "ceo" ||
          id === "research" ||
          id === "designer" ||
          id === "marketing" ||
          id === "shopify" ||
          id === "content" ||
          id === "image"
          ? "active"
          : "planned") as AgentStatus,
        icon: {
          ceo: "crown",
          research: "search",
          designer: "palette",
          content: "pen-line",
          image: "wand",
          marketing: "megaphone",
          shopify: "shopping-bag",
        }[id],
      };

      return [
        id,
        {
          ...base,
          name: entry.name,
          role: entry.role,
          description: entry.description,
          capabilities: [...entry.capabilities],
          responsibilities: [...entry.responsibilities],
        } satisfies AgentDefinition,
      ];
    }),
  ) as Record<AgentId, AgentDefinition>;
}
