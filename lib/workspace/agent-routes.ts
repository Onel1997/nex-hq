import type { AgentId } from "@/lib/constants/agents";
import { AGENT_CATALOG } from "@/lib/constants/agents";

/** Route slug per agent — designer maps to /agents/design */
export const AGENT_WORKSPACE_ROUTES: Record<AgentId, string> = {
  ceo: "/agents/ceo",
  research: "/agents/research",
  designer: "/agents/design",
  content: "/agents/content",
  image: "/agents/image",
  marketing: "/agents/marketing",
  shopify: "/agents/shopify",
};

export const AGENT_STUDIO_NAMES: Record<AgentId, string> = {
  ceo: "CEO Command",
  research: "Research Studio",
  designer: "Design Studio",
  content: "Content Studio",
  image: "Image Studio",
  marketing: "Marketing Center",
  shopify: "Shopify Operations",
};

export interface StudioSection {
  id: string;
  label: string;
}

export const AGENT_STUDIO_SECTIONS: Record<AgentId, StudioSection[]> = {
  image: [
    { id: "campaigns", label: "Active Campaigns" },
    { id: "product", label: "Product Assets" },
    { id: "editorial", label: "Editorial Assets" },
    { id: "social", label: "Social Assets" },
    { id: "lookbooks", label: "Lookbooks" },
    { id: "generated", label: "Generated Images" },
  ],
  content: [
    { id: "instagram", label: "Instagram Posts" },
    { id: "reels", label: "Reels" },
    { id: "tiktok", label: "TikTok Hooks" },
    { id: "stories", label: "Story Slides" },
    { id: "product-copy", label: "Product Copy" },
    { id: "campaign-copy", label: "Campaign Copy" },
  ],
  designer: [
    { id: "collection", label: "Collection" },
    { id: "products", label: "Products" },
    { id: "palette", label: "Color Palette" },
    { id: "materials", label: "Materials" },
    { id: "moodboard", label: "Mood Board" },
    { id: "story", label: "Collection Story" },
  ],
  research: [
    { id: "trends", label: "Trends" },
    { id: "competitors", label: "Competitors" },
    { id: "insights", label: "Market Insights" },
    { id: "reports", label: "Reports" },
    { id: "signals", label: "Opportunity Signals" },
  ],
  marketing: [
    { id: "campaigns", label: "Campaigns" },
    { id: "launches", label: "Launch Plans" },
    { id: "audience", label: "Target Audience" },
    { id: "priorities", label: "Product Priorities" },
  ],
  shopify: [
    { id: "products", label: "Products" },
    { id: "collections", label: "Collections" },
    { id: "categories", label: "Categories" },
    { id: "inventory", label: "Inventory" },
    { id: "pricing", label: "Price Analysis" },
  ],
  ceo: [
    { id: "missions", label: "Missions" },
    { id: "recommendations", label: "Recommendations" },
    { id: "strategy", label: "Strategy" },
    { id: "decisions", label: "Decisions" },
    { id: "health", label: "Business Health" },
  ],
};

export function getAgentWorkspaceRoute(agentId: AgentId): string {
  return AGENT_WORKSPACE_ROUTES[agentId];
}

export function getAgentStudioName(agentId: AgentId): string {
  return AGENT_STUDIO_NAMES[agentId];
}

export function getAgentFromWorkspacePath(pathname: string): AgentId | null {
  for (const [id, route] of Object.entries(AGENT_WORKSPACE_ROUTES)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return id as AgentId;
    }
  }
  return null;
}

export const COMMERCE_LAB_ROUTE = "/agents/commerce";

export function isCommerceLabPath(pathname: string): boolean {
  return pathname === COMMERCE_LAB_ROUTE || pathname.startsWith(`${COMMERCE_LAB_ROUTE}/`);
}

export function isAgentWorkspacePath(pathname: string): boolean {
  return getAgentFromWorkspacePath(pathname) !== null || isCommerceLabPath(pathname);
}

export function getAgentLabel(agentId: AgentId): string {
  return AGENT_CATALOG[agentId].name;
}
