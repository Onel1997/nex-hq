import type { AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import { FACILITY_ROUTES } from "@/lib/facility/facility-routes";
import {
  AGENT_WORKSPACE_ROUTES,
  PERSONA_STUDIO_ROUTE,
  VIDEO_STUDIO_ROUTE,
  getAgentFromWorkspacePath,
  isPersonaStudioPath,
  isVideoStudioPath,
} from "@/lib/workspace/agent-routes";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";
import type {
  HqSidebarSection,
  HqSidebarSectionId,
  SidebarNavItem,
} from "@/lib/navigation/hq-navigation";
import {
  Clapperboard,
  Crown,
  Home,
  Palette,
  Search,
  Settings,
  ShoppingBag,
  UserRound,
  Wand2,
} from "lucide-react";

const PERSONA_STUDIO_COLOR = "#C4A574";
const VIDEO_STUDIO_COLOR = "#7A8FA8";

/** Primary production pipeline — order is intentional. */
const PRIMARY_STUDIO_NAV: Array<{
  id: string;
  href: string;
  labelKey:
    | "ceo"
    | "research"
    | "designer"
    | "persona"
    | "image"
    | "video"
    | "shopify";
  icon: typeof Crown;
  accent?: string;
  isActive: (pathname: string) => boolean;
}> = [
  {
    id: "ceo",
    href: AGENT_WORKSPACE_ROUTES.ceo,
    labelKey: "ceo",
    icon: Crown,
    accent: getAgentColor("ceo"),
    isActive: (pathname) =>
      pathname === AGENT_WORKSPACE_ROUTES.ceo ||
      pathname.startsWith(`${AGENT_WORKSPACE_ROUTES.ceo}/`),
  },
  {
    id: "research",
    href: AGENT_WORKSPACE_ROUTES.research,
    labelKey: "research",
    icon: Search,
    accent: getAgentColor("research"),
    isActive: (pathname) =>
      pathname === AGENT_WORKSPACE_ROUTES.research ||
      pathname.startsWith(`${AGENT_WORKSPACE_ROUTES.research}/`),
  },
  {
    id: "designer",
    href: AGENT_WORKSPACE_ROUTES.designer,
    labelKey: "designer",
    icon: Palette,
    accent: getAgentColor("designer"),
    isActive: (pathname) =>
      pathname === AGENT_WORKSPACE_ROUTES.designer ||
      pathname.startsWith(`${AGENT_WORKSPACE_ROUTES.designer}/`),
  },
  {
    id: "persona",
    href: PERSONA_STUDIO_ROUTE,
    labelKey: "persona",
    icon: UserRound,
    accent: PERSONA_STUDIO_COLOR,
    isActive: (pathname) => isPersonaStudioPath(pathname),
  },
  {
    id: "image",
    href: AGENT_WORKSPACE_ROUTES.image,
    labelKey: "image",
    icon: Wand2,
    accent: getAgentColor("image"),
    isActive: (pathname) =>
      pathname === AGENT_WORKSPACE_ROUTES.image ||
      pathname.startsWith(`${AGENT_WORKSPACE_ROUTES.image}/`),
  },
  {
    id: "video",
    href: VIDEO_STUDIO_ROUTE,
    labelKey: "video",
    icon: Clapperboard,
    accent: VIDEO_STUDIO_COLOR,
    isActive: (pathname) => isVideoStudioPath(pathname),
  },
  {
    id: "shopify",
    href: AGENT_WORKSPACE_ROUTES.shopify,
    labelKey: "shopify",
    icon: ShoppingBag,
    accent: getAgentColor("shopify"),
    isActive: (pathname) =>
      pathname === AGENT_WORKSPACE_ROUTES.shopify ||
      pathname.startsWith(`${AGENT_WORKSPACE_ROUTES.shopify}/`),
  },
];

export const HQ_SIDEBAR_SECTION_DEFAULTS: Record<HqSidebarSectionId, boolean> = {
  studios: true,
  settings: true,
};

export function getHqSidebarSections(locale: Locale): HqSidebarSection[] {
  const { hqNavigation, agents } = getDictionary(locale);

  const studioLabels: Record<(typeof PRIMARY_STUDIO_NAV)[number]["labelKey"], string> = {
    ceo: agents.studioNames.ceo,
    research: agents.studioNames.research,
    designer: agents.studioNames.designer,
    persona: agents.personaStudio,
    image: agents.studioNames.image,
    video: agents.videoStudio,
    shopify: agents.studioNames.shopify,
  };

  const studioItems: SidebarNavItem[] = [
    {
      id: "home",
      href: FACILITY_ROUTES.home,
      label: hqNavigation.home,
      icon: Home,
      isActive: (pathname) => pathname === "/",
    },
    ...PRIMARY_STUDIO_NAV.map((item) => ({
      id: item.id,
      href: item.href,
      label: studioLabels[item.labelKey],
      icon: item.icon,
      accent: item.accent,
      isActive: item.isActive,
    })),
  ];

  const settingsItems: SidebarNavItem[] = [
    {
      id: "settings-general",
      href: FACILITY_ROUTES.settings,
      label: hqNavigation.settings,
      icon: Settings,
      isActive: (pathname: string) => pathname.startsWith(FACILITY_ROUTES.settings),
    },
  ];

  return [
    { id: "studios", label: hqNavigation.studios, items: studioItems },
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
  return "studios";
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
): AgentId | "commerce" | "persona" | "video" | null {
  if (isPersonaStudioPath(pathname)) return "persona";
  if (isVideoStudioPath(pathname)) return "video";
  if (pathname === "/agents/commerce" || pathname.startsWith("/agents/commerce/")) {
    return "commerce";
  }
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
