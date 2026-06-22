"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentId } from "@/lib/constants/agents";
import type { CeoCommandIntelligence } from "@/lib/ceo/ceo-command-intelligence";
import { useT } from "@/lib/i18n";
import type { TaskListItem, TaskStatus } from "@/tasks/types";

interface TaskLinkedReport {
  id: string;
  reportId: string;
  title: string;
  agentId: string;
  status: string;
  summary: string;
}

export interface CeoDashboardData {
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
  ceoTasks: Array<TaskListItem & { linkedReports: TaskLinkedReport[] }>;
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
  intelligence: CeoCommandIntelligence;
}

export function useCeoDashboard(refreshKey = 0) {
  const t = useT();
  const [data, setData] = useState<CeoDashboardData | null>(null);
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

  return { data, isLoading, error, reload: loadDashboard };
}
