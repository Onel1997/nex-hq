"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProviderSettingsEntry } from "@/lib/data-source-platform/types";
import type { DataSourceSettingsSnapshot } from "./data-source-types";
import {
  authMethodLabel,
  displayStatusLabel,
  formatCacheAge,
  PROVIDER_DISPLAY_ORDER,
  resolveDisplayStatus,
  type ProviderDisplayStatus,
} from "./data-sources-center-utils";
import { formatRelativeSync } from "./format-sync";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Database,
  Loader2,
  PlugZap,
  RefreshCw,
  TestTube2,
  Unplug,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";

type ProviderAction = "health" | "test" | "disconnect" | "refresh" | "reconnect";

interface ActionFeedback {
  type: "success" | "error" | "info";
  message: string;
}

interface ResearchStudioDataSourcesCenterProps {
  open: boolean;
  onClose: () => void;
  settings: DataSourceSettingsSnapshot | null;
  loading: boolean;
  onRefreshAll: () => Promise<void>;
  onAction: (
    id: string,
    action: ProviderAction,
  ) => Promise<{
    ok?: boolean;
    error?: string;
    message?: string;
    health?: { healthy: boolean; message?: string };
    test?: { ok?: boolean; message?: string; mode?: string };
  }>;
}

function SourceMark({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="rs3-dsc-mark"
      style={{ "--source-color": color } as CSSProperties}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function statusClass(status: ProviderDisplayStatus): string {
  switch (status) {
    case "connected":
      return "rs3-dsc-status-connected";
    case "simulated":
      return "rs3-dsc-status-simulated";
    case "offline":
      return "rs3-dsc-status-offline";
    case "coming_soon":
      return "rs3-dsc-status-soon";
  }
}

function ProviderCard({
  provider,
  busy,
  feedback,
  onAction,
}: {
  provider: ProviderSettingsEntry;
  busy: boolean;
  feedback: ActionFeedback | null;
  onAction: (action: ProviderAction) => void;
}) {
  const [debugOpen, setDebugOpen] = useState(false);
  const displayStatus = resolveDisplayStatus(provider.status, provider.mode);
  const comingSoon = displayStatus === "coming_soon";
  const guide = provider.setupGuide;
  const missingKeys = provider.auth.missingKeys;

  return (
    <article className={cn("rs3-dsc-card", comingSoon && "rs3-dsc-card-soon")}>
      <div className="rs3-dsc-card-header">
        <div className="rs3-dsc-card-identity">
          <SourceMark name={provider.name} color={provider.brandColor} />
          <div>
            <h3 className="rs3-dsc-card-name">{provider.name}</h3>
            <p className="rs3-dsc-card-version">API {provider.apiVersion}</p>
          </div>
        </div>
        <span className={cn("rs3-dsc-status", statusClass(displayStatus))}>
          {displayStatus !== "coming_soon" ? (
            <span className="rs3-dsc-status-dot" />
          ) : null}
          {displayStatusLabel(displayStatus)}
        </span>
      </div>

      {provider.mode === "simulated" && provider.simulatedReason ? (
        <div className="rs3-dsc-simulated-banner">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{provider.simulatedReason}</span>
        </div>
      ) : null}

      {guide ? (
        <div className="rs3-dsc-setup">
          <p className="rs3-dsc-setup-purpose">{guide.purpose}</p>
          <ol className="rs3-dsc-setup-steps">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {guide.docsUrl ? (
            <a
              href={guide.docsUrl}
              className="rs3-dsc-setup-docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Documentation →
            </a>
          ) : null}
          <p className="rs3-dsc-setup-simulated-note">{guide.simulatedWhen}</p>
        </div>
      ) : null}

      <div className="rs3-dsc-metrics">
        <div className="rs3-dsc-metric">
          <span className="rs3-dsc-metric-label">API configured</span>
          <span
            className={cn(
              "rs3-dsc-metric-value",
              provider.auth.configured
                ? "rs3-dsc-metric-yes"
                : "rs3-dsc-metric-no",
            )}
          >
            {provider.auth.configured ? "Yes" : "No"}
          </span>
        </div>
        <div className="rs3-dsc-metric">
          <span className="rs3-dsc-metric-label">Auth method</span>
          <span className="rs3-dsc-metric-value">
            {authMethodLabel(provider.auth.method)}
          </span>
        </div>
        <div className="rs3-dsc-metric">
          <span className="rs3-dsc-metric-label">Last sync</span>
          <span className="rs3-dsc-metric-value">
            {formatRelativeSync(provider.lastSync)}
          </span>
        </div>
        <div className="rs3-dsc-metric">
          <span className="rs3-dsc-metric-label">Cache</span>
          <span className="rs3-dsc-metric-value">
            {formatCacheAge(provider.cacheAgeMs, provider.fromCache)}
          </span>
        </div>
      </div>

      {provider.health ? (
        <div
          className={cn(
            "rs3-dsc-health",
            provider.health.healthy ? "rs3-dsc-health-ok" : "rs3-dsc-health-bad",
          )}
        >
          <Activity className="size-3.5 shrink-0" />
          <span>
            {provider.health.message ??
              (provider.health.healthy ? "Healthy" : "Unhealthy")}
            {provider.health.latencyMs != null
              ? ` · ${provider.health.latencyMs}ms`
              : ""}
          </span>
        </div>
      ) : null}

      {provider.error ? (
        <div className="rs3-dsc-error">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{provider.error}</span>
        </div>
      ) : null}

      {!provider.auth.configured && missingKeys.length > 0 ? (
        <div className="rs3-dsc-debug">
          <button
            type="button"
            className="rs3-dsc-debug-toggle"
            onClick={() => setDebugOpen((open) => !open)}
            aria-expanded={debugOpen}
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", debugOpen && "rotate-180")}
            />
            Developer setup
          </button>
          {debugOpen ? (
            <div className="rs3-dsc-debug-panel">
              <p className="rs3-dsc-debug-label">Missing environment variables</p>
              <ul>
                {missingKeys.map((key) => (
                  <li key={key}>
                    <code>{key}</code>
                  </li>
                ))}
              </ul>
              <p className="rs3-dsc-debug-hint">
                Add these to .env.local — values are never shown here.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <div
          className={cn(
            "rs3-dsc-feedback",
            feedback.type === "success" && "rs3-dsc-feedback-success",
            feedback.type === "error" && "rs3-dsc-feedback-error",
            feedback.type === "info" && "rs3-dsc-feedback-info",
          )}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="size-3.5 shrink-0" />
          ) : (
            <AlertCircle className="size-3.5 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <div className="rs3-dsc-actions">
        <button
          type="button"
          className="rs3-dsc-action"
          disabled={busy || comingSoon}
          onClick={() => onAction("health")}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
          Health
        </button>
        <button
          type="button"
          className="rs3-dsc-action"
          disabled={busy || comingSoon}
          onClick={() => onAction("test")}
        >
          <TestTube2 className="size-3.5" />
          Test
        </button>
        <button
          type="button"
          className="rs3-dsc-action"
          disabled={busy || comingSoon}
          onClick={() => onAction("refresh")}
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
        <button
          type="button"
          className="rs3-dsc-action"
          disabled={busy || comingSoon}
          onClick={() => onAction("reconnect")}
        >
          <PlugZap className="size-3.5" />
          Reconnect
        </button>
        <button
          type="button"
          className="rs3-dsc-action rs3-dsc-action-danger"
          disabled={busy || comingSoon}
          onClick={() => onAction("disconnect")}
        >
          <Unplug className="size-3.5" />
          Disconnect
        </button>
      </div>
    </article>
  );
}

export function ResearchStudioDataSourcesCenter({
  open,
  onClose,
  settings,
  loading,
  onRefreshAll,
  onAction,
}: ResearchStudioDataSourcesCenterProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, ActionFeedback>>(
    {},
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setFeedbackMap({});
      setBusyId(null);
    }
  }, [open]);

  const sortedProviders = useMemo(() => {
    if (!settings) return [];
    const order = new Map(
      PROVIDER_DISPLAY_ORDER.map((id, index) => [id, index]),
    );
    return [...settings.providers].sort(
      (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
    );
  }, [settings]);

  const handleAction = useCallback(
    async (id: string, action: ProviderAction) => {
      setBusyId(id);
      try {
        const apiAction =
          action === "reconnect" ? "refresh" : action;
        const result = await onAction(id, apiAction);

        if (action === "health" && result.health) {
          const health = result.health;
          setFeedbackMap((prev) => ({
            ...prev,
            [id]: {
              type: health.healthy ? "success" : "error",
              message:
                health.message ??
                (health.healthy ? "Health check passed" : "Health check failed"),
            },
          }));
        } else if (action === "test") {
          setFeedbackMap((prev) => ({
            ...prev,
            [id]: {
              type: result.ok ? "success" : "error",
              message:
                result.message ??
                (result.ok
                  ? "Manual test completed"
                  : result.error ?? "Manual test failed"),
            },
          }));
        } else if (action === "disconnect") {
          setFeedbackMap((prev) => ({
            ...prev,
            [id]: {
              type: "info",
              message: "Cache cleared — reconnect to sync again",
            },
          }));
        } else if (action === "refresh" || action === "reconnect") {
          setFeedbackMap((prev) => ({
            ...prev,
            [id]: {
              type: result.ok ? "success" : "error",
              message: result.ok
                ? action === "reconnect"
                  ? "Reconnected successfully"
                  : "Provider refreshed"
                : result.error ?? "Action failed",
            },
          }));
        }
      } catch {
        setFeedbackMap((prev) => ({
          ...prev,
          [id]: { type: "error", message: "Action failed" },
        }));
      } finally {
        setBusyId(null);
      }
    },
    [onAction],
  );

  if (!open) return null;

  return (
    <div
      className="rs3-dsc-overlay"
      role="dialog"
      aria-modal
      aria-label="Data Sources Center"
    >
      <button
        type="button"
        className="rs3-dsc-backdrop"
        onClick={onClose}
        aria-label="Close Data Sources Center"
      />
      <div className="rs3-dsc-panel">
        <header className="rs3-dsc-header">
          <div className="rs3-dsc-header-main">
            <div className="rs3-dsc-header-icon">
              <Database className="size-5" />
            </div>
            <div>
              <p className="rs3-dsc-eyebrow">Research Studio</p>
              <h2 className="rs3-dsc-title">Data Sources Center</h2>
              <p className="rs3-dsc-subtitle">
                Manage live intelligence connections for Milaene
              </p>
            </div>
          </div>
          <div className="rs3-dsc-header-actions">
            <button
              type="button"
              className="rs3-dsc-header-btn"
              onClick={() => void onRefreshAll()}
              disabled={loading}
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Sync all
            </button>
            <button
              type="button"
              className="rs3-dsc-header-btn rs3-dsc-header-btn-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {settings ? (
          <div className="rs3-dsc-summary">
            <div className="rs3-dsc-summary-stat rs3-dsc-summary-connected">
              <span className="rs3-dsc-summary-value">
                {settings.connectedCount}
              </span>
              <span className="rs3-dsc-summary-label">Connected</span>
            </div>
            <div className="rs3-dsc-summary-stat rs3-dsc-summary-simulated">
              <span className="rs3-dsc-summary-value">
                {settings.simulatedCount}
              </span>
              <span className="rs3-dsc-summary-label">Simulated</span>
            </div>
            <div className="rs3-dsc-summary-stat rs3-dsc-summary-offline">
              <span className="rs3-dsc-summary-value">
                {settings.offlineCount}
              </span>
              <span className="rs3-dsc-summary-label">Offline</span>
            </div>
            <div className="rs3-dsc-summary-stat rs3-dsc-summary-soon">
              <span className="rs3-dsc-summary-value">
                {settings.comingSoonCount}
              </span>
              <span className="rs3-dsc-summary-label">Coming Soon</span>
            </div>
          </div>
        ) : null}

        {loading && !settings ? (
          <div className="rs3-dsc-loading">
            <Loader2 className="size-5 animate-spin" />
            <span>Loading data sources…</span>
          </div>
        ) : (
          <div className="rs3-dsc-grid">
            {sortedProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                busy={busyId === provider.id}
                feedback={feedbackMap[provider.id] ?? null}
                onAction={(action) => void handleAction(provider.id, action)}
              />
            ))}
          </div>
        )}

        <footer className="rs3-dsc-footer">
          <p>
            Credentials are stored in environment variables — values are never
            shown here. Configure keys in your deployment settings.
          </p>
        </footer>
      </div>
    </div>
  );
}
