import type { AgentId } from "@/lib/constants/agents";
import { AGENT_IDS } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import { FACILITY_ROUTES } from "@/lib/facility/facility-routes";
import {
  AGENT_WORKSPACE_ROUTES,
  COMMERCE_LAB_ROUTE,
  PERSONA_STUDIO_ROUTE,
  getAgentFromWorkspacePath,
  isCommerceLabPath,
  isPersonaStudioPath,
} from "@/lib/workspace/agent-routes";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";
import type {
  HqSidebarSection,
  HqSidebarSectionId,
  SidebarNavItem,
} from "@/lib/navigation/hq-navigation";
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
  UserRound,
  Wand2,
  BookOpen,
} from "lucide-react";

const AGENT_ICONS = {
  ceo: Crown,
  research: Search,
  designer: Palette,
  content: PenLine,
  image: Wand2,
  marketing: Megaphone,
  shopify: ShoppingBag,
} as const satisfies Record<AgentId, typeof Crown>;

const COMMERCE_LAB_COLOR = "#F97316";
const PERSONA_STUDIO_COLOR = "#C4A574";

export const HQ_SIDEBAR_SECTION_DEFAULTS: Record<HqSidebarSectionId, boolean> = {
  facility: true,
  agents: true,
  settings: false,
};

export function getHqSidebarSections(locale: Locale): HqSidebarSection[] {
  const { hqNavigation, agents } = getDictionary(locale);

  const facilityItems: SidebarNavItem[] = [
    {
      id: "command-center",
      href: FACILITY_ROUTES.home,
      label: hqNavigation.commandCenter,
      icon: Home,
      isActive: (pathname) => pathname === "/",
    },
    {
      id: "mission-control",
      href: FACILITY_ROUTES.missions,
      label: hqNavigation.missionControl,
      icon: Target,
      isActive: (pathname) =>
        pathname.startsWith(FACILITY_ROUTES.missions) ||
        pathname.startsWith("/tasks"),
    },
    {
      id: "reports-center",
      href: FACILITY_ROUTES.reports,
      label: hqNavigation.reportsCenter,
      icon: FileText,
      isActive: (pathname) =>
        pathname.startsWith(FACILITY_ROUTES.reports) ||
        pathname.startsWith("/reports"),
    },
    {
      id: "knowledge-vault",
      href: FACILITY_ROUTES.knowledge,
      label: hqNavigation.knowledgeVault,
      icon: BookOpen,
      isActive: (pathname) => pathname.startsWith(FACILITY_ROUTES.knowledge),
    },
    {
      id: "brain-core",
      href: FACILITY_ROUTES.brain,
      label: hqNavigation.brainCore,
      icon: Brain,
      isActive: (pathname) =>
        pathname.startsWith(FACILITY_ROUTES.brain) ||
        pathname.startsWith("/brain"),
    },
    {
      id: "analytics-chamber",
      href: FACILITY_ROUTES.analytics,
      label: hqNavigation.analyticsChamber,
      icon: BarChart3,
      isActive: (pathname) => pathname.startsWith(FACILITY_ROUTES.analytics),
    },
  ];

  const agentItems: SidebarNavItem[] = [
    ...AGENT_IDS.map((id) => ({
      id,
      href: AGENT_WORKSPACE_ROUTES[id],
      label: agents.studioNames[id],
      icon: AGENT_ICONS[id],
      accent: getAgentColor(id),
      isActive: (pathname: string) =>
        pathname === AGENT_WORKSPACE_ROUTES[id] ||
        pathname.startsWith(`${AGENT_WORKSPACE_ROUTES[id]}/`),
    })),
    {
      id: "persona",
      href: PERSONA_STUDIO_ROUTE,
      label: agents.personaStudio,
      icon: UserRound,
      accent: PERSONA_STUDIO_COLOR,
      isActive: (pathname: string) => isPersonaStudioPath(pathname),
    },
    {
      id: "commerce",
      href: COMMERCE_LAB_ROUTE,
      label: agents.commerceLab,
      icon: BarChart3,
      accent: COMMERCE_LAB_COLOR,
      isActive: (pathname: string) => isCommerceLabPath(pathname),
    },
  ];

  const settingsItems: SidebarNavItem[] = [
    {
      id: "settings-general",
      href: FACILITY_ROUTES.settings,
      label: hqNavigation.general,
      icon: Settings,
      isActive: (pathname: string) => pathname.startsWith(FACILITY_ROUTES.settings),
    },
  ];

  return [
    { id: "facility", label: hqNavigation.facility, items: facilityItems },
    { id: "agents", label: hqNavigation.agents, items: agentItems },
    { id: "settings", label: hqNavigation.settings, items: settingsItems },
  ];
}

export function resolveActiveSidebarSection(
  pathname: string,
  locale: Locale,
): HqSidebarSectionId {
  for (const section of getHqSidebarSections(locale)) {
    if (section.items.some((item) => isSidebarNavItemActive(pathname, item))) {
      return section.id;
    }
  }
  return "facility";
}

export function resolveActiveSidebarItem(
  pathname: string,
  locale: Locale,
): SidebarNavItem | null {
  for (const section of getHqSidebarSections(locale)) {
    for (const item of section.items) {
      if (isSidebarNavItemActive(pathname, item)) return item;
    }
  }
  return null;
}

export function resolveAgentNavActiveId(
  pathname: string,
): AgentId | "commerce" | "persona" | null {
  if (isPersonaStudioPath(pathname)) return "persona";
  if (isCommerceLabPath(pathname)) return "commerce";
  return getAgentFromWorkspacePath(pathname);
}

export function isSidebarNavItemActive(
  pathname: string,
  item: SidebarNavItem,
): boolean {
  if (item.isActive) return item.isActive(pathname);
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
