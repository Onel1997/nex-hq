"use client";

import { useCallback, useEffect, useState } from "react";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import type {
  AnalyticsChamberPayload,
  AnalyticsCommerceRow,
  AnalyticsRadarSignal,
} from "@/lib/facility/analytics-chamber-types";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Brain,
  Loader2,
  Radar,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

export function AnalyticsChamberCenter() {
  const { data, loading, error, refresh } = useAnalyticsChamber();

  return (
    <FacilityDepartmentShell
      wingId="analytics"
      title="Analytics Chamber"
      icon={BarChart3}
      subtitle="Predictive observatory — the intelligence horizon of Milaene HQ"
      className="ac-shell"
      headerActions={
        <button
          type="button"
          className="ac-refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Sync Observatory
        </button>
      }
    >
      {loading && !data ? (
        <div className="ac-loading">
          <Loader2 className="size-10 animate-spin text-[var(--ac-accent)]" />
          <p>Calibrating predictive observatory…</p>
        </div>
      ) : error ? (
        <div className="ac-error">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : data ? (
        <AnalyticsObservatory data={data} />
      ) : null}
    </FacilityDepartmentShell>
  );
}

function AnalyticsObservatory({ data }: { data: AnalyticsChamberPayload }) {
  return (
    <div className="ac-observatory">
      <div className="ac-scanlines" aria-hidden />
      <div className="ac-atmosphere" aria-hidden>
        {Array.from({ length: 32 }).map((_, i) => (
          <span
            key={i}
            className="ac-particle"
            style={{
              ["--ac-px" as string]: `${(i * 23) % 100}%`,
              ["--ac-py" as string]: `${(i * 37) % 100}%`,
              ["--ac-pd" as string]: `${4 + (i % 6)}s`,
              ["--ac-pdelay" as string]: `${(i * 0.3) % 5}s`,
            }}
          />
        ))}
      </div>

      <ExecutiveMetrics metrics={data.executive} />

      <div className="ac-observatory-grid">
        <div className="ac-column ac-column-left">
          <AgentPerformancePanel performance={data.agentPerformance} />
          <ResearchAnalyticsPanel research={data.research} />
        </div>

        <div className="ac-column ac-column-center">
          <SignalRadar signals={data.radarSignals} />
          <NeuralPredictionsPanel predictions={data.neuralPredictions} />
        </div>

        <div className="ac-column ac-column-right">
          <CommerceAnalyticsPanel commerce={data.commerce} />
          <FutureSystemsPanel systems={data.futureSystems} />
        </div>
      </div>
    </div>
  );
}

function ExecutiveMetrics({ metrics }: { metrics: AnalyticsChamberPayload["executive"] }) {
  const items = [
    { label: "Revenue", value: metrics.revenue, icon: TrendingUp, glow: true },
    { label: "Orders", value: metrics.orders.toLocaleString(), icon: BarChart3 },
    {
      label: "Conversion Rate",
      value: `${metrics.conversionRate}%`,
      icon: Target,
      pulse: true,
    },
    { label: "Average Order Value", value: metrics.averageOrderValue, icon: Sparkles },
  ];

  return (
    <section className="ac-executive" aria-label="Executive metrics">
      <header className="ac-section-label">
        <Zap className="size-3.5" />
        <span>Executive Metrics</span>
      </header>
      <div className="ac-executive-grid">
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(
              "ac-holo-display",
              item.glow && "ac-holo-glow",
              item.pulse && "ac-holo-pulse",
            )}
          >
            <div className="ac-holo-scan" aria-hidden />
            <item.icon className="ac-holo-icon size-4" />
            <span className="ac-holo-label">{item.label}</span>
            <strong className="ac-holo-value">{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentPerformancePanel({
  performance,
}: {
  performance: AnalyticsChamberPayload["agentPerformance"];
}) {
  const items = [
    { label: "Missions Completed", value: performance.missionsCompleted },
    { label: "Confidence Score", value: `${performance.confidenceScore}%` },
    { label: "Active Agents", value: performance.activeAgents },
    { label: "Decision Quality", value: `${performance.decisionQuality}%` },
  ];

  return (
    <section className="ac-glass-panel">
      <PanelHeader icon={Users} title="Agent Performance" />
      <div className="ac-agent-grid">
        {items.map((item) => (
          <div key={item.label} className="ac-agent-stat">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <div className="ac-agent-bar">
              <span
                style={{
                  width: `${typeof item.value === "number" ? Math.min(item.value * 8, 100) : parseInt(String(item.value), 10)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommerceAnalyticsPanel({
  commerce,
}: {
  commerce: AnalyticsChamberPayload["commerce"];
}) {
  return (
    <section className="ac-glass-panel">
      <PanelHeader icon={BarChart3} title="Commerce Analytics" />
      <CommerceGroup label="Product Performance" rows={commerce.products} />
      <CommerceGroup label="Category Performance" rows={commerce.categories} />
      <CommerceGroup label="Seasonal Trends" rows={commerce.seasonal} />
    </section>
  );
}

function CommerceGroup({ label, rows }: { label: string; rows: AnalyticsCommerceRow[] }) {
  return (
    <div className="ac-commerce-group">
      <h3>{label}</h3>
      <ul className="ac-commerce-bars">
        {rows.map((row, i) => (
          <li key={row.id} className={cn("ac-commerce-row", `ac-dir-${row.direction}`)}>
            <div className="ac-commerce-meta">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
            <div className="ac-commerce-track">
              <span
                className="ac-commerce-fill"
                style={{
                  width: `${row.intensity}%`,
                  ["--ac-bar-delay" as string]: `${i * 0.15}s`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResearchAnalyticsPanel({
  research,
}: {
  research: AnalyticsChamberPayload["research"];
}) {
  return (
    <section className="ac-glass-panel">
      <PanelHeader icon={Sparkles} title="Research Analytics" />
      <div className="ac-trend-confidence">
        <span>Trend Confidence</span>
        <div className="ac-confidence-display">
          <svg viewBox="0 0 80 80" aria-hidden>
            <circle cx="40" cy="40" r="32" className="ac-conf-bg" />
            <circle
              cx="40"
              cy="40"
              r="32"
              className="ac-conf-fill"
              strokeDasharray={`${research.trendConfidence * 2.01} 201`}
            />
          </svg>
          <strong>{research.trendConfidence}%</strong>
        </div>
      </div>
      <div className="ac-research-block">
        <h3>Market Opportunities</h3>
        <ul>
          {research.opportunities.map((opp) => (
            <li key={opp.id}>
              <strong>{opp.label}</strong>
              <p>{opp.detail}</p>
              <span>{opp.confidence}% confidence</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="ac-research-block">
        <h3>Competitor Activity</h3>
        <ul>
          {research.competitorActivity.map((item) => (
            <li key={item.id} className={cn("ac-comp-item", `ac-comp-${item.level}`)}>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
              <span>{item.level.toUpperCase()}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function NeuralPredictionsPanel({
  predictions,
}: {
  predictions: AnalyticsChamberPayload["neuralPredictions"];
}) {
  const categoryLabel = {
    demand: "Demand Forecast",
    product: "Product Opportunity",
    marketing: "Marketing Recommendation",
  };

  return (
    <section className="ac-glass-panel ac-neural-panel">
      <PanelHeader icon={Brain} title="Neural Predictions" />
      <ul className="ac-neural-list">
        {predictions.map((pred, i) => (
          <li
            key={pred.id}
            className={cn("ac-neural-card", `ac-neural-${pred.category}`)}
            style={{ ["--ac-neural-delay" as string]: `${i * 0.12}s` }}
          >
            <span className="ac-neural-tag">{categoryLabel[pred.category]}</span>
            <p>{pred.message}</p>
            <div className="ac-neural-conf">
              <span style={{ width: `${pred.confidence}%` }} />
              <em>{pred.confidence}%</em>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SignalRadar({ signals }: { signals: AnalyticsRadarSignal[] }) {
  const size = 320;
  const center = size / 2;
  const maxR = center - 24;

  return (
    <section className="ac-glass-panel ac-radar-panel" aria-label="Signal radar">
      <PanelHeader icon={Radar} title="Signal Radar" />
      <div className="ac-radar-stage">
        <div className="ac-radar-glow" aria-hidden />
        <svg
          className="ac-radar-svg"
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden
        >
          <defs>
            <radialGradient id="ac-radar-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgb(34 211 238 / 0.08)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <circle cx={center} cy={center} r={maxR} fill="url(#ac-radar-gradient)" />
          {[0.25, 0.5, 0.75, 1].map((scale) => (
            <circle
              key={scale}
              cx={center}
              cy={center}
              r={maxR * scale}
              className="ac-radar-ring"
            />
          ))}

          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={center + maxR * Math.cos(angle - Math.PI / 2)}
                y2={center + maxR * Math.sin(angle - Math.PI / 2)}
                className="ac-radar-spoke"
              />
            );
          })}

          <g className="ac-radar-sweep">
            <path
              d={`M ${center} ${center} L ${center} ${center - maxR} A ${maxR} ${maxR} 0 0 1 ${center + maxR * Math.sin(Math.PI / 4)} ${center - maxR * Math.cos(Math.PI / 4)} Z`}
              className="ac-radar-sweep-wedge"
            />
          </g>

          {signals.map((signal) => {
            const rad = ((signal.angle - 90) * Math.PI) / 180;
            const r = signal.distance * maxR;
            const x = center + r * Math.cos(rad);
            const y = center + r * Math.sin(rad);
            return (
              <g key={signal.id} className={`ac-radar-blip ac-blip-${signal.kind}`}>
                <circle cx={x} cy={y} r={4 + signal.intensity / 40} className="ac-blip-core" />
                <circle cx={x} cy={y} r={8 + signal.intensity / 25} className="ac-blip-ring" />
              </g>
            );
          })}

          <circle cx={center} cy={center} r={4} className="ac-radar-center" />
        </svg>

        <ul className="ac-radar-legend">
          {signals.slice(0, 5).map((signal) => (
            <li key={signal.id} className={`ac-legend-item ac-blip-${signal.kind}`}>
              <span className="ac-legend-dot" />
              {signal.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FutureSystemsPanel({ systems }: { systems: string[] }) {
  return (
    <section className="ac-glass-panel ac-future-panel">
      <PanelHeader icon={Zap} title="Future Systems" />
      <ul className="ac-future-list">
        {systems.map((system) => (
          <li key={system}>
            <span className="ac-future-node" aria-hidden />
            <span>{system}</span>
            <em>Standby</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PanelHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <header className="ac-panel-header">
      <Icon className="size-4" />
      <h2>{title}</h2>
    </header>
  );
}

function useAnalyticsChamber() {
  const [data, setData] = useState<AnalyticsChamberPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/facility/analytics");
      const body = (await res.json()) as AnalyticsChamberPayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load Analytics Chamber");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Analytics Chamber");
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
