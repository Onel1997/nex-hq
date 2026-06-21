"use client";

import { useCallback, useEffect, useState } from "react";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import type {
  AgentActivityItem,
  CeoCommandInsight,
  MissionControlMission,
  MissionControlPayload,
} from "@/lib/facility/mission-control-types";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  Crown,
  Loader2,
  Radio,
  RefreshCw,
  Target,
  Zap,
} from "lucide-react";

export function MissionControlCenter() {
  const { data, loading, error, refresh } = useMissionControl();

  return (
    <FacilityDepartmentShell
      wingId="mission-control"
      title="Mission Control"
      icon={Target}
      subtitle="Central operations room — CEO Agent coordinates all departments"
      headerActions={
        <button
          type="button"
          className="mc-refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Sync
        </button>
      }
    >
      {loading && !data ? (
        <div className="mc-loading">
          <Loader2 className="size-8 animate-spin text-[var(--mc-accent)]" />
          <p>Initializing command systems…</p>
        </div>
      ) : error ? (
        <div className="mc-error">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : data ? (
        <MissionControlDashboard data={data} />
      ) : null}
    </FacilityDepartmentShell>
  );
}

function MissionControlDashboard({ data }: { data: MissionControlPayload }) {
  return (
    <div className="mc-dashboard">
      <CommandBar bar={data.commandBar} />

      <div className="mc-layout">
        <section className="mc-board" aria-label="Mission board">
          <header className="mc-panel-header">
            <Target className="size-4" />
            <h2>Mission Board</h2>
          </header>
          <div className="mc-mission-grid">
            {data.missions.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        </section>

        <aside className="mc-side">
          <TimelinePanel timeline={data.timeline} />
          <ActivityPanel feed={data.activityFeed} />
          <CeoPanel insights={data.ceoPanel} />
          <FuturePanel features={data.futureFeatures} />
        </aside>
      </div>
    </div>
  );
}

function CommandBar({ bar }: { bar: MissionControlPayload["commandBar"] }) {
  const items = [
    { label: "Active Missions", value: bar.activeMissions, glow: true },
    { label: "Completed", value: bar.completedMissions },
    { label: "Agents Online", value: bar.departmentsOnline, pulse: true },
    { label: "Critical", value: bar.criticalTasks, alert: bar.criticalTasks > 0 },
    { label: "Agent Activity", value: bar.agentActivity },
  ];

  return (
    <div className="mc-command-bar">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "mc-command-stat",
            item.glow && "mc-command-stat-glow",
            item.alert && "mc-command-stat-alert",
          )}
        >
          {item.pulse ? <span className="mc-pulse-dot" /> : null}
          <span className="mc-command-label">{item.label}</span>
          <span className="mc-command-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function MissionCard({ mission }: { mission: MissionControlMission }) {
  return (
    <article
      className={cn(
        "mc-mission-card",
        `mc-mission-status-${mission.status.toLowerCase()}`,
        `mc-mission-priority-${mission.priority.toLowerCase()}`,
      )}
    >
      <header className="mc-mission-head">
        <span className="mc-mission-dept">{mission.department}</span>
        <span className={cn("mc-mission-status-badge", `mc-status-${mission.status.toLowerCase()}`)}>
          {mission.status}
        </span>
      </header>

      <h3 className="mc-mission-title">{mission.title}</h3>

      <div className="mc-mission-meta">
        <span>{mission.assignedAgent}</span>
        <span className={cn("mc-priority-tag", `mc-priority-${mission.priority.toLowerCase()}`)}>
          {mission.priority}
        </span>
      </div>

      {mission.progress != null ? (
        <div className="mc-mission-progress">
          <div className="mc-mission-progress-track">
            <div
              className="mc-mission-progress-fill"
              style={{ width: `${mission.progress}%` }}
            />
          </div>
          <span>{mission.progress}%</span>
        </div>
      ) : null}

      {mission.deadline ? (
        <p className="mc-mission-deadline">
          Deadline:{" "}
          {new Date(mission.deadline).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </p>
      ) : null}

      {mission.outputs.length > 0 ? (
        <div className="mc-mission-outputs">
          <span>Outputs</span>
          <ul>
            {mission.outputs.map((output) => (
              <li key={output}>{output}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function TimelinePanel({
  timeline,
}: {
  timeline: MissionControlPayload["timeline"];
}) {
  return (
    <section className="mc-panel mc-timeline">
      <header className="mc-panel-header">
        <Zap className="size-4" />
        <h2>Mission Timeline</h2>
      </header>
      <ol className="mc-timeline-list">
        {timeline.map((stage, index) => (
          <li key={stage.id} className={cn("mc-timeline-stage", `mc-timeline-${stage.status}`)}>
            <div className="mc-timeline-node">
              <span className="mc-timeline-dot" />
              {index < timeline.length - 1 ? (
                <span className="mc-timeline-line" />
              ) : null}
            </div>
            <div className="mc-timeline-body">
              <strong>{stage.label}</strong>
              {stage.missionTitle ? (
                <span className="mc-timeline-mission">{stage.missionTitle}</span>
              ) : (
                <span className="mc-timeline-idle">No active mission</span>
              )}
            </div>
            {index < timeline.length - 1 ? (
              <ArrowDown className="mc-timeline-arrow size-3" />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ActivityPanel({ feed }: { feed: AgentActivityItem[] }) {
  return (
    <section className="mc-panel mc-activity">
      <header className="mc-panel-header">
        <Activity className="size-4" />
        <h2>Agent Activity</h2>
        <span className="mc-live-badge">
          <Radio className="size-3" />
          Live
        </span>
      </header>
      <ul className="mc-activity-list">
        {feed.map((item) => (
          <li key={item.id} className="mc-activity-item">
            <span className="mc-activity-dept">{item.department}</span>
            <p>{item.message}</p>
            <time>
              {new Date(item.time).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CeoPanel({ insights }: { insights: CeoCommandInsight[] }) {
  return (
    <section className="mc-panel mc-ceo">
      <header className="mc-panel-header">
        <Crown className="size-4 text-[#ffd166]" />
        <h2>CEO Command</h2>
      </header>
      <ul className="mc-ceo-list">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className={cn("mc-ceo-item", `mc-ceo-${insight.type}`)}
          >
            {insight.type === "bottleneck" ? (
              <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />
            ) : (
              <span className="mc-ceo-indicator" />
            )}
            <div>
              <span className="mc-ceo-label">{insight.label}</span>
              <p>{insight.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FuturePanel({ features }: { features: string[] }) {
  return (
    <section className="mc-panel mc-future">
      <header className="mc-panel-header">
        <h2>Future Systems</h2>
      </header>
      <ul className="mc-future-list">
        {features.map((feature) => (
          <li key={feature}>
            <span>{feature}</span>
            <span className="mc-future-soon">Coming online</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function useMissionControl() {
  const [data, setData] = useState<MissionControlPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/facility/missions");
      const body = (await res.json()) as MissionControlPayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load Mission Control");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Mission Control");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
