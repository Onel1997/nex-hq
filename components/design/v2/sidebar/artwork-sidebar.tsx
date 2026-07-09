"use client";

import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronLeft,
  Clock,
  FolderOpen,
  History,
  Image,
  Layers,
  Upload,
} from "lucide-react";
import type { SidebarSectionId } from "../types";

const SECTIONS: Array<{
  id: SidebarSectionId;
  label: string;
  icon: typeof Image;
  disabled?: boolean;
}> = [
  { id: "master-artwork", label: "Master Artwork", icon: Image },
  { id: "versions", label: "Versions", icon: Layers },
  { id: "collections", label: "Collections", icon: FolderOpen },
  { id: "brand-library", label: "Brand Library", icon: BookOpen, disabled: true },
  { id: "history", label: "History", icon: History },
  { id: "recent-uploads", label: "Recent Uploads", icon: Upload },
];

interface ArtworkSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  activeSection: SidebarSectionId;
  onSectionChange: (section: SidebarSectionId) => void;
  versionCount: number;
  recentCount: number;
  children?: React.ReactNode;
}

export function ArtworkSidebar({
  collapsed,
  onCollapsedChange,
  activeSection,
  onSectionChange,
  versionCount,
  recentCount,
  children,
}: ArtworkSidebarProps) {
  return (
    <aside
      className={cn("dsv2-sidebar", collapsed && "is-collapsed")}
      aria-label="Design Studio navigation"
    >
      <div className="dsv2-sidebar-head">
        {!collapsed ? <span className="dsv2-sidebar-label">Workspace</span> : null}
        <button
          type="button"
          className="dsv2-sidebar-collapse"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={cn("size-4", collapsed && "is-flipped")} />
        </button>
      </div>

      <nav className="dsv2-sidebar-nav">
        {SECTIONS.map(({ id, label, icon: Icon, disabled }) => {
          const count =
            id === "versions" ? versionCount : id === "recent-uploads" ? recentCount : undefined;

          return (
            <button
              key={id}
              type="button"
              className={cn(
                "dsv2-sidebar-item",
                activeSection === id && "is-active",
                disabled && "is-disabled",
              )}
              onClick={() => !disabled && onSectionChange(id)}
              disabled={disabled}
              title={collapsed ? label : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? (
                <>
                  <span className="dsv2-sidebar-item-label">{label}</span>
                  {count != null && count > 0 ? (
                    <span className="dsv2-sidebar-badge">{count}</span>
                  ) : null}
                  {disabled ? <span className="dsv2-sidebar-soon">Soon</span> : null}
                </>
              ) : null}
            </button>
          );
        })}
      </nav>

      {!collapsed && children ? (
        <div className="dsv2-sidebar-panel">{children}</div>
      ) : null}
    </aside>
  );
}

export function SidebarSectionPanel({
  section,
  versionHistory,
  recentUploads,
  onSelectRecent,
}: {
  section: SidebarSectionId;
  versionHistory: Array<{ id: string; label: string; timestamp: string; type: string }>;
  recentUploads: Array<{ fileName: string; uploadedAt: string; fileSize: number }>;
  onSelectRecent?: (fileName: string) => void;
}) {
  if (section === "versions") {
    return (
      <div className="dsv2-sidebar-content">
        <p className="dsv2-sidebar-content-title">Versions</p>
        {versionHistory.length > 0 ? (
          <ul className="dsv2-sidebar-list">
            {versionHistory.slice(0, 6).map((entry) => (
              <li key={entry.id} className="dsv2-sidebar-list-item">
                <span>{entry.label}</span>
                <span className="dsv2-sidebar-list-meta">
                  {new Date(entry.timestamp).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dsv2-sidebar-empty">No versions yet</p>
        )}
      </div>
    );
  }

  if (section === "recent-uploads") {
    return (
      <div className="dsv2-sidebar-content">
        <p className="dsv2-sidebar-content-title">Recent Uploads</p>
        {recentUploads.length > 0 ? (
          <ul className="dsv2-sidebar-list">
            {recentUploads.map((upload) => (
              <li key={upload.fileName + upload.uploadedAt}>
                <button
                  type="button"
                  className="dsv2-sidebar-list-btn"
                  onClick={() => onSelectRecent?.(upload.fileName)}
                >
                  <span>{upload.fileName}</span>
                  <span className="dsv2-sidebar-list-meta">
                    <Clock className="size-3" />
                    {formatFileSize(upload.fileSize)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dsv2-sidebar-empty">No uploads yet</p>
        )}
      </div>
    );
  }

  if (section === "history") {
    return (
      <div className="dsv2-sidebar-content">
        <p className="dsv2-sidebar-content-title">History</p>
        <p className="dsv2-sidebar-empty">Activity history will appear here after analysis.</p>
      </div>
    );
  }

  if (section === "collections") {
    return (
      <div className="dsv2-sidebar-content">
        <p className="dsv2-sidebar-content-title">Collections</p>
        <p className="dsv2-sidebar-empty">Link artwork to a collection after upload.</p>
      </div>
    );
  }

  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
