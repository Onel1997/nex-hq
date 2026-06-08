import type { AgentId } from "@/lib/constants/agents";

export interface StatusPulse {
  id: string;
  label: string;
  value: string;
  detail: string;
  state: "nominal" | "attention" | "critical";
}

export interface SuggestedAction {
  id: string;
  label: string;
  description: string;
}

export interface AgentLiveStatus {
  id: AgentId;
  status: "active" | "planned";
  currentFocus: string;
  nextTask: string;
  priority: "low" | "medium" | "high" | "urgent";
}

export type IntelligenceType =
  | "trend"
  | "design"
  | "market"
  | "content";

export interface IntelligenceItem {
  id: string;
  type: IntelligenceType;
  title: string;
  insight: string;
  time: string;
  actionable?: boolean;
}

export interface BrainNode {
  id: string;
  label: string;
  entries: number;
  sync: number;
  status: "live" | "syncing" | "draft";
}

export const FOUNDER_NAME = "Silane";

export const STATUS_PULSES: StatusPulse[] = [
  {
    id: "brand-health",
    label: "Brand Health",
    value: "Strong",
    detail: "Voice & visual coherence on track",
    state: "nominal",
  },
  {
    id: "active-projects",
    label: "Active Projects",
    value: "2",
    detail: "SS26 Capsule · VIP Relaunch",
    state: "nominal",
  },
  {
    id: "ai-team",
    label: "AI Team Status",
    value: "Online",
    detail: "CEO active · 5 agents planned",
    state: "nominal",
  },
  {
    id: "alerts",
    label: "Critical Alerts",
    value: "1",
    detail: "Summer drop timeline needs review",
    state: "attention",
  },
];

export const SUGGESTED_ACTIONS: SuggestedAction[] = [
  {
    id: "research-trends",
    label: "Research summer trends",
    description: "Scan culture signals for SS26 positioning",
  },
  {
    id: "capsule-concept",
    label: "Create new capsule concept",
    description: "Generate directions for the next drop",
  },
  {
    id: "review-reports",
    label: "Review latest reports",
    description: "2 intelligence briefs awaiting your input",
  },
  {
    id: "content-plan",
    label: "Generate content plan",
    description: "Build 3-week drop narrative arc",
  },
];

export const AGENT_LIVE_STATUS: AgentLiveStatus[] = [
  {
    id: "ceo",
    status: "active",
    currentFocus: "SS26 capsule orchestration",
    nextTask: "Route research brief to specialist queue",
    priority: "urgent",
  },
  {
    id: "research",
    status: "planned",
    currentFocus: "Awaiting activation",
    nextTask: "Q2 competitor drop analysis",
    priority: "high",
  },
  {
    id: "designer",
    status: "planned",
    currentFocus: "Awaiting activation",
    nextTask: "Hero hoodie mood boards",
    priority: "high",
  },
  {
    id: "content",
    status: "planned",
    currentFocus: "Awaiting activation",
    nextTask: "Drop announcement copy",
    priority: "medium",
  },
  {
    id: "marketing",
    status: "planned",
    currentFocus: "Campaign plan in review",
    nextTask: "VIP email sequence approval",
    priority: "medium",
  },
  {
    id: "shopify",
    status: "planned",
    currentFocus: "Awaiting activation",
    nextTask: "SS26 collection setup",
    priority: "medium",
  },
];

export const INTELLIGENCE_FEED: IntelligenceItem[] = [
  {
    id: "int-1",
    type: "trend",
    title: "Y2K textures trending on TikTok",
    insight:
      "Abstract city-grunge overlays gaining traction — recommend subtle nod in SS26 graphics, not literal retro.",
    time: "12m ago",
    actionable: true,
  },
  {
    id: "int-2",
    type: "design",
    title: "Signal green gaining share in EU drops",
    insight:
      "Corteiz and Represent both used accent greens in recent capsules. Milaene palette already aligned.",
    time: "1h ago",
  },
  {
    id: "int-3",
    type: "market",
    title: "Competitor drop window compressing",
    insight:
      "Top 5 streetwear brands averaging 48hr sell-through windows. Consider tightening SS26 countdown.",
    time: "2h ago",
    actionable: true,
  },
  {
    id: "int-4",
    type: "content",
    title: "VIP open rates above benchmark",
    insight:
      "Last drop email hit 43% open. Audience responds to minimal, insider-tone copy — lean into scarcity language.",
    time: "4h ago",
  },
  {
    id: "int-5",
    type: "trend",
    title: "Oversized silhouettes still dominant",
    insight:
      "Boxy tees and wide-leg cargos remain top sellers across category. SS26 lineup validated.",
    time: "6h ago",
  },
];

export const BRAIN_NODES: BrainNode[] = [
  {
    id: "brand",
    label: "Brand Knowledge",
    entries: 8,
    sync: 100,
    status: "live",
  },
  {
    id: "design",
    label: "Design Memory",
    entries: 6,
    sync: 100,
    status: "live",
  },
  {
    id: "competitor",
    label: "Competitor Intelligence",
    entries: 5,
    sync: 72,
    status: "syncing",
  },
  {
    id: "content",
    label: "Content Intelligence",
    entries: 7,
    sync: 100,
    status: "live",
  },
  {
    id: "marketing",
    label: "Marketing Intelligence",
    entries: 4,
    sync: 88,
    status: "live",
  },
];
