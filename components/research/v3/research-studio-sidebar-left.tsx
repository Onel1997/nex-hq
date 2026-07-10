"use client";

import { useDictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderOpen,
  History,
  Pin,
  Swords,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SidebarSection {
  id: string;
  labelKey:
    | "history"
    | "saved"
    | "collections"
    | "competitors"
    | "knowledge"
    | "pinned"
    | "recent"
    | "performance";
  icon: LucideIcon;
}

const SECTIONS: SidebarSection[] = [
  { id: "history", labelKey: "history", icon: History },
  { id: "saved", labelKey: "saved", icon: FolderOpen },
  { id: "collections", labelKey: "collections", icon: BookOpen },
  { id: "competitors", labelKey: "competitors", icon: Swords },
  { id: "knowledge", labelKey: "knowledge", icon: Bookmark },
  { id: "pinned", labelKey: "pinned", icon: Pin },
  { id: "recent", labelKey: "recent", icon: Clock },
  { id: "performance", labelKey: "performance", icon: BarChart3 },
];

interface ResearchStudioSidebarLeftProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ResearchStudioSidebarLeft({
  collapsed,
  onToggleCollapse,
}: ResearchStudioSidebarLeftProps) {
  const { research, agents } = useDictionary();
  const sidebar = research.studio.sidebar;

  return (
    <aside
      className={cn(
        "rs3-sidebar rs3-sidebar-left",
        collapsed && "rs3-sidebar-collapsed",
      )}
      aria-label={sidebar.navAria}
    >
      <div className="rs3-sidebar-header">
        {!collapsed ? (
          <div className="rs3-sidebar-brand">
            <span className="rs3-sidebar-brand-name">
              {agents.studioNames.research}
            </span>
          </div>
        ) : null}
        <button
          type="button"
          className="rs3-sidebar-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? sidebar.expand : sidebar.collapse}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      <nav className="rs3-sidebar-nav">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const label = sidebar[section.labelKey];
          return (
            <div key={section.id} className="rs3-nav-section">
              {!collapsed ? (
                <div className="rs3-nav-row">
                  <Icon className="size-3.5 rs3-nav-icon" aria-hidden />
                  <span className="rs3-nav-label">{label}</span>
                  <span className="rs3-nav-soon">{sidebar.comingSoonNav}</span>
                </div>
              ) : (
                <div className="rs3-nav-icon-only" title={label}>
                  <Icon className="size-4" aria-hidden />
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
