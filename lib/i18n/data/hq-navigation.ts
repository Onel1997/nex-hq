import type { AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/workspace/agent-theme";
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
  CircleDollarSign,
  Crown,
  Home,
  Library,
  Palette,
  PackageSearch,
  Search,
  Settings,
  ShoppingBag,
  UserRound,
  UsersRound,
  Wand2,
  Sparkles,
} from "lucide-react";

const NEXHQ_BLUE = "#3488ff";
const NEXHQ_CYAN = "#5de6f2";

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
    | "creative"
    | "ugcVideo"
    | "video"
    | "products"
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
    accent: NEXHQ_BLUE,
    isActive: (pathname) =>
      pathname === AGENT_WORKSPACE_ROUTES.designer ||
      pathname.startsWith(`${AGENT_WORKSPACE_ROUTES.designer}/`),
  },
  {
    id: "persona",
    href: PERSONA_STUDIO_ROUTE,
    labelKey: "persona",
    icon: UserRound,
    accent: NEXHQ_CYAN,
    isActive: (pathname) => isPersonaStudioPath(pathname),
  },
  {
    id: "image",
    href: AGENT_WORKSPACE_ROUTES.image,
    labelKey: "image",
    icon: Wand2,
    accent: NEXHQ_BLUE,
    isActive: (pathname) =>
      pathname === AGENT_WORKSPACE_ROUTES.image ||
      pathname.startsWith(`${AGENT_WORKSPACE_ROUTES.image}/`),
  },
  {
    id: "creative",
    href: "/creative-studio",
    labelKey: "creative",
    icon: Sparkles,
    accent: "#a78bfa",
    isActive: (pathname) =>
      pathname === "/creative-studio" ||
      pathname.startsWith("/creative-studio/"),
  },
  {
    id: "ugc-video",
    href: "/ugc-video-studio",
    labelKey: "ugcVideo",
    icon: Clapperboard,
    accent: "#7dd3fc",
    isActive: (pathname) =>
      pathname === "/ugc-video-studio" ||
      pathname.startsWith("/ugc-video-studio/"),
  },
  {
    id: "video",
    href: VIDEO_STUDIO_ROUTE,
    labelKey: "video",
    icon: Clapperboard,
    accent: NEXHQ_CYAN,
    isActive: (pathname) => isVideoStudioPath(pathname),
  },
  {
    id: "products",
    href: "/agents/products",
    labelKey: "products",
    icon: PackageSearch,
    accent: NEXHQ_BLUE,
    isActive: (pathname) =>
      pathname === "/agents/products" || pathname.startsWith("/agents/products/"),
  },
  {
    id: "shopify",
    href: AGENT_WORKSPACE_ROUTES.shopify,
    labelKey: "shopify",
    icon: ShoppingBag,
    accent: NEXHQ_CYAN,
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
    creative: "Creative Studio",
    ugcVideo: "UGC Video Studio",
    video: agents.videoStudio,
    products: "Produktbibliothek",
    shopify: agents.studioNames.shopify,
  };

  const studioItems: SidebarNavItem[] = [
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
      id: "customers",
      href: "/hq/customers",
      label: "Kunden",
      icon: UsersRound,
      accent: NEXHQ_CYAN,
      isActive: (pathname: string) => pathname.startsWith("/hq/customers"),
    },
    {
      id: "settings-general",
      href: "/settings",
      label: hqNavigation.settings,
      icon: Settings,
      isActive: (pathname: string) => pathname.startsWith("/settings"),
    },
  ];

  return [
    { id: "studios", label: hqNavigation.studios, items: studioItems },
    { id: "settings", label: hqNavigation.settings, items: settingsItems },
  ];
}

/**
 * Customer navigation is derived from the same Studio navigation authority as
 * NexHQ. Only routes that have a real, customer-authorized Xeriano equivalent
 * are projected into the customer shell.
 */
export function getCustomerSidebarSections(locale: Locale): HqSidebarSection[] {
  const ownerSections = getHqSidebarSections(locale);
  const ownerStudios = ownerSections.find((section) => section.id === "studios");
  const customerRoutes = new Map<string, { href: string; label?: string; accent: string }>([
    ["designer", { href: "/app/design-studio", accent: "#b6a1ff" }],
    ["creative", { href: "/app/creative-studio", accent: "#a78bfa" }],
    ["ugc-video", { href: "/app/ugc-video-studio", accent: "#68d8f4" }],
  ]);
  const studioRoutes = (ownerStudios?.items ?? []).flatMap((item) => {
    const route = customerRoutes.get(item.id);
    if (!route) return [];
    return [{
      ...item,
      href: route.href,
      label: route.label ?? item.label,
      accent: route.accent,
      isActive: (pathname: string) =>
        pathname === route.href || pathname.startsWith(`${route.href}/`),
    }];
  });
  const studios: SidebarNavItem[] = [
    {
      id: "home",
      href: "/app",
      label: "Home",
      icon: Home,
      accent: "#b7becb",
      isActive: (pathname: string) => pathname === "/app",
    },
    ...studioRoutes,
  ];

  return [
    { id: "studios", label: "Studios", items: studios },
    {
      id: "settings",
      label: "Konto",
      items: [
        {
          id: "library",
          href: "/app/library",
          label: "Bibliothek",
          icon: Library,
          accent: "#84aef8",
        },
        {
          id: "credits",
          href: "/app/credits",
          label: "Credits / Plan",
          icon: CircleDollarSign,
          accent: "#d7b66f",
        },
        {
          id: "account",
          href: "/app/account",
          label: "Einstellungen / Account",
          icon: Settings,
          accent: "#aeb5c1",
        },
      ],
    },
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
