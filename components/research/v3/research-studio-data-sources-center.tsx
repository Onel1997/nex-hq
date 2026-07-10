"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProviderSettingsEntry } from "@/lib/data-source-platform/types";
import type { DataSourceSettingsSnapshot } from "./data-source-types";
import {
  authMethodLabel,
  displayStatusLabel,
  formatCacheAge,
  groupProvidersBySection,
  resolveDisplayStatus,
  type ProviderDisplayStatus,
} from "./data-sources-center-utils";
import { formatRelativeSync } from "./format-sync";
import { useDictionary, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  FileText,
  KeyRound,
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
  const locale = useLocale();
  const { research } = useDictionary();
  const ds = research.studio.dataSources;
  const [developerOpen, setDeveloperOpen] = useState(false);
  const displayStatus = resolveDisplayStatus(provider.status, provider.mode);
  const comingSoon = displayStatus === "coming_soon";
  const guide = provider.setupGuide;
  const requiredKeys = guide?.requiredEnvKeys ?? provider.auth.envKeys;
  const missingKeys = provider.auth.missingKeys;

  return (
    <article className={cn("rs3-dsc-card", comingSoon && "rs3-dsc-card-soon")}>
      <div className="rs3-dsc-card-body">
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
            {displayStatusLabel(displayStatus, locale)}
          </span>
        </div>

        {provider.mode === "simulated" && provider.simulatedReason ? (
          <div className="rs3-dsc-simulated-banner">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{provider.simulatedReason}</span>
          </div>
        ) : null}

        {guide ? (
          <>
            <div className="rs3-dsc-block">
              <p className="rs3-dsc-block-label">{ds.description}</p>
              <p className="rs3-dsc-block-copy">{guide.purpose}</p>
            </div>

            {guide.limitations.length > 0 ? (
              <div className="rs3-dsc-block rs3-dsc-block-limitations">
                <p className="rs3-dsc-block-label">{ds.limitations}</p>
                <ul className="rs3-dsc-bullet-list">
                  {guide.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {guide.notes.length > 0 ? (
              <div className="rs3-dsc-block rs3-dsc-block-notes">
                <p className="rs3-dsc-block-label">{ds.notes}</p>
                <ul className="rs3-dsc-bullet-list">
                  {guide.notes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rs3-dsc-debug">
              <button
                type="button"
                className="rs3-dsc-debug-toggle"
                onClick={() => setDeveloperOpen((open) => !open)}
                aria-expanded={developerOpen}
              >
                <KeyRound className="size-3.5 shrink-0" />
                <span>{ds.developerSetup}</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform",
                    developerOpen && "rotate-180",
                  )}
                />
              </button>
              {developerOpen ? (
                <div className="rs3-dsc-debug-panel">
                  <p className="rs3-dsc-debug-label">{ds.credentialRequirements}</p>
                  {requiredKeys.length > 0 ? (
                    <ul className="rs3-dsc-env-list">
                      {requiredKeys.map((key) => {
                        const missing = missingKeys.includes(key);
                        return (
                          <li
                            key={key}
                            className={cn(missing && "rs3-dsc-env-missing")}
                          >
                            <code>{key}</code>
                            <span>{missing ? ds.missing : ds.configured}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="rs3-dsc-debug-hint">{ds.noCredentialsRequired}</p>
                  )}

                  {guide.steps.length > 0 ? (
                    <>
                      <p className="rs3-dsc-debug-label">{ds.setupSteps}</p>
                      <ol className="rs3-dsc-setup-steps">
                        {guide.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </>
                  ) : null}

                  <p className="rs3-dsc-debug-hint">{ds.envHint}</p>
                </div>
              ) : null}
            </div>

            {guide.docsUrl ? (
              <a
                href={guide.docsUrl}
                className="rs3-dsc-setup-docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BookOpen className="size-3.5" />
                {ds.documentation}
              </a>
            ) : null}
          </>
        ) : null}

        <div className="rs3-dsc-metrics">
          <div className="rs3-dsc-metric">
            <span className="rs3-dsc-metric-label">{ds.authMethod}</span>
            <span className="rs3-dsc-metric-value">
              {authMethodLabel(provider.auth.method, locale)}
            </span>
          </div>
          <div className="rs3-dsc-metric">
            <span className="rs3-dsc-metric-label">{ds.apiConfigured}</span>
            <span
              className={cn(
                "rs3-dsc-metric-value",
                provider.auth.configured
                  ? "rs3-dsc-metric-yes"
                  : "rs3-dsc-metric-no",
              )}
            >
              {provider.auth.configured ? ds.yes : ds.no}
            </span>
          </div>
          <div className="rs3-dsc-metric">
            <span className="rs3-dsc-metric-label">{ds.lastSync}</span>
            <span className="rs3-dsc-metric-value">
              {formatRelativeSync(provider.lastSync, locale)}
            </span>
          </div>
          <div className="rs3-dsc-metric">
            <span className="rs3-dsc-metric-label">{ds.cacheStatus}</span>
            <span className="rs3-dsc-metric-value">
              {formatCacheAge(provider.cacheAgeMs, provider.fromCache, locale)}
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
                (provider.health.healthy ? ds.healthy : ds.unhealthy)}
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
      </div>

      <div className="rs3-dsc-actions">
        <button
          type="button"
          className="rs3-dsc-action"
          disabled={busy || comingSoon}
          onClick={() => onAction("health")}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
          {ds.health}
        </button>
        <button
          type="button"
          className="rs3-dsc-action"
          disabled={busy || comingSoon}
          onClick={() => onAction("test")}
        >
          <TestTube2 className="size-3.5" />
          {ds.test}
        </button>
        <button
          type="button"
          className="rs3-dsc-action"
          disabled={busy || comingSoon}
          onClick={() => onAction("refresh")}
        >
          <RefreshCw className="size-3.5" />
          {ds.refresh}
        </button>
        <button
          type="button"
          className="rs3-dsc-action"
          disabled={busy || comingSoon}
          onClick={() => onAction("reconnect")}
        >
          <PlugZap className="size-3.5" />
          {ds.reconnect}
        </button>
        <button
          type="button"
          className="rs3-dsc-action rs3-dsc-action-danger"
          disabled={busy || comingSoon}
          onClick={() => onAction("disconnect")}
        >
          <Unplug className="size-3.5" />
          {ds.disconnect}
        </button>
      </div>
    </article>
  );
}

function ProviderSection({
  title,
  subtitle,
  providers,
  busyId,
  feedbackMap,
  onAction,
}: {
  title: string;
  subtitle: string;
  providers: ProviderSettingsEntry[];
  busyId: string | null;
  feedbackMap: Record<string, ActionFeedback>;
  onAction: (id: string, action: ProviderAction) => void;
}) {
  const { research } = useDictionary();
  const ds = research.studio.dataSources;
  if (providers.length === 0) return null;

  return (
    <section className="rs3-dsc-section">
      <header className="rs3-dsc-section-head">
        <div>
          <h3 className="rs3-dsc-section-title">{title}</h3>
          <p className="rs3-dsc-section-subtitle">{subtitle}</p>
        </div>
        <span className="rs3-dsc-section-count">
          {ds.sourcesCount.replace("{count}", String(providers.length))}
        </span>
      </header>
      <div className="rs3-dsc-grid">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            busy={busyId === provider.id}
            feedback={feedbackMap[provider.id] ?? null}
            onAction={(action) => onAction(provider.id, action)}
          />
        ))}
      </div>
    </section>
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
  const locale = useLocale();
  const { research, agents } = useDictionary();
  const ds = research.studio.dataSources;
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

  const groupedProviders = useMemo(() => {
    if (!settings) return { connected: [], planned: [] };
    return groupProvidersBySection(settings.providers);
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
                (health.healthy ? ds.healthPassed : ds.healthFailed),
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
                  ? ds.manualTestCompleted
                  : result.error ?? ds.manualTestFailed),
            },
          }));
        } else if (action === "disconnect") {
          setFeedbackMap((prev) => ({
            ...prev,
            [id]: {
              type: "info",
              message: ds.cacheCleared,
            },
          }));
        } else if (action === "refresh" || action === "reconnect") {
          setFeedbackMap((prev) => ({
            ...prev,
            [id]: {
              type: result.ok ? "success" : "error",
              message: result.ok
                ? action === "reconnect"
                  ? ds.reconnected
                  : ds.providerRefreshed
                : result.error ?? ds.actionFailed,
            },
          }));
        }
      } catch {
        setFeedbackMap((prev) => ({
          ...prev,
          [id]: { type: "error", message: ds.actionFailed },
        }));
      } finally {
        setBusyId(null);
      }
    },
    [onAction, ds],
  );

  if (!open) return null;

  return (
    <div
      className="rs3-dsc-overlay"
      role="dialog"
      aria-modal
      aria-label={ds.ariaLabel}
    >
      <button
        type="button"
        className="rs3-dsc-backdrop"
        onClick={onClose}
        aria-label={ds.close}
      />
      <div className="rs3-dsc-panel">
        <header className="rs3-dsc-header">
          <div className="rs3-dsc-header-main">
            <div className="rs3-dsc-header-icon">
              <Database className="size-5" />
            </div>
            <div>
              <p className="rs3-dsc-eyebrow">{agents.studioNames.research}</p>
              <h2 className="rs3-dsc-title">{ds.title}</h2>
              <p className="rs3-dsc-subtitle">{ds.subtitle}</p>
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
              {ds.syncAll}
            </button>
            <button
              type="button"
              className="rs3-dsc-header-btn rs3-dsc-header-btn-close"
              onClick={onClose}
              aria-label={ds.closeShort}
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
              <span className="rs3-dsc-summary-label">{ds.summary.connected}</span>
            </div>
            <div className="rs3-dsc-summary-stat rs3-dsc-summary-simulated">
              <span className="rs3-dsc-summary-value">
                {settings.simulatedCount}
              </span>
              <span className="rs3-dsc-summary-label">{ds.summary.simulated}</span>
            </div>
            <div className="rs3-dsc-summary-stat rs3-dsc-summary-offline">
              <span className="rs3-dsc-summary-value">
                {settings.offlineCount}
              </span>
              <span className="rs3-dsc-summary-label">{ds.summary.offline}</span>
            </div>
            <div className="rs3-dsc-summary-stat rs3-dsc-summary-soon">
              <span className="rs3-dsc-summary-value">
                {settings.comingSoonCount}
              </span>
              <span className="rs3-dsc-summary-label">{ds.summary.comingSoon}</span>
            </div>
            <div className="rs3-dsc-summary-stat rs3-dsc-summary-live">
              <span className="rs3-dsc-summary-value">{settings.liveCount}</span>
              <span className="rs3-dsc-summary-label">{ds.summary.liveSources}</span>
            </div>
            <div className="rs3-dsc-summary-stat rs3-dsc-summary-sync">
              <span className="rs3-dsc-summary-value rs3-dsc-summary-sync-value">
                <Clock3 className="size-3.5" />
                {formatRelativeSync(settings.loadedAt, locale)}
              </span>
              <span className="rs3-dsc-summary-label">{ds.summary.lastSync}</span>
            </div>
          </div>
        ) : null}

        <div className="rs3-dsc-content">
          {loading && !settings ? (
            <div className="rs3-dsc-loading">
              <Loader2 className="size-5 animate-spin" />
              <span>{ds.loading}</span>
            </div>
          ) : (
            <>
              <ProviderSection
                title={ds.connectedTitle}
                subtitle={ds.connectedSubtitle}
                providers={groupedProviders.connected}
                busyId={busyId}
                feedbackMap={feedbackMap}
                onAction={handleAction}
              />
              <ProviderSection
                title={ds.plannedTitle}
                subtitle={ds.plannedSubtitle}
                providers={groupedProviders.planned}
                busyId={busyId}
                feedbackMap={feedbackMap}
                onAction={handleAction}
              />
            </>
          )}
        </div>

        <footer className="rs3-dsc-footer">
          <FileText className="size-3.5 shrink-0 opacity-50" />
          <p>{ds.footerNote}</p>
        </footer>
      </div>
    </div>
  );
}
