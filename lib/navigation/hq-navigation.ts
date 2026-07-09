import { AGENT_IDS, type AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import {
  FACILITY_ROUTES,
  FACILITY_WINGS,
} from "@/lib/facility/facility-routes";
import {
  AGENT_STUDIO_NAMES,
  AGENT_WORKSPACE_ROUTES,
  COMMERCE_LAB_ROUTE,
  getAgentFromWorkspacePath,
  isCommerceLabPath,
} from "@/lib/workspace/agent-routes";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Brain,
  Building2,
  ClipboardList,
  Crown,
  FileText,
  Home,
  Megaphone,
  Palette,
  PenLine,
  Search,
  Settings,
  ShoppingBag,
  Target,
  Wand2,
  BookOpen,
} from "lucide-react";

export type HqSectionId =
  | "facility"
  | "agents"
  | "missions"
  | "reports"
  | "knowledge"
  | "settings";

export const HQ_SECTION_LABELS: Record<HqSectionId, string> = {
  facility: "Facility",
  agents: "Agents",
  missions: "Mission Control",
  reports: "Reports",
  knowledge: "Knowledge Vault",
  settings: "Settings",
};

export interface ContextNavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  accent?: string;
  isActive?: (pathname: string) => boolean;
}

const AGENT_ICONS: Record<AgentId, LucideIcon> = {
  ceo: Crown,
  research: Search,
  designer: Palette,
  content: PenLine,
  image: Wand2,
  marketing: Megaphone,
  shopify: ShoppingBag,
};

const COMMERCE_LAB_COLOR = "#F97316";

export function resolveHqSection(pathname: string): HqSectionId {
  if (pathname.startsWith(FACILITY_ROUTES.settings)) return "settings";
  if (
    pathname.startsWith(FACILITY_ROUTES.missions) ||
    pathname.startsWith("/tasks")
  ) {
    return "missions";
  }
  if (
    pathname.startsWith(FACILITY_ROUTES.reports) ||
    pathname.startsWith("/reports")
  ) {
    return "reports";
  }
  if (
    pathname.startsWith(FACILITY_ROUTES.knowledge) ||
    pathname.startsWith(FACILITY_ROUTES.brain) ||
    pathname.startsWith("/brain")
  ) {
    return "knowledge";
  }
  if (
    pathname.startsWith(FACILITY_ROUTES.agents) ||
    pathname.startsWith("/agents")
  ) {
    return "agents";
  }
  return "facility";
}

export function getContextNavItems(section: HqSectionId): ContextNavItem[] {
  switch (section) {
    case "agents":
      return [
        ...AGENT_IDS.map((id) => ({
          id,
          href: AGENT_WORKSPACE_ROUTES[id],
          label: AGENT_STUDIO_NAMES[id],
          icon: AGENT_ICONS[id],
          accent: getAgentColor(id),
          isActive: (pathname: string) =>
            pathname === AGENT_WORKSPACE_ROUTES[id] ||
            pathname.startsWith(`${AGENT_WORKSPACE_ROUTES[id]}/`),
        })),
        {
          id: "commerce",
          href: COMMERCE_LAB_ROUTE,
          label: "Commerce Lab",
          icon: BarChart3,
          accent: COMMERCE_LAB_COLOR,
          isActive: (pathname: string) => isCommerceLabPath(pathname),
        },
      ];
    case "missions":
      return [
        {
          id: "missions",
          href: FACILITY_ROUTES.missions,
          label: "Mission Control",
          icon: Target,
          isActive: (pathname: string) =>
            pathname.startsWith(FACILITY_ROUTES.missions) ||
            pathname.startsWith("/tasks"),
        },
        {
          id: "tasks",
          href: FACILITY_ROUTES.tasks,
          label: "Task Queue",
          icon: ClipboardList,
          isActive: (pathname: string) => pathname.startsWith("/tasks"),
        },
      ];
    case "reports":
      return [
        {
          id: "reports-center",
          href: FACILITY_ROUTES.reports,
          label: "Reports Center",
          icon: FileText,
          isActive: (pathname: string) =>
            pathname.startsWith(FACILITY_ROUTES.reports) ||
            pathname.startsWith("/reports"),
        },
      ];
    case "knowledge":
      return [
        {
          id: "knowledge-vault",
          href: FACILITY_ROUTES.knowledge,
          label: "Knowledge Vault",
          icon: BookOpen,
          isActive: (pathname: string) =>
            pathname.startsWith(FACILITY_ROUTES.knowledge),
        },
        {
          id: "brain-core",
          href: FACILITY_ROUTES.brain,
          label: "Brain Core",
          icon: Brain,
          isActive: (pathname: string) =>
            pathname.startsWith(FACILITY_ROUTES.brain) ||
            pathname.startsWith("/brain"),
        },
      ];
    case "settings":
      return [
        {
          id: "settings",
          href: FACILITY_ROUTES.settings,
          label: "General",
          icon: Settings,
          isActive: (pathname: string) =>
            pathname.startsWith(FACILITY_ROUTES.settings),
        },
      ];
    case "facility":
    default:
      return [
        {
          id: "overview",
          href: FACILITY_ROUTES.home,
          label: "Command Center",
          icon: Home,
          isActive: (pathname: string) => pathname === "/",
        },
        ...FACILITY_WINGS.filter((wing) => wing.href != null).map((wing) => ({
          id: wing.id,
          href: wing.href!,
          label: wing.label,
          icon: wingIcon(wing.id),
          isActive: (pathname: string) =>
            pathname === wing.href || pathname.startsWith(`${wing.href}/`),
        })),
      ];
  }
}

function wingIcon(
  id: (typeof FACILITY_WINGS)[number]["id"],
): LucideIcon {
  const map: Record<(typeof FACILITY_WINGS)[number]["id"], LucideIcon> = {
    agents: Bot,
    "mission-control": Target,
    reports: FileText,
    knowledge: BookOpen,
    "brain-core": Brain,
    analytics: BarChart3,
  };
  return map[id];
}

export function resolveContextNavActiveItem(
  pathname: string,
  items: ContextNavItem[],
): ContextNavItem | null {
  for (const item of items) {
    if (item.isActive?.(pathname)) return item;
  }
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return item;
    }
  }
  return null;
}

export function resolveAgentNavActiveId(
  pathname: string,
): AgentId | "commerce" | null {
  if (isCommerceLabPath(pathname)) return "commerce";
  return getAgentFromWorkspacePath(pathname);
}

/** Level 1 rail — icon mapping aligned with HQ sections */
export const HQ_RAIL_ITEMS = [
  { id: "facility" as const, href: FACILITY_ROUTES.home, icon: Building2, label: "Facility" },
  { id: "agents" as const, href: FACILITY_ROUTES.agents, icon: Bot, label: "Agents" },
  { id: "missions" as const, href: FACILITY_ROUTES.missions, icon: Target, label: "Mission Control" },
  { id: "reports" as const, href: FACILITY_ROUTES.reports, icon: FileText, label: "Reports" },
  { id: "knowledge" as const, href: FACILITY_ROUTES.knowledge, icon: BookOpen, label: "Knowledge Vault" },
  { id: "settings" as const, href: FACILITY_ROUTES.settings, icon: Settings, label: "Settings" },
] as const;

export function isHqRailItemActive(
  item: (typeof HQ_RAIL_ITEMS)[number],
  pathname: string,
): boolean {
  const section = resolveHqSection(pathname);
  return item.id === section;
}

/** Agent Wing dashboard — hide level-2 nav; cards replace the agent list. */
export function isAgentWingOverviewPath(pathname: string): boolean {
  return pathname === FACILITY_ROUTES.agents;
}

export function shouldShowContextSidebar(pathname: string): boolean {
  return !isAgentWingOverviewPath(pathname);
}
