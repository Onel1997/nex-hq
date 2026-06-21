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
const CORE_PROTECT_RADIUS = 118;
const INTEL_ORBIT_RADIUS = 186;
const FEEDBACK_ORBIT_RADIUS = 208;
const COMMAND_RING_RADIUS = NODE_RADIUS - 6;
const NODE_EDGE_TRIM = 16;

type NeuralLinkType = "command" | "intelligence" | "feedback";

type AgentNodeId =
  | "ceo"
  | "research"
  | "commerce"
  | "designer"
  | "marketing"
  | "content"
  | "image"
  | "shopify";

const AGENT_COLORS: Record<AgentNodeId, string> = {
  ceo: "#ffd166",
  research: "#22d3ee",
  commerce: "#34d399",
  designer: "#60a5fa",
  marketing: "#fb923c",
  content: "#a78bfa",
  image: "#f472b6",
  shopify: "#2dd4bf",
};

interface NeuralLink {
  id: string;
  type: NeuralLinkType;
  d: string;
  active: boolean;
  fromId?: AgentNodeId;
  toId?: AgentNodeId;
  delay: number;
}

/** Curved intelligence routes — arc around core, never through center */
const INTELLIGENCE_LINKS: Array<{ from: AgentNodeId; to: AgentNodeId }> = [
  { from: "ceo", to: "designer" },
  { from: "research", to: "commerce" },
  { from: "shopify", to: "commerce" },
  { from: "commerce", to: "marketing" },
];

/** Feedback loops — outer orbital lane, slower purple signals */
const FEEDBACK_LINKS: Array<{ from: AgentNodeId; to: AgentNodeId }> = [
  { from: "image", to: "designer" },
  { from: "content", to: "marketing" },
  { from: "commerce", to: "research" },
  { from: "marketing", to: "ceo" },
];

function pointOnCircle(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CHAMBER_CENTER + radius * Math.cos(rad),
    y: CHAMBER_CENTER + radius * Math.sin(rad),
  };
}

function nodeCoords(angle: number) {
  return pointOnCircle(angle, NODE_RADIUS);
}

function nodeById(nodes: BrainCoreAgentNode[], id: string) {
  return nodes.find((n) => n.id === id);
}

function trimToward(
  from: { x: number; y: number },
  toward: { x: number; y: number },
  amount: number,
) {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len <= amount) return from;
  return {
    x: from.x + (dx / len) * amount,
    y: from.y + (dy / len) * amount,
  };
}

function buildOrbitBezier(
  fromAngle: number,
  toAngle: number,
  orbitRadius: number,
  longArc: boolean,
): string {
  const from = pointOnCircle(fromAngle, NODE_RADIUS);
  const to = pointOnCircle(toAngle, NODE_RADIUS);

  const cwSpan = ((toAngle - fromAngle + 360) % 360) || 360;
  const ccwSpan = cwSpan - 360;
  const span = longArc
    ? cwSpan <= 180
      ? ccwSpan
      : cwSpan
    : cwSpan <= 180
      ? cwSpan
      : ccwSpan;
  const midAngle = fromAngle + span / 2;
  const control = pointOnCircle(midAngle, orbitRadius);

  const start = trimToward(from, control, NODE_EDGE_TRIM);
  const end = trimToward(to, control, NODE_EDGE_TRIM);

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function commandRingPath(): string {
  const cx = CHAMBER_CENTER;
  const cy = CHAMBER_CENTER;
  const r = COMMAND_RING_RADIUS;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
}

function linkHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * (i + 3)) % 997;
  }
  return hash;
}

function particleTiming(id: string, type: NeuralLinkType) {
  const hash = linkHash(id);
  const bases = { command: 18, intelligence: 5.5, feedback: 11 };
  const base = bases[type];
  return {
    durA: base + (hash % 45) / 10,
    durB: base + 2.4 + ((hash * 7) % 35) / 10,
    delayA: (hash % 37) / 10,
    delayB: (hash % 53) / 10 + 1.6,
    maybeThird: hash % 3 === 0,
    delayC: (hash % 61) / 10 + 3.2,
    durC: base + 4 + ((hash * 11) % 25) / 10,
  };
}

function buildNeuralNetwork(nodes: BrainCoreAgentNode[]) {
  const links: NeuralLink[] = [];
  let delay = 0;
  const anyActive = nodes.some((n) => n.status !== "idle");

  links.push({
    id: "command-ring",
    type: "command",
    d: commandRingPath(),
    active: anyActive,
    delay: 0,
  });

  for (const edge of INTELLIGENCE_LINKS) {
    const fromNode = nodeById(nodes, edge.from);
    const toNode = nodeById(nodes, edge.to);
    if (!fromNode || !toNode) continue;

    links.push({
      id: `intel-${edge.from}-${edge.to}`,
      type: "intelligence",
      d: buildOrbitBezier(fromNode.angle, toNode.angle, INTEL_ORBIT_RADIUS, false),
      active: fromNode.status !== "idle" || toNode.status !== "idle",
      fromId: edge.from,
      toId: edge.to,
      delay: delay++ * 0.31,
    });
  }

  for (const edge of FEEDBACK_LINKS) {
    const fromNode = nodeById(nodes, edge.from);
    const toNode = nodeById(nodes, edge.to);
    if (!fromNode || !toNode) continue;

    links.push({
      id: `fb-${edge.from}-${edge.to}`,
      type: "feedback",
      d: buildOrbitBezier(fromNode.angle, toNode.angle, FEEDBACK_ORBIT_RADIUS, true),
      active: fromNode.status !== "idle" || toNode.status !== "idle",
      fromId: edge.from,
      toId: edge.to,
      delay: delay++ * 0.47,
    });
  }

  return links;
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
    <div className="bc-chamber-wrap bc-v3">
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
}: {
  nodes: BrainCoreAgentNode[];
  coreState: BrainCorePayload["coreState"];
}) {
  const neuralLinks = useMemo(() => buildNeuralNetwork(nodes), [nodes]);

  const linksByLayer = useMemo(
    () => ({
      feedback: neuralLinks.filter((l) => l.type === "feedback"),
      intelligence: neuralLinks.filter((l) => l.type === "intelligence"),
      command: neuralLinks.filter((l) => l.type === "command"),
    }),
    [neuralLinks],
  );

  return (
    <div className={cn("bc-neural-core bc-neural-v3", `bc-core-state-${coreState}`)}>
      <div className="bc-starfield" aria-hidden>
        {Array.from({ length: 48 }).map((_, i) => (
          <span
            key={i}
            className="bc-star"
            style={{
              ["--bc-s-x" as string]: `${(i * 41) % 100}%`,
              ["--bc-s-y" as string]: `${(i * 67) % 100}%`,
              ["--bc-s-s" as string]: `${0.5 + (i % 3) * 0.5}px`,
              ["--bc-s-o" as string]: `${0.15 + (i % 5) * 0.12}`,
              ["--bc-s-d" as string]: `${3 + (i % 8)}s`,
            }}
          />
        ))}
      </div>

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
          <linearGradient id="bc-intel-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(56 189 248 / 0.2)" />
            <stop offset="45%" stopColor="rgb(103 232 249 / 1)" />
            <stop offset="100%" stopColor="rgb(56 189 248 / 0.25)" />
          </linearGradient>
          <linearGradient id="bc-feedback-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(167 139 250 / 0.25)" />
            <stop offset="50%" stopColor="rgb(192 132 252 / 0.95)" />
            <stop offset="100%" stopColor="rgb(167 139 250 / 0.25)" />
          </linearGradient>
          <filter id="bc-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bc-cyan-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bc-purple-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="bc-orbit-clip">
            <path
              d={`M 0 0 H ${CHAMBER_SIZE} V ${CHAMBER_SIZE} H 0 Z M ${CHAMBER_CENTER} ${CHAMBER_CENTER} m -${CORE_PROTECT_RADIUS} 0 a ${CORE_PROTECT_RADIUS} ${CORE_PROTECT_RADIUS} 0 1 0 ${CORE_PROTECT_RADIUS * 2} 0 a ${CORE_PROTECT_RADIUS} ${CORE_PROTECT_RADIUS} 0 1 0 -${CORE_PROTECT_RADIUS * 2} 0 Z`}
              fillRule="evenodd"
            />
          </clipPath>
        </defs>

        <g clipPath="url(#bc-orbit-clip)">
          <NeuralLinkLayer links={linksByLayer.feedback} />
          <NeuralLinkLayer links={linksByLayer.intelligence} />
          <NeuralLinkLayer links={linksByLayer.command} />
        </g>

        <circle
          cx={CHAMBER_CENTER}
          cy={CHAMBER_CENTER}
          r={CORE_PROTECT_RADIUS}
          className="bc-core-protect-ring"
          fill="none"
        />

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
        <div className="bc-core-shield" />
        <div className="bc-neural-pulse" />
        <div className="bc-orbit bc-orbit-1" />
        <div className="bc-orbit bc-orbit-2" />
        <div className="bc-orbit bc-orbit-3" />
        <div className="bc-orbit bc-orbit-4" />
        <div className="bc-orbit bc-orbit-5" />
        <div className="bc-orbit bc-orbit-6" />
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

      <p className="bc-core-label">NEURAL CORE · V3</p>

      <div className="bc-link-legend" aria-label="Connection types">
        <span className="bc-legend-item bc-legend-command">Command routes</span>
        <span className="bc-legend-item bc-legend-intelligence">Intelligence flow</span>
        <span className="bc-legend-item bc-legend-feedback">Feedback loops</span>
      </div>
    </div>
  );
}

function NeuralLinkLayer({ links }: { links: NeuralLink[] }) {
  return (
    <>
      {links.map((link) => (
        <g key={link.id} className="bc-neural-link-group">
          <path
            d={link.d}
            className={cn(
              "bc-neural-link",
              `bc-neural-link-${link.type}`,
              link.active && "bc-neural-link-active",
              link.id === "command-ring" && "bc-command-ring-path",
            )}
            style={{ ["--bc-link-delay" as string]: `${link.delay}s` }}
            fill="none"
          />
          <SignalParticles link={link} />
        </g>
      ))}
    </>
  );
}

function SignalParticles({ link }: { link: NeuralLink }) {
  const timing = particleTiming(link.id, link.type);
  const fromColor =
    link.fromId && link.fromId in AGENT_COLORS
      ? AGENT_COLORS[link.fromId]
      : undefined;

  const showParticles = link.active || link.type === "command";

  if (!showParticles) return null;

  const particleClass = cn(
    "bc-signal-packet",
    `bc-signal-packet-${link.type}`,
  );

  const filter =
    link.type === "intelligence"
      ? "url(#bc-cyan-glow)"
      : link.type === "feedback"
        ? "url(#bc-purple-glow)"
        : undefined;

  const sizes =
    link.type === "command"
      ? { a: 2.2, b: 1.6, c: 1.4 }
      : link.type === "feedback"
        ? { a: 2.8, b: 2, c: 1.8 }
        : { a: 3.2, b: 2.2, c: 2 };

  return (
    <>
      <circle
        r={sizes.a}
        className={particleClass}
        filter={filter}
        fill={fromColor}
      >
        <animateMotion
          dur={`${timing.durA}s`}
          repeatCount="indefinite"
          begin={`${timing.delayA}s`}
          path={link.d}
        />
      </circle>
      <circle
        r={sizes.b}
        className={cn(particleClass, "bc-signal-packet-alt")}
        filter={filter}
        fill={fromColor}
        opacity={0.7}
      >
        <animateMotion
          dur={`${timing.durB}s`}
          repeatCount="indefinite"
          begin={`${timing.delayB}s`}
          path={link.d}
        />
      </circle>
      {timing.maybeThird ? (
        <circle
          r={sizes.c}
          className={cn(particleClass, "bc-signal-packet-tertiary")}
          filter={filter}
          fill={fromColor}
          opacity={0.5}
        >
          <animateMotion
            dur={`${timing.durC}s`}
            repeatCount="indefinite"
            begin={`${timing.delayC}s`}
            path={link.d}
          />
        </circle>
      ) : null}
    </>
  );
}

function AgentNode({ node, index }: { node: BrainCoreAgentNode; index: number }) {
  const pos = nodeCoords(node.angle);
  const receiving = node.status === "processing" || node.status === "online";
  const agentId = node.id as AgentNodeId;
  const nodeColor = AGENT_COLORS[agentId] ?? "#38bdf8";

  return (
    <div
      className={cn(
        "bc-node",
        `bc-node-id-${node.id}`,
        `bc-node-${node.status}`,
        receiving && "bc-node-receiving",
        node.status !== "idle" && "bc-node-active",
      )}
      style={{
        left: `${(pos.x / CHAMBER_SIZE) * 100}%`,
        top: `${(pos.y / CHAMBER_SIZE) * 100}%`,
        ["--bc-node-color" as string]: nodeColor,
        ["--bc-node-delay" as string]: `${index * 0.45}s`,
      }}
    >
      <span className="bc-node-halo" aria-hidden />
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
