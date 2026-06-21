"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AgentId } from "@/lib/constants/agents";
import { SPECIALIST_AGENT_IDS } from "@/lib/constants/agents";
import {
  getAgentCatalog,
  getTaskStatusLabels,
  TASK_STATUS_ORDER,
} from "@/lib/i18n/data";
import { useLocale, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TaskListItem, TaskStatus } from "@/tasks/types";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Crown,
  FileText,
  Loader2,
  PlayCircle,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TaskLinkedReport {
  id: string;
  reportId: string;
  title: string;
  agentId: string;
  status: string;
  summary: string;
}

interface CeoTaskWithReports extends TaskListItem {
  linkedReports: TaskLinkedReport[];
}

interface DashboardData {
  summary: {
    active: number;
    completed: number;
    blocked: number;
    total: number;
    ceoCreated: number;
    execution: {
      activeExecutions: number;
      pendingReview: number;
      completedToday: number;
      failedTasks: number;
    };
  };
  byStatus: Record<TaskStatus, TaskListItem[]>;
  byAgent: Record<AgentId, TaskListItem[]>;
  ceoTasks: CeoTaskWithReports[];
  latestFinalReport: {
    reportId: string;
    brainRecordId: string;
    title: string;
    executiveSummary: string;
    completionScore: number;
    founderGoal: string;
    parentGoalTaskId: string;
    createdAt: string;
    status: string;
    ceoVerdict: string;
  } | null;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  assigned: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  review: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

interface CeoDashboardProps {
  refreshKey?: number;
}

export function CeoDashboard({ refreshKey = 0 }: CeoDashboardProps) {
  const t = useT();
  const locale = useLocale();
  const statusLabels = getTaskStatusLabels(locale);
  const agentCatalog = getAgentCatalog(locale);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ceo/dashboard");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? t("ceo.errors.unexpected"));
      }
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("ceo.errors.unexpected"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>{t("ceo.dashboard.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!data) return null;

  const summaryCards = [
    {
      label: t("ceo.dashboard.activeExecutions"),
      value: data.summary.execution.activeExecutions,
      icon: PlayCircle,
      color: "text-amber-600",
    },
    {
      label: t("ceo.dashboard.pendingReview"),
      value: data.summary.execution.pendingReview,
      icon: ClipboardList,
      color: "text-purple-600",
    },
    {
      label: t("ceo.dashboard.completedToday"),
      value: data.summary.execution.completedToday,
      icon: CheckCircle2,
      color: "text-emerald-600",
    },
    {
      label: t("ceo.dashboard.failedTasks"),
      value: data.summary.execution.failedTasks,
      icon: AlertTriangle,
      color: "text-rose-600",
    },
  ];

  const legacySummaryCards = [
    {
      label: t("ceo.dashboard.activeTasks"),
      value: data.summary.active,
      icon: ClipboardList,
      color: "text-amber-600",
    },
    {
      label: t("ceo.dashboard.completedTasks"),
      value: data.summary.completed,
      icon: CheckCircle2,
      color: "text-emerald-600",
    },
    {
      label: t("ceo.dashboard.blockedTasks"),
      value: data.summary.blocked,
      icon: AlertTriangle,
      color: "text-rose-600",
    },
    {
      label: t("ceo.dashboard.ceoCreated"),
      value: data.summary.ceoCreated,
      icon: Users,
      color: "text-primary",
    },
  ];

  return (
    <section className="space-y-8">
      <div>
        <p className="text-label text-primary/80">{t("ceo.dashboard.label")}</p>
        <h3 className="font-display text-2xl font-medium">
          {t("ceo.dashboard.title")}
        </h3>
      </div>

      <div className="luxury-surface-elevated space-y-5 rounded-2xl p-8">
        <div className="flex items-start gap-4">
          <Crown className="mt-1 size-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-label text-primary/80">
              {t("ceo.executiveSummary.label")}
            </p>
            <h4 className="font-display text-xl font-medium">
              {t("ceo.executiveSummary.title")}
            </h4>
          </div>
        </div>

        {data.latestFinalReport ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-label text-primary/80">
                  {t("ceo.executiveSummary.latest")}
                </p>
                <h5 className="text-lg font-medium">
                  {data.latestFinalReport.title}
                </h5>
              </div>
              <Badge variant="secondary" className="font-normal tabular-nums">
                {t("ceo.executiveSummary.completionScore")}:{" "}
                {data.latestFinalReport.completionScore}%
              </Badge>
            </div>

            <p className="text-sm leading-relaxed text-muted-foreground">
              {data.latestFinalReport.executiveSummary}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">
                  {t("ceo.executiveSummary.linkedGoal")}
                </p>
                <p className="mt-1 text-sm">{data.latestFinalReport.founderGoal}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">
                  {t("ceo.executiveSummary.ceoVerdict")}
                </p>
                <p className="mt-1 text-sm">{data.latestFinalReport.ceoVerdict}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {t("ceo.executiveSummary.generatedAt")}:{" "}
                {new Date(data.latestFinalReport.createdAt).toLocaleString()}
              </p>
              <Link
                href="/facility/reports"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                {t("ceo.executiveSummary.viewReport")}
                <FileText className="size-4" />
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("ceo.executiveSummary.noReport")}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="luxury-surface-elevated rounded-2xl p-5"
          >
            <div className="flex items-center gap-3">
              <Icon className={cn("size-5", color)} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <p className="mt-2 font-display text-3xl font-medium tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {legacySummaryCards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-muted/10 p-5"
          >
            <div className="flex items-center gap-3">
              <Icon className={cn("size-5", color)} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <p className="mt-2 font-display text-2xl font-medium tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <p className="text-label text-primary/80">
          {t("ceo.dashboard.byStatus")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TASK_STATUS_ORDER.map((status) => {
            const count = data.byStatus[status]?.length ?? 0;
            return (
              <div
                key={status}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3"
              >
                <Badge
                  variant="outline"
                  className={cn("font-normal", STATUS_COLORS[status])}
                >
                  {statusLabels[status]}
                </Badge>
                <span className="tabular-nums text-sm font-medium">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-label text-primary/80">
          {t("ceo.dashboard.byAgent")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPECIALIST_AGENT_IDS.map((agentId) => {
            const tasks = data.byAgent[agentId] ?? [];
            const agent = agentCatalog[agentId];
            return (
              <div
                key={agentId}
                className="luxury-surface-elevated space-y-3 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{agent.name}</span>
                  <Badge variant="secondary" className="font-normal">
                    {tasks.length}
                  </Badge>
                </div>
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("ceo.dashboard.noTasks")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {tasks.slice(0, 4).map((task) => (
                      <li
                        key={task.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-xs font-normal",
                            STATUS_COLORS[task.status],
                          )}
                        >
                          {statusLabels[task.status]}
                        </Badge>
                        <span className="text-muted-foreground line-clamp-2">
                          {task.title}
                        </span>
                      </li>
                    ))}
                    {tasks.length > 4 && (
                      <li className="text-xs text-muted-foreground">
                        +{tasks.length - 4} {t("ceo.dashboard.more")}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {data.ceoTasks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-label text-primary/80">
              {t("ceo.dashboard.delegatedTasks")}
            </p>
            <Link
              href="/facility/missions"
              className="text-sm text-primary hover:underline"
            >
              {t("ceo.dashboard.viewTaskBoard")}
            </Link>
          </div>
          <ul className="space-y-3">
            {data.ceoTasks
              .filter((task) => !task.parentTaskId)
              .concat(
                data.ceoTasks.filter((task) => task.parentTaskId),
              )
              .slice(0, 12)
              .map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-border bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <Badge
                      variant="outline"
                      className={cn("font-normal", STATUS_COLORS[task.status])}
                    >
                      {statusLabels[task.status]}
                    </Badge>
                    {task.assigneeAgentId && (
                      <Badge variant="secondary" className="font-normal">
                        {agentCatalog[task.assigneeAgentId]?.name ??
                          task.assigneeAgentId}
                      </Badge>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{task.title}</p>
                      {task.parentTaskId && (
                        <p className="text-xs text-muted-foreground">
                          {t("ceo.dashboard.subtask")}
                        </p>
                      )}
                    </div>
                  </div>
                  {task.linkedReports.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="size-3.5" />
                        {t("ceo.dashboard.linkedReports")}
                      </p>
                      <ul className="space-y-1">
                        {task.linkedReports.map((report) => (
                          <li key={report.reportId}>
                            <Link
                              href="/facility/reports"
                              className="text-sm text-primary hover:underline"
                            >
                              {report.title}
                            </Link>
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({report.agentId})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
