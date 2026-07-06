"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { LabInspectorData } from "@/lib/facility/types";
import { extractResearchIntelligence } from "@/lib/facility/lab-intelligence";
import type { RecentMission } from "./use-research-studio";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderOpen,
  History,
  LineChart,
  Pin,
  Swords,
  type LucideIcon,
} from "lucide-react";

interface ResearchStudioSidebarLeftProps {
  data: LabInspectorData | null;
  loading: boolean;
  recentMissions: RecentMission[];
  pinnedIds: string[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectMission: (prompt: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  items: Array<{ id: string; label: string; meta?: string; prompt?: string }>;
  comingSoon?: boolean;
}

export function ResearchStudioSidebarLeft({
  data,
  loading,
  recentMissions,
  pinnedIds,
  collapsed,
  onToggleCollapse,
  onSelectMission,
}: ResearchStudioSidebarLeftProps) {
  const intel = useMemo(
    () =>
      data?.fullReports ? extractResearchIntelligence(data.fullReports) : null,
    [data?.fullReports],
  );

  const reports = intel?.reports ?? [];
  const collections = reports.filter((r) => r.reportType === "design");
  const competitors = intel?.competitorReports ?? [];

  const pinnedReports = reports.filter((r) => pinnedIds.includes(r.id));

  const sections: NavItem[] = [
    {
      id: "history",
      label: "Research History",
      icon: History,
      items: reports.slice(0, 8).map((r) => ({
        id: r.id,
        label: r.title,
        meta: r.reportType,
      })),
    },
    {
      id: "saved",
      label: "Saved Reports",
      icon: FolderOpen,
      items: reports
        .filter((r) => r.status === "approved" || r.status === "pending_review")
        .slice(0, 6)
        .map((r) => ({
          id: r.id,
          label: r.title,
          meta: r.status,
        })),
    },
    {
      id: "collections",
      label: "Collections",
      icon: BookOpen,
      items: collections.slice(0, 6).map((r) => ({
        id: r.id,
        label: r.title,
        meta: "collection",
      })),
    },
    {
      id: "competitors",
      label: "Competitors",
      icon: Swords,
      items: competitors.slice(0, 6).map((r) => ({
        id: r.id,
        label: r.title,
        meta: "competitor",
      })),
    },
    {
      id: "knowledge",
      label: "Knowledge",
      icon: Bookmark,
      items: (intel?.streetwearInsights ?? []).slice(0, 5).map((insight, i) => ({
        id: `insight-${i}`,
        label: insight,
      })),
    },
    {
      id: "performance",
      label: "Performance Intelligence",
      icon: LineChart,
      items: [],
      comingSoon: true,
    },
    {
      id: "pinned",
      label: "Pinned Research",
      icon: Pin,
      items: pinnedReports.map((r) => ({
        id: r.id,
        label: r.title,
        meta: "pinned",
      })),
    },
    {
      id: "recent",
      label: "Recent Missions",
      icon: Clock,
      items: recentMissions.slice(0, 8).map((m) => ({
        id: m.id,
        label: m.title ?? m.prompt.slice(0, 48),
        meta: "mission",
        prompt: m.prompt,
      })),
    },
  ];

  return (
    <aside
      className={cn(
        "research-studio-sidebar research-studio-sidebar-left",
        collapsed && "research-studio-sidebar-collapsed",
      )}
      aria-label="Research navigation"
    >
      <div className="research-studio-sidebar-header">
        {!collapsed ? (
          <span className="research-studio-sidebar-title">Research Studio</span>
        ) : null}
        <button
          type="button"
          className="research-studio-sidebar-toggle"
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

      <nav className="research-studio-sidebar-nav">
        {sections.map((section) => (
          <div key={section.id} className="research-studio-nav-section">
            {!collapsed ? (
              <div className="research-studio-nav-heading">
                <section.icon className="size-3.5 opacity-60" aria-hidden />
                <span>{section.label}</span>
                {section.comingSoon ? (
                  <span className="research-studio-soon-chip">Soon</span>
                ) : null}
              </div>
            ) : (
              <div
                className="research-studio-nav-icon-only"
                title={section.label}
              >
                <section.icon className="size-4" aria-hidden />
              </div>
            )}

            {!collapsed && !section.comingSoon ? (
              <ul className="research-studio-nav-list">
                {loading && section.items.length === 0 ? (
                  <li className="research-studio-nav-empty">Loading…</li>
                ) : null}
                {!loading && section.items.length === 0 ? (
                  <li className="research-studio-nav-empty">No items yet</li>
                ) : null}
                {section.items.map((item) => (
                  <li key={item.id}>
                    {item.prompt ? (
                      <button
                        type="button"
                        className="research-studio-nav-link"
                        onClick={() => onSelectMission(item.prompt!)}
                        title={item.prompt}
                      >
                        <span className="research-studio-nav-link-label">
                          {item.label}
                        </span>
                        {item.meta ? (
                          <span className="research-studio-nav-meta">
                            {item.meta}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <Link
                        href="/facility/reports"
                        className="research-studio-nav-link"
                      >
                        <span className="research-studio-nav-link-label">
                          {item.label}
                        </span>
                        {item.meta ? (
                          <span className="research-studio-nav-meta">
                            {item.meta}
                          </span>
                        ) : null}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </nav>
    </aside>
  );
}
