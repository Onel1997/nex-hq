import {
  Brain,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/constants/navigation";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  agents: Users,
  brain: Brain,
  tasks: ClipboardList,
  reports: FileText,
  settings: Settings,
};

export function getMainNav(locale: Locale): NavItem[] {
  const { navigation } = getDictionary(locale);

  return [
    { title: navigation.dashboard, href: "/", icon: NAV_ICONS.dashboard },
    { title: navigation.agents, href: "/agents", icon: NAV_ICONS.agents },
    { title: navigation.brain, href: "/brain", icon: NAV_ICONS.brain },
    { title: navigation.tasks, href: "/tasks", icon: NAV_ICONS.tasks },
    { title: navigation.reports, href: "/reports", icon: NAV_ICONS.reports },
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
