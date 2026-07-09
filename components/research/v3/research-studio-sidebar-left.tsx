"use client";

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
  label: string;
  icon: LucideIcon;
}

const SECTIONS: SidebarSection[] = [
  { id: "history", label: "Research History", icon: History },
  { id: "saved", label: "Saved Reports", icon: FolderOpen },
  { id: "collections", label: "Collections", icon: BookOpen },
  { id: "competitors", label: "Competitors", icon: Swords },
  { id: "knowledge", label: "Knowledge", icon: Bookmark },
  { id: "pinned", label: "Pinned Research", icon: Pin },
  { id: "recent", label: "Recent Missions", icon: Clock },
  { id: "performance", label: "Performance Intelligence", icon: BarChart3 },
];

interface ResearchStudioSidebarLeftProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ResearchStudioSidebarLeft({
  collapsed,
  onToggleCollapse,
}: ResearchStudioSidebarLeftProps) {
  return (
    <aside
      className={cn(
        "rs3-sidebar rs3-sidebar-left",
        collapsed && "rs3-sidebar-collapsed",
      )}
      aria-label="Research navigation"
    >
      <div className="rs3-sidebar-header">
        {!collapsed ? (
          <div className="rs3-sidebar-brand">
            <span className="rs3-sidebar-brand-name">Research Studio</span>
          </div>
        ) : null}
        <button
          type="button"
          className="rs3-sidebar-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
          return (
            <div key={section.id} className="rs3-nav-section">
              {!collapsed ? (
                <div className="rs3-nav-row">
                  <Icon className="size-3.5 rs3-nav-icon" aria-hidden />
                  <span className="rs3-nav-label">{section.label}</span>
                  <span className="rs3-nav-soon">Coming Soon</span>
                </div>
              ) : (
                <div className="rs3-nav-icon-only" title={section.label}>
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
