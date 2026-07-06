"use client";

import { useMemo } from "react";
import type { ResearchBrainSnapshot } from "@/lib/research/research-brain-intelligence";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Radio,
} from "lucide-react";

type SourceStatus = "live" | "simulated" | "offline" | "coming_soon";

interface LiveSource {
  id: string;
  label: string;
  status: SourceStatus;
  lastSync?: string;
}

interface ResearchStudioSidebarRightProps {
  snapshot: ResearchBrainSnapshot | null;
  loading: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function formatLastSync(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function statusLabel(status: SourceStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "simulated":
      return "Simulated";
    case "offline":
      return "Offline";
    case "coming_soon":
      return "Coming soon";
  }
}

function statusClass(status: SourceStatus): string {
  switch (status) {
    case "live":
      return "research-studio-chip-live";
    case "simulated":
      return "research-studio-chip-simulated";
    case "offline":
      return "research-studio-chip-offline";
    case "coming_soon":
      return "research-studio-chip-soon";
  }
}

export function ResearchStudioSidebarRight({
  snapshot,
  loading,
  collapsed,
  onToggleCollapse,
}: ResearchStudioSidebarRightProps) {
  const sources = useMemo((): LiveSource[] => {
    const connectorMap = new Map(
      (snapshot?.connectorIntelligence.connectors ?? []).map((c) => [
        c.id,
        c.mode,
      ]),
    );

    const commerceLive = snapshot?.commerceConnected ?? false;
    const loadedAt = snapshot?.loadedAt;

    const resolveMode = (
      id: string,
      fallback: SourceStatus = "simulated",
    ): SourceStatus => {
      const mode = connectorMap.get(id);
      if (mode === "live") return "live";
      if (mode === "simulated") return "simulated";
      return fallback;
    };

    return [
      {
        id: "tiktok",
        label: "TikTok",
        status: resolveMode("tiktok"),
        lastSync: loadedAt,
      },
      {
        id: "pinterest",
        label: "Pinterest",
        status: resolveMode("pinterest"),
        lastSync: loadedAt,
      },
      {
        id: "shopify",
        label: "Shopify",
        status: commerceLive ? "live" : "offline",
        lastSync: loadedAt,
      },
      {
        id: "google_trends",
        label: "Google Trends",
        status: resolveMode("google_trends"),
        lastSync: loadedAt,
      },
      {
        id: "amazon",
        label: "Amazon",
        status: resolveMode("amazon"),
        lastSync: loadedAt,
      },
      {
        id: "etsy",
        label: "Etsy",
        status: resolveMode("etsy"),
        lastSync: loadedAt,
      },
      {
        id: "reddit",
        label: "Reddit",
        status: resolveMode("reddit"),
        lastSync: loadedAt,
      },
      {
        id: "instagram",
        label: "Instagram",
        status: "coming_soon",
      },
      {
        id: "fashion_news",
        label: "Fashion News",
        status: "coming_soon",
      },
    ];
  }, [snapshot]);

  return (
    <aside
      className={cn(
        "research-studio-sidebar research-studio-sidebar-right",
        collapsed && "research-studio-sidebar-collapsed",
      )}
      aria-label="Live sources"
    >
      <div className="research-studio-sidebar-header">
        <button
          type="button"
          className="research-studio-sidebar-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sources" : "Collapse sources"}
        >
          {collapsed ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        {!collapsed ? (
          <div className="research-studio-sources-heading">
            <Radio className="size-3.5" aria-hidden />
            <span>Live Sources</span>
          </div>
        ) : null}
      </div>

      <ul className="research-studio-sources-list">
        {loading && !snapshot ? (
          <li className="research-studio-nav-empty">Syncing sources…</li>
        ) : null}
        {sources.map((source) => (
          <li key={source.id} className="research-studio-source-row">
            {!collapsed ? (
              <>
                <div className="research-studio-source-main">
                  <span className="research-studio-source-label">
                    {source.label}
                  </span>
                  <span
                    className={cn(
                      "research-studio-status-chip",
                      statusClass(source.status),
                    )}
                  >
                    {statusLabel(source.status)}
                  </span>
                </div>
                {source.status !== "coming_soon" ? (
                  <span className="research-studio-source-sync">
                    Last sync {formatLastSync(source.lastSync)}
                  </span>
                ) : null}
              </>
            ) : (
              <span
                className={cn(
                  "research-studio-source-dot",
                  statusClass(source.status),
                )}
                title={`${source.label} — ${statusLabel(source.status)}`}
              />
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
