import { AGENT_IDS, type AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import { FACILITY_ROUTES } from "@/lib/facility/facility-routes";
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
  Brain,
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

export type HqSidebarSectionId = "facility" | "agents" | "settings";

export interface SidebarNavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  accent?: string;
  isActive?: (pathname: string) => boolean;
}

export interface HqSidebarSection {
  id: HqSidebarSectionId;
  label: string;
  items: SidebarNavItem[];
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

const FACILITY_ITEMS: SidebarNavItem[] = [
  {
    id: "command-center",
    href: FACILITY_ROUTES.home,
    label: "Command Center",
    icon: Home,
    isActive: (pathname) => pathname === "/",
  },
  {
    id: "mission-control",
    href: FACILITY_ROUTES.missions,
    label: "Mission Control",
    icon: Target,
    isActive: (pathname) =>
      pathname.startsWith(FACILITY_ROUTES.missions) ||
      pathname.startsWith("/tasks"),
  },
  {
    id: "reports-center",
    href: FACILITY_ROUTES.reports,
    label: "Reports Center",
    icon: FileText,
    isActive: (pathname) =>
      pathname.startsWith(FACILITY_ROUTES.reports) ||
      pathname.startsWith("/reports"),
  },
  {
    id: "knowledge-vault",
    href: FACILITY_ROUTES.knowledge,
    label: "Knowledge Vault",
    icon: BookOpen,
    isActive: (pathname) => pathname.startsWith(FACILITY_ROUTES.knowledge),
  },
  {
    id: "brain-core",
    href: FACILITY_ROUTES.brain,
    label: "Brain Core",
    icon: Brain,
    isActive: (pathname) =>
      pathname.startsWith(FACILITY_ROUTES.brain) ||
      pathname.startsWith("/brain"),
  },
  {
    id: "analytics-chamber",
    href: FACILITY_ROUTES.analytics,
    label: "Analytics Chamber",
    icon: BarChart3,
    isActive: (pathname) => pathname.startsWith(FACILITY_ROUTES.analytics),
  },
];

const AGENT_ITEMS: SidebarNavItem[] = [
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

const SETTINGS_ITEMS: SidebarNavItem[] = [
  {
    id: "settings-general",
    href: FACILITY_ROUTES.settings,
    label: "General",
    icon: Settings,
    isActive: (pathname: string) => pathname.startsWith(FACILITY_ROUTES.settings),
  },
];

export const HQ_SIDEBAR_SECTIONS: HqSidebarSection[] = [
  { id: "facility", label: "Facility", items: FACILITY_ITEMS },
  { id: "agents", label: "AI Agents", items: AGENT_ITEMS },
  { id: "settings", label: "Settings", items: SETTINGS_ITEMS },
];

export const HQ_SIDEBAR_SECTION_DEFAULTS: Record<HqSidebarSectionId, boolean> = {
  facility: true,
  agents: true,
  settings: false,
};

export function isSidebarNavItemActive(
  pathname: string,
  item: SidebarNavItem,
): boolean {
  if (item.isActive) return item.isActive(pathname);
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function resolveActiveSidebarSection(
  pathname: string,
): HqSidebarSectionId {
  for (const section of HQ_SIDEBAR_SECTIONS) {
    if (section.items.some((item) => isSidebarNavItemActive(pathname, item))) {
      return section.id;
    }
  }
  return "facility";
}

export function resolveActiveSidebarItem(
  pathname: string,
): SidebarNavItem | null {
  for (const section of HQ_SIDEBAR_SECTIONS) {
    for (const item of section.items) {
      if (isSidebarNavItemActive(pathname, item)) return item;
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

/** @deprecated Use HQ_SIDEBAR_SECTIONS */
export type HqSectionId = HqSidebarSectionId | "missions" | "reports" | "knowledge";

/** @deprecated Use SidebarNavItem */
export type ContextNavItem = SidebarNavItem;
