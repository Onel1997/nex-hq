import {
  getHqSidebarSections,
  getCustomerSidebarSections,
  HQ_SIDEBAR_SECTION_DEFAULTS,
  isSidebarNavItemActive,
  resolveActiveSidebarItem,
  resolveActiveSidebarSection,
  resolveAgentNavActiveId,
} from "@/lib/i18n/data/hq-navigation";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import type { LucideIcon } from "lucide-react";

export type HqSidebarSectionId =
  | "studios"
  | "moreStudios"
  | "management"
  | "settings";

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
  getCustomerSidebarSections,
  HQ_SIDEBAR_SECTION_DEFAULTS,
  isSidebarNavItemActive,
  resolveActiveSidebarItem,
  resolveActiveSidebarSection,
  resolveAgentNavActiveId,
};

export function getStudioSidebarSections(
  locale: Parameters<typeof getHqSidebarSections>[0],
  audience: "OWNER" | "CUSTOMER",
): HqSidebarSection[] {
  return audience === "CUSTOMER"
    ? getCustomerSidebarSections(locale)
    : getHqSidebarSections(locale);
}

/** @deprecated Use getHqSidebarSections(locale) */
export const HQ_SIDEBAR_SECTIONS: HqSidebarSection[] =
  getHqSidebarSections(DEFAULT_LOCALE);

/** @deprecated Use HqSidebarSectionId */
export type HqSectionId =
  | HqSidebarSectionId
  | "agents"
  | "missions"
  | "reports"
  | "knowledge";

/** @deprecated Use SidebarNavItem */
export type ContextNavItem = SidebarNavItem;
