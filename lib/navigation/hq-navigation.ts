import {
  getHqSidebarSections,
  HQ_SIDEBAR_SECTION_DEFAULTS,
  isSidebarNavItemActive,
  resolveActiveSidebarItem,
  resolveActiveSidebarSection,
  resolveAgentNavActiveId,
} from "@/lib/i18n/data/hq-navigation";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import type { LucideIcon } from "lucide-react";

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

export {
  getHqSidebarSections,
  HQ_SIDEBAR_SECTION_DEFAULTS,
  isSidebarNavItemActive,
  resolveActiveSidebarItem,
  resolveActiveSidebarSection,
  resolveAgentNavActiveId,
};

/** @deprecated Use getHqSidebarSections(locale) */
export const HQ_SIDEBAR_SECTIONS: HqSidebarSection[] =
  getHqSidebarSections(DEFAULT_LOCALE);

/** @deprecated Use HqSidebarSectionId */
export type HqSectionId = HqSidebarSectionId | "missions" | "reports" | "knowledge";

/** @deprecated Use SidebarNavItem */
export type ContextNavItem = SidebarNavItem;
