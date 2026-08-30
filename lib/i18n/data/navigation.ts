import { Crown, LayoutDashboard, Search, Settings, type LucideIcon } from "lucide-react";
import type { NavItem } from "@/lib/constants/navigation";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  ceo: Crown,
  research: Search,
  settings: Settings,
};

export function getMainNav(locale: Locale): NavItem[] {
  const { navigation } = getDictionary(locale);

  return [
    { title: navigation.dashboard, href: "/", icon: NAV_ICONS.dashboard },
    { title: navigation.agents, href: "/agents/ceo", icon: NAV_ICONS.ceo },
    { title: navigation.reports, href: "/agents/research", icon: NAV_ICONS.research },
  ];
}

export function getSecondaryNav(locale: Locale): NavItem[] {
  const { navigation } = getDictionary(locale);

  return [
    {
      title: navigation.settings,
      href: "/settings",
      icon: NAV_ICONS.settings,
    },
  ];
}

export function getPageTitle(locale: Locale, page: keyof typeof import("../locales/de/navigation").navigation): string {
  return getDictionary(locale).navigation[page];
}
