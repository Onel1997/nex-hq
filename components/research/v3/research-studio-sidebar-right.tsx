"use client";

import type { CSSProperties } from "react";
import type { ProviderSnapshot } from "./data-source-types";
import { formatRelativeSync } from "./format-sync";
import { useDictionary, useLocale } from "@/lib/i18n";
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

type SidebarLabels = ReturnType<
  typeof useDictionary
>["research"]["studio"]["sidebar"];

function resolveStatusPill(
  provider: ProviderSnapshot,
  labels: SidebarLabels,
): {
  short: string;
  label: string;
  className: string;
} {
  if (provider.status === "disconnected") {
    return {
      short: labels.statusShort.soon,
      label: labels.comingSoon,
      className: "rs3-source-status-soon",
    };
  }
  if (provider.status === "authentication_error") {
    return {
      short: labels.statusShort.auth,
      label: labels.authError,
      className: "rs3-source-status-error",
    };
  }
  if (
    provider.mode === "simulated" &&
    provider.status !== "offline" &&
    provider.status !== "rate_limited"
  ) {
    return {
      short: labels.statusShort.sim,
      label: labels.simulated,
      className: "rs3-source-status-simulated",
    };
  }
  if (provider.status === "connected" && provider.mode === "live") {
    return {
      short: labels.statusShort.live,
      label: labels.connected,
      className: "rs3-source-status-live",
    };
  }
  if (provider.status === "syncing") {
    return {
      short: labels.statusShort.sync,
      label: labels.syncing,
      className: "rs3-source-status-syncing",
    };
  }
  if (provider.status === "rate_limited") {
    return {
      short: labels.statusShort.limit,
      label: labels.rateLimited,
      className: "rs3-source-status-warn",
    };
  }
  return {
    short: labels.statusShort.offline,
    label: labels.offline,
    className: "rs3-source-status-offline",
  };
}

function statusLabel(
  status: ProviderSnapshot["status"],
  labels: SidebarLabels,
): string {
  switch (status) {
    case "connected":
      return labels.connected;
    case "syncing":
      return labels.syncing;
    case "authentication_error":
      return labels.authError;
    case "rate_limited":
      return labels.rateLimited;
    case "offline":
      return labels.offline;
    case "disconnected":
      return labels.comingSoon;
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
  const { research } = useDictionary();
  const locale = useLocale();
  const sidebar = research.studio.sidebar;

  return (
    <aside
      className={cn(
        "rs3-sidebar rs3-sidebar-right",
        collapsed && "rs3-sidebar-collapsed",
      )}
      aria-label={sidebar.sourcesAria}
    >
      <div className="rs3-sidebar-header rs3-sidebar-header-right">
        {!collapsed ? (
          <div className="rs3-sources-heading">
            <div className="rs3-sources-heading-title">
              <span className="rs3-sources-pulse" />
              <span className="rs3-sources-heading-text">
                {sidebar.liveIntelligence}
              </span>
            </div>
            <div className="rs3-sources-heading-actions">
              {onOpenDataSources ? (
                <button
                  type="button"
                  className="rs3-sources-manage"
                  onClick={onOpenDataSources}
                  title={sidebar.openDataSources}
                >
                  {sidebar.manage}
                </button>
              ) : null}
              <button
                type="button"
                className="rs3-sources-refresh"
                onClick={onRefreshAll}
                disabled={refreshing}
                aria-label={sidebar.refreshAll}
                title={sidebar.refreshAll}
              >
                <RefreshCw
                  className={cn("size-3.5", refreshing && "animate-spin")}
                />
              </button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="rs3-sidebar-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? sidebar.expandSources : sidebar.collapseSources}
        >
          {collapsed ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
      </div>

      <div className="rs3-sources-list">
        {loading && providers.length === 0 ? (
          <div className="rs3-sources-loading">
            <Loader2 className="size-4 animate-spin" />
            <span>{sidebar.connecting}</span>
          </div>
        ) : null}

        {error ? (
          <div className="rs3-sources-error" role="alert">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {providers.map((source, index) => {
          const statusPill = resolveStatusPill(source, sidebar);
          return (
            <div
              key={source.id}
              className={cn(
                "rs3-source-card",
                source.status === "connected" &&
                  source.mode === "live" &&
                  "rs3-source-card-live",
                source.status === "disconnected" && "rs3-source-card-soon",
                source.error &&
                  source.status !== "disconnected" &&
                  "rs3-source-card-error",
                index > 0 && "rs3-source-card-divided",
              )}
            >
              {!collapsed ? (
                <>
                  <div className="rs3-source-card-head">
                    <div className="rs3-source-identity">
                      <SourceMark name={source.name} color={source.brandColor} />
                      <span className="rs3-source-name">{source.name}</span>
                    </div>
                    <div className="rs3-source-head-actions">
                      <button
                        type="button"
                        className="rs3-source-refresh-btn"
                        onClick={() => onRefreshProvider(source.id)}
                        aria-label={sidebar.refreshSourceNamed.replace(
                          "{name}",
                          source.name,
                        )}
                        title={sidebar.refreshSource}
                      >
                        <RefreshCw className="size-3" />
                      </button>
                      <span
                        className={cn(
                          "rs3-source-status-pill",
                          statusPill.className,
                        )}
                        title={statusPill.label}
                      >
                        <span className="rs3-source-status-dot" aria-hidden />
                        <span className="rs3-source-status-text">
                          {statusPill.short}
                        </span>
                      </span>
                    </div>
                  </div>

                  {source.status !== "disconnected" ? (
                    <div className="rs3-source-body">
                      {source.trending.length > 0 ? (
                        <div className="rs3-source-trending">
                          <span className="rs3-source-trending-label">
                            {sidebar.trending}
                          </span>
                          <ul className="rs3-source-trending-list">
                            {source.trending.slice(0, 3).map((item) => (
                              <li key={item}>
                                <TrendingUp
                                  className="rs3-source-trend-icon"
                                  strokeWidth={2.5}
                                  aria-hidden
                                />
                                <span className="rs3-source-trend-text">
                                  {item}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : source.summary.length > 0 ? (
                        <p className="rs3-source-summary">{source.summary[0]}</p>
                      ) : null}

                      <div className="rs3-source-meta">
                        <span
                          className={cn("rs3-health-dot", healthClass(source))}
                        />
                        <span className="rs3-source-sync">
                          {formatRelativeSync(source.lastSync, locale)}
                        </span>
                        {source.fromCache && source.cacheAgeMs != null ? (
                          <span className="rs3-source-cache">
                            {sidebar.cached}
                          </span>
                        ) : null}
                        {source.mode === "simulated" ? (
                          <span className="rs3-source-mode">
                            {sidebar.statusShort.sim}
                          </span>
                        ) : source.status === "connected" &&
                          source.mode === "live" ? (
                          <span className="rs3-source-mode rs3-source-mode-live">
                            {sidebar.statusShort.live}
                          </span>
                        ) : null}
                      </div>

                      {source.error ? (
                        <p className="rs3-source-error-text">{source.error}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="rs3-source-summary rs3-source-summary-muted">
                      {sidebar.feedSoon}
                    </p>
                  )}
                </>
              ) : (
                <div
                  className="rs3-source-collapsed"
                  title={`${source.name} — ${statusLabel(source.status, sidebar)}`}
                >
                  <SourceMark name={source.name} color={source.brandColor} />
                  <span className={cn("rs3-health-dot", healthClass(source))} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
