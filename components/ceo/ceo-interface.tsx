"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { CeoNextStep } from "@/agents/ceo/types";
import { CeoDashboard } from "@/components/ceo/ceo-dashboard";
import { useLocale, useT, useWorkspace } from "@/lib/i18n";
import { getAgentCatalog, getCeoPriorityLabels } from "@/lib/i18n/data";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Loader2,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type CeoMode = "briefing" | "delegation";

interface CeoResult {
  reportId: string;
  title: string;
  executiveSummary: string;
  keyInsights: string[];
  strategicOpportunities: string[];
  risks: string[];
  nextSteps: CeoNextStep[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}

interface DelegatedTaskResult {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId: string;
  linkedReportId?: string;
}

interface DelegationExecutionResult {
  taskId: string;
  assigneeAgentId: string;
  outcome: "executed" | "skipped" | "failed";
  skipReason?: string;
  reportId?: string;
  error?: string;
}

interface DelegationResult {
  parentTaskId: string;
  title: string;
  objective: string;
  milestones: string[];
  tasks: DelegatedTaskResult[];
  confidence: number;
  contextRecordCount: number;
  autoExecutionEnabled: boolean;
  executions: DelegationExecutionResult[];
}

const PRIORITY_STYLES: Record<CeoNextStep["priority"], string> = {
  high: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  medium:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-border bg-muted/40 text-muted-foreground",
};

export function CeoInterface() {
  const t = useT();
  const locale = useLocale();
  const workspace = useWorkspace();
  const priorityLabels = getCeoPriorityLabels(locale);
  const agentCatalog = getAgentCatalog(locale);

  const [mode, setMode] = useState<CeoMode>("delegation");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefingResult, setBriefingResult] = useState<CeoResult | null>(null);
  const [delegationResult, setDelegationResult] =
    useState<DelegationResult | null>(null);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);

  const examples =
    mode === "delegation"
      ? [
          t("ceo.examples.summerDrop"),
          t("ceo.examples.nextCollection"),
          t("ceo.examples.launchCampaign"),
        ]
      : [
          t("ceo.examples.opportunities"),
          t("ceo.examples.nextCollection"),
          t("ceo.examples.trends2026"),
          t("ceo.examples.differentiateRepresent"),
        ];

  const runBriefing = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setBriefingResult(null);
      setDelegationResult(null);

      try {
        const res = await fetch("/api/ceo/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t("ceo.errors.unexpected"));
        }

        setBriefingResult({
          reportId: data.reportId,
          title: data.title,
          executiveSummary: data.executiveSummary,
          keyInsights: data.keyInsights,
          strategicOpportunities: data.strategicOpportunities,
          risks: data.risks,
          nextSteps: data.nextSteps,
          confidence: data.confidence,
          sourceReportTitles: data.sourceReportTitles,
          contextRecordCount: data.contextRecordCount,
        });
        setInput("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("ceo.errors.unexpected"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, t],
  );

  const runDelegation = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setBriefingResult(null);
      setDelegationResult(null);

      try {
        const res = await fetch("/api/ceo/delegate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t("ceo.errors.unexpected"));
        }

        setDelegationResult({
          parentTaskId: data.parentTaskId,
          title: data.title,
          objective: data.objective,
          milestones: data.milestones,
          tasks: data.tasks,
          confidence: data.confidence,
          contextRecordCount: data.contextRecordCount,
          autoExecutionEnabled: data.autoExecutionEnabled ?? false,
          executions: data.executions ?? [],
        });
        setInput("");
        setDashboardRefresh((k) => k + 1);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("ceo.errors.unexpected"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, t],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "delegation") {
      runDelegation(input);
    } else {
      runBriefing(input);
    }
  };

  const handleExample = (label: string) => {
    if (mode === "delegation") {
      runDelegation(label);
    } else {
      runBriefing(label);
    }
  };

  return (
    <section className="space-y-10">
      <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16">
        <div className="mb-8 space-y-2">
          <p className="text-label text-primary/80">
            {mode === "delegation"
              ? t("ceo.delegation.label")
              : t("ceo.interface.label")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("delegation")}
            className={cn(
              "rounded-full px-5 py-2 text-sm transition-all",
              mode === "delegation"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {t("ceo.delegation.modeLabel")}
          </button>
          <button
            type="button"
            onClick={() => setMode("briefing")}
            className={cn(
              "rounded-full px-5 py-2 text-sm transition-all",
              mode === "briefing"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {t("ceo.interface.modeLabel")}
          </button>
        </div>

        <h2 className="command-interface-headline mb-10 max-w-3xl">
          {mode === "delegation"
            ? t("ceo.delegation.headline")
            : t("ceo.interface.headline")}
        </h2>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "delegation"
                ? t("ceo.delegation.placeholder")
                : t("ceo.interface.placeholder")
            }
            rows={4}
            disabled={isLoading}
            className={cn(
              "w-full resize-none rounded-2xl border border-border bg-background/40",
              "px-6 py-5 text-lg text-foreground placeholder:text-muted-foreground/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/25",
              "disabled:opacity-60",
            )}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3",
                "text-base font-medium text-primary-foreground transition-opacity",
                "disabled:opacity-40",
              )}
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : mode === "delegation" ? (
                <Target className="size-5" />
              ) : (
                <Crown className="size-5" />
              )}
              {isLoading
                ? mode === "delegation"
                  ? t("ceo.delegation.running")
                  : t("ceo.interface.running")
                : mode === "delegation"
                  ? t("ceo.delegation.submit")
                  : t("ceo.interface.submit")}
            </button>
            <p className="text-sm text-muted-foreground">
              {mode === "delegation"
                ? t("ceo.delegation.poweredBy")
                : t("ceo.interface.poweredBy")}
            </p>
          </div>
        </form>

        {error && (
          <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <p className="text-label">{t("ceo.interface.tryExamples")}</p>
        <div className="flex flex-wrap gap-3">
          {examples.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => handleExample(label)}
              disabled={isLoading}
              className={cn(
                "rounded-full border border-border bg-card/40 px-6 py-3",
                "text-base text-muted-foreground transition-all duration-300",
                "hover:border-primary/30 hover:bg-primary/5 hover:text-foreground",
                "disabled:opacity-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {delegationResult && (
        <div className="luxury-surface-elevated space-y-6 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" />
            <div className="space-y-3">
              <p className="text-label text-primary">
                {t("ceo.delegation.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {delegationResult.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("ceo.delegation.tasksCreated", {
                  count: String(delegationResult.tasks.length),
                })}
              </p>
              {delegationResult.autoExecutionEnabled && (
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>
                    {t("ceo.delegation.autoExecuted", {
                      count: String(
                        delegationResult.executions.filter(
                          (e) => e.outcome === "executed",
                        ).length,
                      ),
                    })}
                  </span>
                  {delegationResult.executions.some(
                    (e) => e.outcome === "failed",
                  ) && (
                    <span className="text-destructive">
                      {t("ceo.delegation.executionFailed", {
                        count: String(
                          delegationResult.executions.filter(
                            (e) => e.outcome === "failed",
                          ).length,
                        ),
                      })}
                    </span>
                  )}
                  {delegationResult.executions.some(
                    (e) => e.outcome === "skipped" && e.skipReason === "manual_agent",
                  ) && (
                    <span>
                      {t("ceo.delegation.manualPending", {
                        count: String(
                          delegationResult.executions.filter(
                            (e) =>
                              e.outcome === "skipped" &&
                              e.skipReason === "manual_agent",
                          ).length,
                        ),
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.delegation.objective")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {delegationResult.objective}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.delegation.milestones")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {delegationResult.milestones.map((milestone) => (
                <li
                  key={milestone}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  {milestone}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("ceo.delegation.taskPlan")}
            </p>
            <ul className="space-y-3">
              {delegationResult.tasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-border bg-muted/20 p-5"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {agentCatalog[task.assigneeAgentId as keyof typeof agentCatalog]
                        ?.name ?? task.assigneeAgentId}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 font-normal",
                        PRIORITY_STYLES[
                          task.priority as CeoNextStep["priority"]
                        ] ?? PRIORITY_STYLES.medium,
                      )}
                    >
                      {priorityLabels[task.priority as CeoNextStep["priority"]] ??
                        task.priority}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-base text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("ceo.delegation.taskStatus")}: {task.status}
                      </p>
                      {task.linkedReportId && (
                        <Link
                          href="/reports"
                          className="text-xs text-primary hover:underline"
                        >
                          Report: {task.linkedReportId.slice(0, 8)}…
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t("ceo.interface.confidence")}
              </span>
              <Progress
                value={delegationResult.confidence * 100}
                className="h-1 w-20"
              />
              <span className="tabular-nums text-sm">
                {Math.round(delegationResult.confidence * 100)}%
              </span>
            </div>
            <Link
              href="/tasks"
              className="inline-flex items-center gap-2 text-base text-primary hover:underline"
            >
              {t("ceo.delegation.viewTasks")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {briefingResult && (
        <div className="luxury-surface-elevated space-y-6 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" />
            <div className="space-y-3">
              <p className="text-label text-primary">
                {t("ceo.interface.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {briefingResult.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("ceo.interface.contextRecords", {
                  count: String(briefingResult.contextRecordCount),
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.interface.executiveSummary")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {briefingResult.executiveSummary}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.interface.keyInsights")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {briefingResult.keyInsights.map((insight) => (
                <li
                  key={insight}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  {insight}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.interface.strategicOpportunities")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {briefingResult.strategicOpportunities.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-emerald-500/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.interface.risks")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {briefingResult.risks.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-rose-500/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("ceo.interface.nextSteps")}
            </p>
            <ul className="space-y-3">
              {briefingResult.nextSteps.map((step) => (
                <li
                  key={step.action}
                  className="rounded-xl border border-border bg-muted/20 p-5"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 font-normal",
                        PRIORITY_STYLES[step.priority],
                      )}
                    >
                      {priorityLabels[step.priority]}
                    </Badge>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-base text-foreground">{step.action}</p>
                      {step.rationale && (
                        <p className="text-sm text-muted-foreground">
                          {step.rationale}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {briefingResult.sourceReportTitles.length > 0 && (
            <div className="space-y-2">
              <p className="text-label text-primary/80">
                {t("ceo.interface.sources")}
              </p>
              <div className="flex flex-wrap gap-2">
                {briefingResult.sourceReportTitles.map((title) => (
                  <Badge key={title} variant="secondary" className="font-normal">
                    {title}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t("ceo.interface.confidence")}
              </span>
              <Progress
                value={briefingResult.confidence * 100}
                className="h-1 w-20"
              />
              <span className="tabular-nums text-sm">
                {Math.round(briefingResult.confidence * 100)}%
              </span>
            </div>
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 text-base text-primary hover:underline"
            >
              {t("ceo.interface.viewReports")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      <CeoDashboard refreshKey={dashboardRefresh} />
    </section>
  );
}
