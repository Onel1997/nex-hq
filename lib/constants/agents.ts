export const AGENT_IDS = [
  "ceo",
  "research",
  "designer",
  "content",
  "marketing",
  "shopify",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export type AgentStatus = "active" | "planned";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  reportsTo: AgentId | "human";
  description: string;
  status: AgentStatus;
  icon: string;
  capabilities: string[];
  responsibilities: string[];
}

export const AGENT_CATALOG: Record<AgentId, AgentDefinition> = {
  ceo: {
    id: "ceo",
    name: "CEO Agent",
    role: "Master Orchestrator",
    reportsTo: "human",
    description:
      "Central intelligence that decomposes brand goals, routes work to specialists, and synthesizes outputs for human approval.",
    status: "active",
    icon: "crown",
    capabilities: [
      "Goal decomposition",
      "Task routing",
      "Report synthesis",
      "Escalation management",
      "Brain context retrieval",
    ],
    responsibilities: [
      "Translate founder intent into executable task queues",
      "Maintain coherence across all agent outputs",
      "Surface trade-offs requiring human judgment",
      "Orchestrate drop and campaign workflows end-to-end",
    ],
  },
  research: {
    id: "research",
    name: "Research Agent",
    role: "Market Intelligence",
    reportsTo: "ceo",
    description:
      "Cultural radar for streetwear — tracks trends, competitors, and drop opportunities before they peak.",
    status: "planned",
    icon: "search",
    capabilities: [
      "Trend scanning",
      "Competitor analysis",
      "Drop timing signals",
      "Audience insight reports",
    ],
    responsibilities: [
      "Monitor streetwear and culture signals weekly",
      "Produce trend briefs for upcoming drops",
      "Feed competitive intelligence into Milaene Brain",
      "Recommend positioning based on market gaps",
    ],
  },
  designer: {
    id: "designer",
    name: "Designer Agent",
    role: "Visual Design",
    reportsTo: "ceo",
    description:
      "Visual ideation engine aligned to Milaene design rules — concepts, mood boards, and asset direction.",
    status: "planned",
    icon: "palette",
    capabilities: [
      "Mood board generation",
      "Color palette proposals",
      "Layout direction",
      "Asset brief creation",
    ],
    responsibilities: [
      "Generate design concepts per drop capsule",
      "Enforce Milaene design rules from Brain",
      "Prepare review-ready visual directions",
      "Archive approved design history to Brain",
    ],
  },
  content: {
    id: "content",
    name: "Content Agent",
    role: "Copy & Storytelling",
    reportsTo: "ceo",
    description:
      "Brand voice guardian — product copy, drop narratives, and channel-specific messaging.",
    status: "planned",
    icon: "pen-line",
    capabilities: [
      "Product descriptions",
      "Drop announcements",
      "Social copy variants",
      "Email & SMS drafts",
    ],
    responsibilities: [
      "Write on-brand copy for every product and drop",
      "Adapt messaging per channel (IG, site, email)",
      "Maintain voice consistency via Brain templates",
      "Submit copy for human approval before publish",
    ],
  },
  marketing: {
    id: "marketing",
    name: "Marketing Agent",
    role: "Campaign Planning",
    reportsTo: "ceo",
    description:
      "Growth strategist — campaign calendars, channel mix, and launch sequences for every drop.",
    status: "planned",
    icon: "megaphone",
    capabilities: [
      "Campaign planning",
      "Channel mix optimization",
      "Launch sequencing",
      "Ad copy briefs",
    ],
    responsibilities: [
      "Build campaign calendars aligned to drop schedule",
      "Coordinate timing with Research and Content agents",
      "Draft paid and organic growth briefs",
      "Track campaign metadata in Milaene Brain",
    ],
  },
  shopify: {
    id: "shopify",
    name: "Shopify Agent",
    role: "Commerce Operations",
    reportsTo: "ceo",
    description:
      "Storefront operator — listings, collections, inventory sync, and commerce health monitoring.",
    status: "planned",
    icon: "shopping-bag",
    capabilities: [
      "Product listing drafts",
      "Collection management",
      "Inventory sync prep",
      "Storefront health checks",
    ],
    responsibilities: [
      "Prepare Shopify listings from approved Brain assets",
      "Sync product state between Brain and storefront",
      "Flag inventory and listing anomalies",
      "Execute publishes only after human approval",
    ],
  },
};

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  active: "Active",
  planned: "Planned",
};

export const SPECIALIST_AGENT_IDS = AGENT_IDS.filter(
  (id): id is Exclude<AgentId, "ceo"> => id !== "ceo",
);
