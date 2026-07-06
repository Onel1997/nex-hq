"use client";

import type { CSSProperties } from "react";
import type { ProviderSnapshot } from "./data-source-types";
import { formatRelativeSync } from "./format-sync";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

interface ResearchStudioSidebarRightProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  providers: ProviderSnapshot[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefreshAll: () => void;
  onRefreshProvider: (id: string) => void;
  onOpenDataSources?: () => void;
}

function SourceMark({ name, color }: { name: string; color: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <span
      className="rs3-source-mark"
      style={{ "--source-color": color } as CSSProperties}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function statusLabel(status: ProviderSnapshot["status"]): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "syncing":
      return "Syncing";
    case "authentication_error":
      return "Auth Error";
    case "rate_limited":
      return "Rate Limited";
    case "offline":
      return "Offline";
    case "disconnected":
      return "Coming Soon";
  }
}

function statusClass(status: ProviderSnapshot["status"]): string {
  switch (status) {
    case "connected":
      return "rs3-source-status-live";
    case "syncing":
      return "rs3-source-status-syncing";
    case "authentication_error":
      return "rs3-source-status-error";
    case "rate_limited":
      return "rs3-source-status-warn";
    case "offline":
      return "rs3-source-status-offline";
    case "disconnected":
      return "rs3-source-status-soon";
  }
}

function healthClass(provider: ProviderSnapshot): string {
  if (provider.status === "connected" && provider.mode === "live") {
    return "rs3-health-good";
  }
  if (provider.mode === "simulated" && provider.status !== "disconnected") {
    return "rs3-health-sim";
  }
  if (provider.error) return "rs3-health-bad";
  return "rs3-health-idle";
}

export function ResearchStudioSidebarRight({
  collapsed,
  onToggleCollapse,
  providers,
  loading,
  refreshing,
  error,
  onRefreshAll,
  onRefreshProvider,
  onOpenDataSources,
}: ResearchStudioSidebarRightProps) {
  return (
    <aside
      className={cn(
        "rs3-sidebar rs3-sidebar-right",
        collapsed && "rs3-sidebar-collapsed",
      )}
      aria-label="Live intelligence sources"
    >
      <div className="rs3-sidebar-header rs3-sidebar-header-right">
        <button
          type="button"
          className="rs3-sidebar-toggle"
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
          <div className="rs3-sources-heading">
            <span className="rs3-sources-pulse" />
            <span>Live Intelligence Sources</span>
            {onOpenDataSources ? (
              <button
                type="button"
                className="rs3-sources-manage"
                onClick={onOpenDataSources}
                title="Open Data Sources Center"
              >
                Manage
              </button>
            ) : null}
            <button
              type="button"
              className="rs3-sources-refresh"
              onClick={onRefreshAll}
              disabled={refreshing}
              aria-label="Refresh all sources"
              title="Refresh all sources"
            >
              <RefreshCw
                className={cn("size-3.5", refreshing && "animate-spin")}
              />
            </button>
          </div>
        ) : null}
      </div>

      <div className="rs3-sources-list">
        {loading && providers.length === 0 ? (
          <div className="rs3-sources-loading">
            <Loader2 className="size-4 animate-spin" />
            <span>Connecting sources…</span>
          </div>
        ) : null}

        {error ? (
          <div className="rs3-sources-error" role="alert">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {providers.map((source) => (
          <div
            key={source.id}
            className={cn(
              "rs3-source-card",
              source.status === "disconnected" && "rs3-source-card-soon",
              source.error && source.status !== "disconnected" && "rs3-source-card-error",
            )}
          >
            {!collapsed ? (
              <>
                <div className="rs3-source-card-top">
                  <div className="rs3-source-identity">
                    <SourceMark name={source.name} color={source.brandColor} />
                    <div className="rs3-source-title-block">
                      <span className="rs3-source-name">{source.name}</span>
                      <span className={cn("rs3-health-dot", healthClass(source))} />
                    </div>
                  </div>
                  <div className="rs3-source-actions">
                    <button
                      type="button"
                      className="rs3-source-refresh-btn"
                      onClick={() => onRefreshProvider(source.id)}
                      aria-label={`Refresh ${source.name}`}
                      title="Refresh source"
                    >
                      <RefreshCw className="size-3" />
                    </button>
                    <span
                      className={cn("rs3-source-status", statusClass(source.status))}
                    >
                      {source.status === "connected" ? (
                        <span className="rs3-source-status-dot" />
                      ) : null}
                      {statusLabel(source.status)}
                    </span>
                  </div>
                </div>

                {source.status !== "disconnected" ? (
                  <>
                    {source.trending.length > 0 ? (
                      <div className="rs3-source-trending">
                        <span className="rs3-source-trending-label">Trending</span>
                        <ul className="rs3-source-trending-list">
                          {source.trending.slice(0, 3).map((item) => (
                            <li key={item}>
                              <TrendingUp
                                className="rs3-source-trend-icon"
                                strokeWidth={2.5}
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : source.summary.length > 0 ? (
                      <p className="rs3-source-summary">{source.summary[0]}</p>
                    ) : null}

                    <div className="rs3-source-meta">
                      <span className="rs3-source-sync">
                        Last sync: {formatRelativeSync(source.lastSync)}
                      </span>
                      {source.fromCache && source.cacheAgeMs != null ? (
                        <span className="rs3-source-cache">
                          Cached {formatRelativeSync(
                            new Date(Date.now() - source.cacheAgeMs).toISOString(),
                          )}
                        </span>
                      ) : null}
                      {source.mode === "simulated" ? (
                        <span className="rs3-source-mode">Simulated</span>
                      ) : null}
                    </div>

                    {source.error ? (
                      <p className="rs3-source-error-text">{source.error}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="rs3-source-summary rs3-source-summary-muted">
                    Intelligence feed launching soon
                  </p>
                )}
              </>
            ) : (
              <div className="rs3-source-collapsed">
                <SourceMark name={source.name} color={source.brandColor} />
                <span className={cn("rs3-health-dot", healthClass(source))} />
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
