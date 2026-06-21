"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import type {
  BrainCoreAgentNode,
  BrainCoreKnowledgeStream,
  BrainCorePayload,
} from "@/lib/facility/brain-core-types";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  Brain,
  GitBranch,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";

const CHAMBER_SIZE = 630;
const CHAMBER_CENTER = CHAMBER_SIZE / 2;
const NODE_RADIUS = 252;
const CORE_RADIUS = 78;

const NODE_LABEL_IDS: Record<string, string> = {
  "CEO Command": "ceo",
  "Research HQ": "research",
  "Commerce Lab": "commerce",
  "Design Studio": "designer",
  "Marketing Center": "marketing",
  "Content Studio": "content",
  "Image Studio": "image",
  "Shopify Operations": "shopify",
};

function nodeCoords(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: CHAMBER_CENTER + NODE_RADIUS * Math.cos(rad),
    y: CHAMBER_CENTER + NODE_RADIUS * Math.sin(rad),
  };
}

function nodeById(nodes: BrainCoreAgentNode[], id: string) {
  return nodes.find((n) => n.id === id);
}

function streamPath(
  fromLabel: string,
  toLabel: string,
  nodes: BrainCoreAgentNode[],
) {
  const fromId = NODE_LABEL_IDS[fromLabel];
  const toId = NODE_LABEL_IDS[toLabel];
  if (!fromId || !toId) return null;

  const fromNode = nodeById(nodes, fromId);
  const toNode = nodeById(nodes, toId);
  if (!fromNode || !toNode) return null;

  const start = nodeCoords(fromNode.angle);
  const end = nodeCoords(toNode.angle);
  return { start, end, fromId, toId };
}

export function BrainCoreCenter() {
  const { data, loading, error, refresh } = useBrainCore();

  return (
    <FacilityDepartmentShell
      wingId="brain-core"
      title="Brain Core"
      icon={Brain}
      subtitle="Living neural center — the AI mind of Milaene HQ"
      className="bc-shell"
      headerActions={
        <button
          type="button"
          className="bc-refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Sync Neural Net
        </button>
      }
    >
      {loading && !data ? (
        <div className="bc-loading">
          <Loader2 className="size-10 animate-spin text-[var(--bc-accent)]" />
          <p>Initializing neural chamber…</p>
        </div>
      ) : error ? (
        <div className="bc-error">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : data ? (
        <BrainCoreChamber data={data} />
      ) : null}
    </FacilityDepartmentShell>
  );
}

function BrainCoreChamber({ data }: { data: BrainCorePayload }) {
  return (
    <div className="bc-chamber-wrap bc-v2">
      <div className="bc-scanlines" aria-hidden />
      <div className="bc-atmosphere" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="bc-atmo-particle"
            style={{
              ["--bc-a-x" as string]: `${(i * 17) % 100}%`,
              ["--bc-a-y" as string]: `${(i * 29) % 100}%`,
              ["--bc-a-d" as string]: `${4 + (i % 6)}s`,
              ["--bc-a-delay" as string]: `${(i * 0.4) % 5}s`,
            }}
          />
        ))}
      </div>

      <MetricsBar metrics={data.metrics} coreState={data.coreState} />

      <div className="bc-main">
        <aside className="bc-panel bc-feed-panel">
          <header className="bc-panel-header">
            <Activity className="size-4" />
            <h2>Live Intelligence Feed</h2>
          </header>
          <ul className="bc-feed-list">
            {data.feed.map((item) => (
              <li key={item.id} className={cn("bc-feed-item", `bc-feed-${item.kind}`)}>
                <span className="bc-feed-pulse" />
                <div>
                  <p>{item.message}</p>
                  <time>
                    {new Date(item.timestamp).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="bc-neural-stage">
          <div className="bc-stage-vignette" aria-hidden />
          <NeuralCore
            nodes={data.nodes}
            coreState={data.coreState}
            knowledgeStreams={data.knowledgeStreams}
          />
        </div>

        <aside className="bc-panel bc-streams-panel">
          <header className="bc-panel-header">
            <GitBranch className="size-4" />
            <h2>Knowledge Streams</h2>
          </header>
          <ul className="bc-stream-list">
            {data.knowledgeStreams.map((stream, index) => (
              <li
                key={stream.id}
                className={cn(
                  "bc-stream-card",
                  stream.active && "bc-stream-card-active",
                )}
                style={{ ["--bc-stream-delay" as string]: `${index * 0.4}s` }}
              >
                <div className="bc-stream-route">
                  <span>{stream.from}</span>
                  <span className="bc-stream-track">
                    <span className="bc-stream-packet" />
                    <ArrowRight className="size-3.5" />
                  </span>
                  <span>{stream.to}</span>
                </div>
                <div className="bc-stream-meta">
                  {stream.active ? (
                    <>
                      <span className="bc-stream-live">Active signal</span>
                      <span>{stream.signalCount} packets</span>
                    </>
                  ) : (
                    <span className="bc-stream-idle">Standby</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <FutureModules modules={data.futureModules} />
        </aside>
      </div>

      <section className="bc-decisions" aria-label="CEO Strategic Decisions">
        <header className="bc-decisions-header">
          <Sparkles className="size-4 text-[var(--bc-gold)]" />
          <h2>CEO Strategic Decisions</h2>
          <span>{data.decisions.length} active</span>
        </header>
        <div className="bc-decisions-grid">
          {data.decisions.map((decision) => (
            <article
              key={decision.id}
              className={cn(
                "bc-decision-card",
                `bc-decision-${decision.priority.toLowerCase()}`,
              )}
            >
              <header>
                <span className="bc-decision-priority">{decision.priority}</span>
                <span className="bc-decision-confidence">
                  {Math.round(decision.confidence * 100)}% confidence
                </span>
              </header>
              <h3>{decision.message}</h3>
              <p className="bc-decision-reason">{decision.reasoning}</p>
              <footer>
                {decision.sourceAgents.map((agent) => (
                  <span key={agent}>{agent}</span>
                ))}
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricsBar({
  metrics,
  coreState,
}: {
  metrics: BrainCorePayload["metrics"];
  coreState: BrainCorePayload["coreState"];
}) {
  const items = [
    { label: "Neural Activity", value: `${metrics.neuralActivity}%`, pulse: true },
    { label: "Connected Agents", value: metrics.connectedAgents },
    { label: "Knowledge Signals", value: metrics.knowledgeSignals },
    { label: "Active Decisions", value: metrics.activeDecisions },
    { label: "Intelligence Level", value: `${metrics.intelligenceLevel}%`, glow: true },
    { label: "Confidence Score", value: `${metrics.confidenceScore}%` },
  ];

  return (
    <div className="bc-metrics">
      <div className="bc-core-state">
        <Zap className="size-3.5" />
        <span>{coreState.toUpperCase()}</span>
      </div>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "bc-metric",
            item.pulse && "bc-metric-pulse",
            item.glow && "bc-metric-glow",
          )}
        >
          <span className="bc-metric-label">{item.label}</span>
          <span className="bc-metric-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function NeuralCore({
  nodes,
  coreState,
  knowledgeStreams,
}: {
  nodes: BrainCoreAgentNode[];
  coreState: BrainCorePayload["coreState"];
  knowledgeStreams: BrainCoreKnowledgeStream[];
}) {
  const hubStreams = useMemo(
    () =>
      nodes.map((node) => {
        const end = nodeCoords(node.angle);
        return {
          id: node.id,
          end,
          active: node.status !== "idle",
          receiving: node.status === "processing" || node.status === "online",
        };
      }),
    [nodes],
  );

  const crossStreams = useMemo(
    () =>
      knowledgeStreams
        .map((stream) => {
          const path = streamPath(stream.from, stream.to, nodes);
          if (!path) return null;
          return {
            ...stream,
            ...path,
            d: `M ${path.start.x} ${path.start.y} L ${path.end.x} ${path.end.y}`,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s != null),
    [knowledgeStreams, nodes],
  );

  return (
    <div className={cn("bc-neural-core bc-neural-v2", `bc-core-state-${coreState}`)}>
      <div className="bc-neural-glow" aria-hidden />
      <div className="bc-neural-glow bc-neural-glow-outer" aria-hidden />

      <div className="bc-energy-waves" aria-hidden>
        <span className="bc-wave bc-wave-1" />
        <span className="bc-wave bc-wave-2" />
        <span className="bc-wave bc-wave-3" />
      </div>

      <svg
        className="bc-energy-svg"
        viewBox={`0 0 ${CHAMBER_SIZE} ${CHAMBER_SIZE}`}
        aria-hidden
      >
        <defs>
          <radialGradient id="bc-core-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(224 242 254 / 0.95)" />
            <stop offset="35%" stopColor="rgb(56 189 248 / 0.85)" />
            <stop offset="70%" stopColor="rgb(3 105 161 / 0.4)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="bc-stream-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(56 189 248 / 0.15)" />
            <stop offset="45%" stopColor="rgb(103 232 249 / 0.95)" />
            <stop offset="100%" stopColor="rgb(56 189 248 / 0.2)" />
          </linearGradient>
          <linearGradient id="bc-cross-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(103 232 249 / 0.3)" />
            <stop offset="50%" stopColor="rgb(167 139 250 / 0.7)" />
            <stop offset="100%" stopColor="rgb(56 189 248 / 0.3)" />
          </linearGradient>
          <filter id="bc-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {crossStreams.map((stream) => (
          <g key={stream.id}>
            <path
              d={stream.d}
              className={cn(
                "bc-cross-stream",
                stream.active && "bc-cross-stream-active",
              )}
              fill="none"
            />
            {stream.active ? (
              <>
                <circle r="3.5" className="bc-knowledge-packet" filter="url(#bc-glow-filter)">
                  <animateMotion
                    dur="5s"
                    repeatCount="indefinite"
                    path={stream.d}
                  />
                </circle>
                <circle r="2" className="bc-knowledge-packet bc-knowledge-packet-alt">
                  <animateMotion
                    dur="7s"
                    repeatCount="indefinite"
                    begin="2s"
                    path={stream.d}
                  />
                </circle>
              </>
            ) : null}
          </g>
        ))}

        {hubStreams.map((stream, index) => (
          <g key={stream.id}>
            <line
              x1={CHAMBER_CENTER}
              y1={CHAMBER_CENTER}
              x2={stream.end.x}
              y2={stream.end.y}
              className={cn(
                "bc-energy-line",
                stream.active && "bc-energy-line-active",
              )}
              style={{ ["--bc-line-delay" as string]: `${index * 0.35}s` }}
            />
            {stream.active ? (
              <>
                <circle r="4" className="bc-hub-packet" filter="url(#bc-glow-filter)">
                  <animateMotion
                    dur="4.5s"
                    repeatCount="indefinite"
                    begin={`${index * 0.5}s`}
                    path={`M ${CHAMBER_CENTER} ${CHAMBER_CENTER} L ${stream.end.x} ${stream.end.y}`}
                  />
                </circle>
                <circle r="2.5" className="bc-hub-packet bc-hub-packet-return">
                  <animateMotion
                    dur="6.5s"
                    repeatCount="indefinite"
                    begin={`${1.5 + index * 0.6}s`}
                    path={`M ${stream.end.x} ${stream.end.y} L ${CHAMBER_CENTER} ${CHAMBER_CENTER}`}
                  />
                </circle>
              </>
            ) : null}
          </g>
        ))}

        <circle
          cx={CHAMBER_CENTER}
          cy={CHAMBER_CENTER}
          r={CORE_RADIUS}
          className="bc-core-sphere-bg"
          fill="url(#bc-core-gradient)"
          filter="url(#bc-glow-filter)"
        />
      </svg>

      <div className="bc-sphere-layers" aria-hidden>
        <div className="bc-neural-pulse" />
        <div className="bc-orbit bc-orbit-1" />
        <div className="bc-orbit bc-orbit-2" />
        <div className="bc-orbit bc-orbit-3" />
        <div className="bc-orbit bc-orbit-4" />
        <div className="bc-sphere-core">
          <div className="bc-sphere-inner-light" />
        </div>
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="bc-particle"
            style={{
              ["--bc-p-x" as string]: `${8 + (i * 37) % 84}%`,
              ["--bc-p-y" as string]: `${6 + (i * 53) % 88}%`,
              ["--bc-p-d" as string]: `${2.5 + (i % 6)}s`,
              ["--bc-p-delay" as string]: `${(i * 0.28) % 5}s`,
            }}
          />
        ))}
      </div>

      <div className="bc-nodes">
        {nodes.map((node, index) => (
          <AgentNode key={node.id} node={node} index={index} />
        ))}
      </div>

      <p className="bc-core-label">NEURAL CORE · V2</p>
    </div>
  );
}

function AgentNode({ node, index }: { node: BrainCoreAgentNode; index: number }) {
  const pos = nodeCoords(node.angle);
  const receiving = node.status === "processing" || node.status === "online";

  return (
    <div
      className={cn(
        "bc-node",
        `bc-node-${node.status}`,
        receiving && "bc-node-receiving",
        node.status !== "idle" && "bc-node-active",
      )}
      style={{
        left: `${(pos.x / CHAMBER_SIZE) * 100}%`,
        top: `${(pos.y / CHAMBER_SIZE) * 100}%`,
        ["--bc-node-delay" as string]: `${index * 0.45}s`,
      }}
    >
      {receiving ? <span className="bc-node-ring" aria-hidden /> : null}
      <span className="bc-node-dot" />
      <div className="bc-node-body">
        <strong>{node.label}</strong>
        {node.activity ? <small>{node.activity}</small> : null}
      </div>
    </div>
  );
}

function FutureModules({ modules }: { modules: string[] }) {
  return (
    <div className="bc-future">
      <header className="bc-panel-header">
        <Brain className="size-4" />
        <h2>Future Modules</h2>
      </header>
      <ul className="bc-future-list">
        {modules.map((module) => (
          <li key={module}>
            <span>{module}</span>
            <span className="bc-future-soon">Coming online</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useBrainCore() {
  const [data, setData] = useState<BrainCorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/facility/brain");
      const body = (await res.json()) as BrainCorePayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load Brain Core");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Brain Core");
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
