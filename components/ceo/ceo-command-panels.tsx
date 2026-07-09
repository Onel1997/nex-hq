"use client";

import Link from "next/link";
import { useState } from "react";
import type { AgentId } from "@/lib/constants/agents";
import { SPECIALIST_AGENT_IDS } from "@/lib/constants/agents";
import type {
  CeoAgentOperationalStatus,
} from "@/lib/ceo/ceo-command-intelligence";
import type { CeoDashboardData } from "@/components/ceo/use-ceo-dashboard";
import {
  getAgentCatalog,
  getTaskStatusLabels,
  TASK_STATUS_ORDER,
} from "@/lib/i18n/data";
import { useLocale, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/tasks/types";
import { ChevronDown, FileText, Loader2 } from "lucide-react";

type PanelId =
  | "intelligence"
  | "agents"
  | "health"
  | "reports"
  | "tasks"
  | "market";

interface CeoCommandPanelsProps {
  data: CeoDashboardData | null;
  isLoading?: boolean;
  error?: string | null;
}

function agentStatusLabel(
  status: CeoAgentOperationalStatus,
  t: ReturnType<typeof useT>,
): string {
  const keys: Record<CeoAgentOperationalStatus, string> = {
    active: "ceo.intelligence.agentStatusActive",
    waiting: "ceo.intelligence.agentStatusWaiting",
    running: "ceo.intelligence.agentStatusRunning",
    completed: "ceo.intelligence.agentStatusCompleted",
  };
  return t(keys[status]);
}

function agentStatusClass(status: CeoAgentOperationalStatus): string {
  if (status === "running") return "ceo-status-running";
  if (status === "active") return "ceo-status-active";
  if (status === "completed") return "ceo-status-completed";
  return "ceo-status-waiting";
}

function taskStatusClass(status: TaskStatus): string {
  if (status === "completed") return "ceo-status-completed";
  if (status === "failed") return "ceo-status-failed";
  if (status === "in_progress" || status === "review" || status === "assigned") {
    return "ceo-status-active";
  }
  return "ceo-status-waiting";
}

function CeoAccordionSection({
  id,
  title,
  meta,
  open,
  onToggle,
  children,
}: {
  id: PanelId;
  title: string;
  meta?: string;
  open: boolean;
  onToggle: (id: PanelId) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("ceo-accordion-item", open && "ceo-accordion-item-open")}>
      <button
        type="button"
        className="ceo-accordion-trigger"
        aria-expanded={open}
        onClick={() => onToggle(id)}
      >
        <div className="ceo-accordion-trigger-text">
          <p className="ceo-accordion-trigger-title">{title}</p>
          {meta ? (
            <p className="ceo-accordion-trigger-meta">{meta}</p>
          ) : null}
        </div>
        <ChevronDown className="ceo-accordion-chevron size-5" />
      </button>
      <div
        className={cn(
          "ceo-accordion-content-wrap",
          open && "ceo-accordion-content-wrap-open",
        )}
      >
        <div className="ceo-accordion-content">{children}</div>
      </div>
    </div>
  );
}

export function CeoCommandPanels({
  data,
  isLoading = false,
  error = null,
}: CeoCommandPanelsProps) {
  const t = useT();
  const locale = useLocale();
  const statusLabels = getTaskStatusLabels(locale);
  const agentCatalog = getAgentCatalog(locale);
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);

  const togglePanel = (id: PanelId) => {
    setOpenPanel((current) => (current === id ? null : id));
  };

  if (isLoading && !data) {
    return (
      <div className="ceo-command-panels">
        <p className="ceo-command-panels-label">{t("ceo.panels.label")}</p>
        <div className="ceo-panels-loading">
          <Loader2 className="size-4 animate-spin" />
          <span>{t("ceo.dashboard.loading")}</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="ceo-command-panels">
        <p className="ceo-command-panels-label">{t("ceo.panels.label")}</p>
        <p className="ceo-panel-empty">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const intel = data.intelligence;
  const { overview } = intel;

  const signalCount =
    intel.recommendations.length + intel.companySignals.length;

  const activeDepartments = intel.agentStatus.filter(
    (a) => a.status !== "waiting",
  ).length;

  const healthSummary = [
    { label: t("ceo.dashboard.activeExecutions"), value: data.summary.execution.activeExecutions },
    { label: t("ceo.dashboard.pendingReview"), value: data.summary.execution.pendingReview },
    { label: t("ceo.dashboard.completedToday"), value: data.summary.execution.completedToday },
    { label: t("ceo.dashboard.activeTasks"), value: data.summary.active },
    { label: t("ceo.dashboard.completedTasks"), value: data.summary.completed },
    { label: t("ceo.dashboard.ceoCreated"), value: data.summary.ceoCreated },
  ];

  return (
    <div className="ceo-command-panels">
      <p className="ceo-command-panels-label">{t("ceo.panels.label")}</p>

      <div className="ceo-accordion">
        <CeoAccordionSection
          id="intelligence"
          title={t("ceo.panels.executiveIntelligence")}
          meta={t("ceo.panels.businessSignals", {
            count: String(signalCount),
          })}
          open={openPanel === "intelligence"}
          onToggle={togglePanel}
        >
          <div className="ceo-panel-overview-line">
            <span>
              <strong>{t("ceo.intelligence.revenue")}:</strong>{" "}
              {overview.historicalRevenue}
            </span>
            <span>
              <strong>{t("ceo.intelligence.orders")}:</strong>{" "}
              {overview.historicalOrders}
            </span>
            {overview.bestSeller ? (
              <span>
                <strong>{t("ceo.intelligence.bestSeller")}:</strong>{" "}
                {overview.bestSeller}
              </span>
            ) : null}
            {overview.topCategory ? (
              <span>
                <strong>{t("ceo.intelligence.topCategory")}:</strong>{" "}
                {overview.topCategory}
              </span>
            ) : null}
          </div>
          <ul className="ceo-panel-list">
            {intel.recommendations.map((rec) => (
              <li key={rec.id}>
                <span
                  className={cn(
                    "ceo-priority-dot",
                    rec.priority === "high" && "ceo-priority-dot-high",
                  )}
                />
                {rec.message}
              </li>
            ))}
          </ul>
          {intel.companySignals.length > 0 ? (
            <>
              <p className="ceo-panel-section-label">
                {t("ceo.intelligence.companySignals")}
              </p>
              <ul className="ceo-panel-list">
                {intel.companySignals.map((signal) => (
                  <li key={signal.id}>{signal.message}</li>
                ))}
              </ul>
            </>
          ) : null}
        </CeoAccordionSection>

        <CeoAccordionSection
          id="agents"
          title={t("ceo.panels.agentStatus")}
          meta={t("ceo.panels.departmentsActive", {
            count: String(activeDepartments),
          })}
          open={openPanel === "agents"}
          onToggle={togglePanel}
        >
          {intel.agentStatus.map((agent) => (
            <div key={agent.agentId} className="ceo-panel-row">
              <div>
                <p className="ceo-panel-row-label">{agent.department}</p>
                {agent.activeTask ? (
                  <p className="ceo-panel-row-sub">{agent.activeTask}</p>
                ) : null}
              </div>
              <span
                className={cn(
                  "ceo-status-pill",
                  agentStatusClass(agent.status),
                )}
              >
                {agentStatusLabel(agent.status, t)}
              </span>
            </div>
          ))}
        </CeoAccordionSection>

        <CeoAccordionSection
          id="market"
          title={t("ceo.panels.marketIntelligence")}
          meta={t("ceo.panels.premiumProductsMeta", {
            count: String(intel.marketPrint.summary.premiumCount),
          })}
          open={openPanel === "market"}
          onToggle={togglePanel}
        >
          <div className="ceo-panel-overview-line">
            <span>
              <strong>{t("ceo.intelligence.premiumProducts")}:</strong>{" "}
              {intel.marketPrint.summary.premiumCount}
            </span>
            <span>
              <strong>{t("ceo.intelligence.campaignProducts")}:</strong>{" "}
              {intel.marketPrint.summary.campaignCount}
            </span>
            <span>
              <strong>{t("ceo.intelligence.embroidery")}:</strong>{" "}
              {intel.marketPrint.summary.embroideryCount}
            </span>
          </div>
          {intel.marketPrint.premiumProducts.length > 0 ? (
            <>
              <p className="ceo-panel-section-label">
                {t("ceo.intelligence.premiumProducts")}
              </p>
              <ul className="ceo-panel-list">
                {intel.marketPrint.premiumProducts.map((p) => (
                  <li key={p.title}>
                    {p.title} · {p.suitability}% fit
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {intel.marketPrint.highPerformingCategories.length > 0 ? (
            <>
              <p className="ceo-panel-section-label">
                {t("ceo.intelligence.highCategories")}
              </p>
              <p className="text-sm text-[rgb(203_213_225/0.82)]">
                {intel.marketPrint.highPerformingCategories.join(" · ")}
              </p>
            </>
          ) : null}
          {intel.marketPrint.productionLimitations.length > 0 ? (
            <>
              <p className="ceo-panel-section-label">
                {t("ceo.intelligence.limitations")}
              </p>
              <ul className="ceo-panel-list">
                {intel.marketPrint.productionLimitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
        </CeoAccordionSection>

        <CeoAccordionSection
          id="reports"
          title={t("ceo.panels.reports")}
          meta={
            data.latestFinalReport
              ? t("ceo.panels.reportReady")
              : t("ceo.panels.reportPending")
          }
          open={openPanel === "reports"}
          onToggle={togglePanel}
        >
          {data.latestFinalReport ? (
            <>
              <p className="ceo-panel-row-label">{data.latestFinalReport.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[rgb(203_213_225/0.82)]">
                {data.latestFinalReport.executiveSummary}
              </p>
              <div className="mt-3 space-y-2 text-sm text-[var(--ceo-status-muted)]">
                <p>
                  {t("ceo.executiveSummary.completionScore")}:{" "}
                  {data.latestFinalReport.completionScore}%
                </p>
                <p>{data.latestFinalReport.ceoVerdict}</p>
              </div>
              <Link href="/facility/reports" className="ceo-panel-link">
                {t("ceo.executiveSummary.viewReport")}
                <FileText className="size-3.5" />
              </Link>
            </>
          ) : (
            <p className="ceo-panel-empty">{t("ceo.executiveSummary.noReport")}</p>
          )}
        </CeoAccordionSection>

        <CeoAccordionSection
          id="health"
          title={t("ceo.panels.businessHealth")}
          meta={`${data.summary.total} ${t("ceo.panels.totalTasks")}`}
          open={openPanel === "health"}
          onToggle={togglePanel}
        >
          <div className="ceo-panel-overview-line">
            {healthSummary.map(({ label, value }) => (
              <span key={label}>
                <strong>{label}:</strong> {value}
              </span>
            ))}
          </div>
          <p className="ceo-panel-section-label">
            {t("ceo.dashboard.byStatus")}
          </p>
          {TASK_STATUS_ORDER.map((status) => {
            const count = data.byStatus[status]?.length ?? 0;
            return (
              <div key={status} className="ceo-panel-row">
                <span className="ceo-panel-row-label">
                  {statusLabels[status]}
                </span>
                <span className="ceo-status-pill ceo-status-waiting">
                  {count}
                </span>
              </div>
            );
          })}
        </CeoAccordionSection>

        <CeoAccordionSection
          id="tasks"
          title={t("ceo.panels.tasks")}
          meta={`${data.ceoTasks.length} ${t("ceo.panels.delegated")}`}
          open={openPanel === "tasks"}
          onToggle={togglePanel}
        >
          {data.ceoTasks.length === 0 ? (
            <p className="ceo-panel-empty">{t("ceo.intelligence.noDecisions")}</p>
          ) : (
            <ul className="ceo-panel-list">
              {data.ceoTasks.slice(0, 12).map((task) => (
                <li key={task.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{task.title}</span>
                    <span
                      className={cn(
                        "ceo-status-pill",
                        taskStatusClass(task.status),
                      )}
                    >
                      {statusLabels[task.status]}
                    </span>
                  </div>
                  {task.assigneeAgentId ? (
                    <p className="mt-1 text-xs text-[var(--ceo-status-muted)]">
                      {agentCatalog[task.assigneeAgentId]?.name ??
                        task.assigneeAgentId}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {SPECIALIST_AGENT_IDS.some(
            (id) => (data.byAgent[id]?.length ?? 0) > 0,
          ) ? (
            <>
              <p className="ceo-panel-section-label">
                {t("ceo.dashboard.byAgent")}
              </p>
              {SPECIALIST_AGENT_IDS.map((agentId) => {
                const tasks = data.byAgent[agentId] ?? [];
                if (tasks.length === 0) return null;
                return (
                  <div key={agentId} className="ceo-panel-row">
                    <span className="ceo-panel-row-label">
                      {agentCatalog[agentId].name}
                    </span>
                    <span className="ceo-status-pill ceo-status-waiting">
                      {tasks.length}
                    </span>
                  </div>
                );
              })}
            </>
          ) : null}
          <Link href="/facility/missions" className="ceo-panel-link">
            {t("ceo.dashboard.viewTaskBoard")}
          </Link>
        </CeoAccordionSection>
      </div>
    </div>
  );
}