"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import type { BrainCoreAgentNode, BrainCorePayload } from "@/lib/facility/brain-core-types";
import {
  advanceCeoStatus,
  appendAmbientFeed,
  applyCascadeBeat,
  applyFeedReaction,
  createInitialLivingState,
  finishCascade,
  type CascadeBeat,
  type LiveAgentNode,
  type LivePacket,
  type LivingNetworkState,
  prunePackets,
  releaseAgentGlow,
  resolveFeedReaction,
  rotateIdleStatuses,
  spawnAmbientPacket,
} from "@/lib/facility/brain-core-living";
import type { BrainCoreFeedItem } from "@/lib/facility/brain-core-types";
import {
  advanceMissionBeat,
  buildWorkflowCascade,
  clearEmergency,
  completeMission,
  createInitialMissionState,
  maybeTriggerEmergency,
  pickNextMission,
  pickNextWorkflow,
  revealMissionReview,
  startMission,
  type MissionIntelligenceState,
} from "@/lib/facility/brain-core-missions";
import {
  CeoReviewOverlay,
  DecisionHistoryPanel,
  EmergencyBanner,
  MissionPanel,
} from "@/components/facility/wings/brain-core-mission-ui";
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
import {
  BRAIN_CORE_AGENT_COLORS,
} from "@/lib/facility/brain-core-agent-colors";
import {
  BRAIN_CEO_GLOW_SCALE,
  BRAIN_CHAMBER_SIZE,
  BRAIN_COMMAND_RING_RADIUS,
  BRAIN_FEEDBACK_ORBIT_RADIUS,
  BRAIN_INTEL_ORBIT_RADIUS,
  BRAIN_NODE_AURA_PX,
  BRAIN_NODE_DOT_PX,
  BRAIN_NODE_EDGE_TRIM,
  BRAIN_NODE_HALO_PX,
  BRAIN_NODE_ORBIT_GLOW_PX,
  BRAIN_NODE_RADIUS,
  brainChamberCenter,
  brainNodeCenter,
  type BrainCoreAgentNodeId,
} from "@/lib/facility/brain-core-alignment";

const CHAMBER_SIZE = BRAIN_CHAMBER_SIZE;
const CHAMBER_CENTER = brainChamberCenter();
const NODE_RADIUS = BRAIN_NODE_RADIUS;
const CORE_RADIUS = 78;
const CORE_PROTECT_RADIUS = 118;
const INTEL_ORBIT_RADIUS = BRAIN_INTEL_ORBIT_RADIUS;
const FEEDBACK_ORBIT_RADIUS = BRAIN_FEEDBACK_ORBIT_RADIUS;
const COMMAND_RING_RADIUS = BRAIN_COMMAND_RING_RADIUS;
const NODE_EDGE_TRIM = BRAIN_NODE_EDGE_TRIM;

type NeuralLinkType = "command" | "intelligence" | "feedback";

type AgentNodeId = BrainCoreAgentNodeId;

const AGENT_COLORS: Record<AgentNodeId, string> = {
  ...BRAIN_CORE_AGENT_COLORS,
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

interface OrbitLinkDef {
  from: AgentNodeId;
  to: AgentNodeId;
  longArc?: boolean;
  orbitRadius?: number;
}

const INTELLIGENCE_LINKS: OrbitLinkDef[] = [
  { from: "ceo", to: "research" },
  { from: "research", to: "commerce" },
  { from: "commerce", to: "designer" },
  { from: "commerce", to: "shopify" },
  { from: "designer", to: "content" },
  { from: "designer", to: "image" },
  { from: "image", to: "content" },
  { from: "content", to: "marketing" },
  { from: "content", to: "image" },
  { from: "shopify", to: "research", longArc: true, orbitRadius: INTEL_ORBIT_RADIUS + 10 },
];

const FEEDBACK_LINKS: Array<{ from: AgentNodeId; to: AgentNodeId }> = [
  { from: "research", to: "ceo" },
  { from: "commerce", to: "ceo" },
  { from: "marketing", to: "ceo" },
  { from: "shopify", to: "ceo" },
];

/** Specialist orbit routes — continuous ambient signal flow (Shopify reference). */
const SPECIALIST_SIGNAL_ROUTE_IDS = new Set([
  "intel-commerce-shopify",
  "intel-designer-image",
  "intel-designer-content",
  "intel-image-content",
  "intel-content-marketing",
  "intel-content-image",
  "intel-shopify-research",
  "fb-shopify-ceo",
  "fb-marketing-ceo",
]);

const SPECIALIST_AGENT_IDS = new Set<AgentNodeId>([
  "shopify",
  "image",
  "content",
  "designer",
  "marketing",
]);

function pointOnCircle(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CHAMBER_CENTER + radius * Math.cos(rad),
    y: CHAMBER_CENTER + radius * Math.sin(rad),
  };
}

function nodeCoords(angle: number, agentId?: AgentNodeId) {
  return brainNodeCenter(angle, agentId);
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

function orbitSpan(fromAngle: number, toAngle: number, longArc: boolean): number {
  const cwSpan = ((toAngle - fromAngle + 360) % 360) || 360;
  const ccwSpan = cwSpan - 360;
  return longArc
    ? cwSpan <= 180
      ? ccwSpan
      : cwSpan
    : cwSpan <= 180
      ? cwSpan
      : ccwSpan;
}

function buildOrbitArc(
  fromAngle: number,
  toAngle: number,
  orbitRadius: number,
  longArc: boolean,
  fromId?: AgentNodeId,
  toId?: AgentNodeId,
): string {
  const span = orbitSpan(fromAngle, toAngle, longArc);
  const nodeFrom = nodeCoords(fromAngle, fromId);
  const nodeTo = nodeCoords(toAngle, toId);
  const orbitFrom = pointOnCircle(fromAngle, orbitRadius);
  const orbitTo = pointOnCircle(toAngle, orbitRadius);

  const start =
    NODE_EDGE_TRIM > 0
      ? trimToward(nodeFrom, orbitFrom, NODE_EDGE_TRIM)
      : nodeFrom;
  const end =
    NODE_EDGE_TRIM > 0 ? trimToward(nodeTo, orbitTo, NODE_EDGE_TRIM) : nodeTo;

  const largeArcFlag = Math.abs(span) > 180 ? 1 : 0;
  const sweepFlag = span >= 0 ? 1 : 0;

  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `L ${orbitFrom.x.toFixed(2)} ${orbitFrom.y.toFixed(2)}`,
    `A ${orbitRadius} ${orbitRadius} 0 ${largeArcFlag} ${sweepFlag} ${orbitTo.x.toFixed(2)} ${orbitTo.y.toFixed(2)}`,
    `L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(" ");
}

function commandRingPath(): string {
  const cx = CHAMBER_CENTER;
  const cy = CHAMBER_CENTER;
  const r = COMMAND_RING_RADIUS;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
}

function buildNeuralNetwork(
  nodes: BrainCoreAgentNode[],
  activeLinkIds: Set<string>,
  isStandby: boolean,
) {
  const links: NeuralLink[] = [];
  let delay = 0;

  links.push({
    id: "command-ring",
    type: "command",
    d: commandRingPath(),
    active: true,
    delay: 0,
  });

  for (const edge of INTELLIGENCE_LINKS) {
    const fromNode = nodeById(nodes, edge.from);
    const toNode = nodeById(nodes, edge.to);
    if (!fromNode || !toNode) continue;

    const id = `intel-${edge.from}-${edge.to}`;
    links.push({
      id,
      type: "intelligence",
      d: buildOrbitArc(
        fromNode.angle,
        toNode.angle,
        edge.orbitRadius ?? INTEL_ORBIT_RADIUS,
        edge.longArc ?? false,
        edge.from,
        edge.to,
      ),
      active: activeLinkIds.has(id),
      fromId: edge.from,
      toId: edge.to,
      delay: delay++ * 0.31,
    });
  }

  for (const edge of FEEDBACK_LINKS) {
    const fromNode = nodeById(nodes, edge.from);
    const toNode = nodeById(nodes, edge.to);
    if (!fromNode || !toNode) continue;

    const id = `fb-${edge.from}-${edge.to}`;
    links.push({
      id,
      type: "feedback",
      d: buildOrbitArc(
        fromNode.angle,
        toNode.angle,
        FEEDBACK_ORBIT_RADIUS,
        true,
        edge.from,
        edge.to,
      ),
      active: activeLinkIds.has(id),
      fromId: edge.from,
      toId: edge.to,
      delay: delay++ * 0.47,
    });
  }

  if (isStandby && links.every((l) => l.id === "command-ring" || !l.active)) {
    links[0]!.active = true;
  }

  return links;
}

function useBrainCoreLiving(
  data: BrainCorePayload | null,
  baseNodes: BrainCoreAgentNode[],
) {
  const [living, setLiving] = useState<LivingNetworkState | null>(null);
  const [mission, setMission] = useState<MissionIntelligenceState>(createInitialMissionState);
  const cascadeStep = useRef(0);
  const missionBeats = useRef<CascadeBeat[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seenFeedIds = useRef<Set<string>>(new Set());
  const [feedPulses, setFeedPulses] = useState<
    Partial<Record<AgentNodeId, BrainCoreFeedItem["kind"]>>
  >({});

  const linkPaths = useMemo(() => {
    const links = buildNeuralNetwork(baseNodes, new Set(), true);
    return new Map(links.map((l) => [l.id, l.d]));
  }, [baseNodes]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  useEffect(() => {
    if (!data) return;
    setLiving(createInitialLivingState(data));
    setMission(createInitialMissionState());
    cascadeStep.current = 0;
    missionBeats.current = [];
    seenFeedIds.current = new Set(data.feed.map((f) => f.id));
    setFeedPulses({});
  }, [data?.loadedAt]);

  useEffect(() => {
    if (!data) return;

    clearTimers();
    cascadeStep.current = 0;

    const beginMission = () => {
      const definition = pickNextMission();
      const workflowId = pickNextWorkflow();
      missionBeats.current = buildWorkflowCascade(workflowId, definition);
      setMission((prev) => startMission(definition, workflowId, prev));
    };

    const runBeat = () => {
      const beats = missionBeats.current;
      const beat = beats[cascadeStep.current];

      if (!beat) {
        setLiving((prev) => (prev ? finishCascade(prev) : prev));
        setMission((prev) => completeMission(prev));
        cascadeStep.current = 0;
        missionBeats.current = [];
        schedule(() => {
          setMission((prev) => revealMissionReview(prev));
        }, 1500 + Math.random() * 500);
        schedule(() => {
          setMission((prev) => maybeTriggerEmergency(prev));
        }, 2000);
        schedule(runBeat, 14000 + Math.random() * 8000);
        return;
      }

      setLiving((prev) =>
        prev ? applyCascadeBeat(prev, beat, linkPaths) : prev,
      );
      setMission((prev) => advanceMissionBeat(prev, cascadeStep.current, beat));

      if (beat.activate.includes("ceo")) {
        [0, 1, 2, 3].forEach((phase, index) => {
          schedule(() => {
            setLiving((prev) => (prev ? advanceCeoStatus(prev, phase) : prev));
          }, index * 850);
        });
      }

      cascadeStep.current += 1;
      schedule(runBeat, beat.holdMs);
    };

    schedule(() => {
      beginMission();
      runBeat();
    }, 2500 + Math.random() * 2000);

    const feedInterval = setInterval(() => {
      setLiving((prev) => {
        if (!prev) return prev;
        const next = appendAmbientFeed(prev);
        const newest = next.feed[0];
        if (!newest || seenFeedIds.current.has(newest.id)) return next;
        seenFeedIds.current.add(newest.id);
        const reacted = applyFeedReaction(next, newest, linkPaths);
        const reaction = resolveFeedReaction(newest);
        if (reaction) {
          setFeedPulses((p) => ({ ...p, [reaction.agentId]: newest.kind }));
          schedule(() => {
            setFeedPulses((p) => {
              const copy = { ...p };
              delete copy[reaction.agentId];
              return copy;
            });
            setLiving((prev) =>
              prev ? releaseAgentGlow(prev, reaction.agentId) : prev,
            );
          }, 3200);
        }
        return reacted;
      });
    }, 3800);

    const statusInterval = setInterval(() => {
      setLiving((prev) => (prev ? rotateIdleStatuses(prev) : prev));
    }, 5500);

    const ambientInterval = setInterval(() => {
      setLiving((prev) => (prev ? spawnAmbientPacket(prev, linkPaths) : prev));
    }, 2200);

    const emergencyClear = setInterval(() => {
      setMission((prev) => {
        if (!prev.emergency) return prev;
        const alertId = prev.emergency.alertLinkId;
        setLiving((livingPrev) => {
          if (!livingPrev) return livingPrev;
          const activeLinkIds = new Set(livingPrev.activeLinkIds);
          activeLinkIds.delete(alertId);
          return {
            ...livingPrev,
            activeLinkIds,
            chamberMode: "standby",
            motionScale: 0.72,
          };
        });
        return clearEmergency(prev);
      });
    }, 6000);

    return () => {
      clearTimers();
      clearInterval(feedInterval);
      clearInterval(statusInterval);
      clearInterval(ambientInterval);
      clearInterval(emergencyClear);
    };
  }, [data?.loadedAt, linkPaths, clearTimers, schedule]);

  const expirePacket = useCallback((id: string) => {
    setLiving((prev) => {
      if (!prev) return prev;
      const packets = prev.packets.filter((p) => p.id !== id);
      const activeLinkIds = new Set(prev.activeLinkIds);
      const removed = prev.packets.find((p) => p.id === id);
      if (
        removed &&
        !packets.some((p) => p.linkId === removed.linkId) &&
        prev.chamberMode === "standby"
      ) {
        activeLinkIds.delete(removed.linkId);
      }

      let next = {
        ...prev,
        packets,
        activeLinkIds,
        chamberMode:
          prev.chamberMode === "ambient" && packets.length === 0
            ? "standby"
            : prev.chamberMode,
        motionScale:
          packets.length === 0 && prev.chamberMode === "ambient"
            ? 0.72
            : prev.motionScale,
      };

      if (
        removed &&
        (prev.chamberMode === "ambient" || prev.chamberMode === "standby")
      ) {
        next = releaseAgentGlow(next, removed.fromId);
      }

      return next;
    });
  }, []);

  useEffect(() => {
    const prune = setInterval(() => {
      setLiving((prev) => (prev ? prunePackets(prev) : prev));
    }, 8000);
    return () => clearInterval(prune);
  }, []);

  useEffect(() => {
    if (!mission.emergency || !living) return;
    setLiving((prev) => {
      if (!prev) return prev;
      const activeLinkIds = new Set(prev.activeLinkIds);
      activeLinkIds.add(mission.emergency!.alertLinkId);
      return {
        ...prev,
        activeLinkIds,
        feed: [
          {
            id: `emergency-feed-${mission.emergency!.id}`,
            message: mission.emergency!.message,
            timestamp: new Date().toISOString(),
            kind: mission.emergency!.feedKind,
          },
          ...prev.feed,
        ].slice(0, 14),
        chamberMode: "cascade",
        motionScale: 0.85,
      };
    });
  }, [mission.emergency?.id]);

  useEffect(() => {
    if (!living?.feed[0]) return;
    const newest = living.feed[0];
    if (seenFeedIds.current.has(newest.id)) return;
    seenFeedIds.current.add(newest.id);

    const reaction = resolveFeedReaction(newest);
    if (!reaction) return;

    setLiving((prev) => (prev ? applyFeedReaction(prev, newest, linkPaths) : prev));
    setFeedPulses((p) => ({ ...p, [reaction.agentId]: newest.kind }));
    const timer = setTimeout(() => {
      setFeedPulses((p) => {
        const copy = { ...p };
        delete copy[reaction.agentId];
        return copy;
      });
      setLiving((prev) =>
        prev ? releaseAgentGlow(prev, reaction.agentId) : prev,
      );
    }, 3200);
    return () => clearTimeout(timer);
  }, [living?.feed[0]?.id, linkPaths]);

  return { living, mission, expirePacket, linkPaths, feedPulses };
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
  const { living, mission, expirePacket, feedPulses } = useBrainCoreLiving(data, data.nodes);
  const liveState = living ?? createInitialLivingState(data);
  const isVisualStandby =
    liveState.chamberMode === "standby" && !mission.activeMission && !mission.emergency;

  return (
    <div
      className={cn(
        "bc-chamber-wrap bc-v3 bc-v4 bc-v5",
        isVisualStandby && "bc-chamber-standby",
        liveState.chamberMode === "ceo-event" && "bc-chamber-ceo-event",
        mission.emergency && "bc-chamber-emergency",
      )}
      style={{ ["--bc-motion-scale" as string]: String(liveState.motionScale) }}
    >
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
            {liveState.feed.map((item, index) => (
              <li
                key={item.id}
                className={cn(
                  "bc-feed-item",
                  `bc-feed-${item.kind}`,
                  index === 0 && "bc-feed-item-new",
                )}
              >
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
          {mission.emergency ? (
            <EmergencyBanner message={mission.emergency.message} />
          ) : null}
          {mission.activeMission ? (
            <MissionPanel mission={mission.activeMission} />
          ) : null}
          {mission.reviewCardVisible && mission.displayedReview ? (
            <CeoReviewOverlay review={mission.displayedReview} />
          ) : null}
          <NeuralCore
            baseNodes={data.nodes}
            liveNodes={liveState.nodes}
            coreState={data.coreState}
            activeLinkIds={liveState.activeLinkIds}
            alertLinkIds={
              mission.emergency ? new Set([mission.emergency.alertLinkId]) : new Set()
            }
            packets={liveState.packets}
            chamberMode={liveState.chamberMode}
            motionScale={liveState.motionScale}
            missionOwnerId={mission.missionOwnerId}
            previousActiveId={liveState.previousActiveId}
            feedPulses={feedPulses}
            onPacketExpire={expirePacket}
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
          <DecisionHistoryPanel records={mission.decisionHistory} />
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
                liveState.chamberMode === "ceo-event" && "bc-decision-card-live",
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
  baseNodes,
  liveNodes,
  coreState,
  activeLinkIds,
  alertLinkIds,
  packets,
  chamberMode,
  motionScale,
  missionOwnerId,
  previousActiveId,
  feedPulses,
  onPacketExpire,
}: {
  baseNodes: BrainCoreAgentNode[];
  liveNodes: LiveAgentNode[];
  coreState: BrainCorePayload["coreState"];
  activeLinkIds: Set<string>;
  alertLinkIds: Set<string>;
  packets: LivePacket[];
  chamberMode: LivingNetworkState["chamberMode"];
  motionScale: number;
  missionOwnerId: AgentNodeId | null;
  previousActiveId: AgentNodeId | null;
  feedPulses: Partial<Record<AgentNodeId, BrainCoreFeedItem["kind"]>>;
  onPacketExpire: (id: string) => void;
}) {
  const isStandby = chamberMode === "standby";
  const neuralLinks = useMemo(
    () => buildNeuralNetwork(baseNodes, activeLinkIds, isStandby),
    [baseNodes, activeLinkIds, isStandby],
  );

  const linksByLayer = useMemo(
    () => ({
      feedback: neuralLinks.filter((l) => l.type === "feedback"),
      intelligence: neuralLinks.filter((l) => l.type === "intelligence"),
      command: neuralLinks.filter((l) => l.type === "command"),
    }),
    [neuralLinks],
  );

  const ceoLive = liveNodes.find((n) => n.id === "ceo");

  return (
    <div
      className={cn(
        "bc-neural-core bc-neural-v3 bc-neural-v4 bc-neural-v5",
        `bc-core-state-${coreState}`,
        `bc-chamber-mode-${chamberMode}`,
        ceoLive?.isLiveActive && ceoLive.liveState === "executing" && "bc-ceo-command-active",
      )}
      style={{
        ["--bc-motion-scale" as string]: String(motionScale),
        ["--bc-node-dot-size" as string]: `${BRAIN_NODE_DOT_PX}px`,
        ["--bc-node-orbit-glow-size" as string]: `${BRAIN_NODE_ORBIT_GLOW_PX}px`,
        ["--bc-node-halo-size" as string]: `${BRAIN_NODE_HALO_PX}px`,
        ["--bc-node-aura-size" as string]: `${BRAIN_NODE_AURA_PX}px`,
        ["--bc-ceo-glow-scale" as string]: String(BRAIN_CEO_GLOW_SCALE),
      }}
    >
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
        <span className="bc-wave bc-wave-4" />
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
          <filter id="bc-packet-trail" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bc-packet-trail-strong" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bc-packet-bloom" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
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
          <NeuralLinkLayer
            links={linksByLayer.feedback}
            chamberMode={chamberMode}
            alertLinkIds={alertLinkIds}
          />
          <NeuralLinkLayer
            links={linksByLayer.intelligence}
            chamberMode={chamberMode}
            alertLinkIds={alertLinkIds}
          />
          <NeuralLinkLayer
            links={linksByLayer.command}
            chamberMode={chamberMode}
            alertLinkIds={alertLinkIds}
            alwaysAmbient
          />
          <LivePacketLayer packets={packets} onExpire={onPacketExpire} />
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
        <div className="bc-neural-pulse bc-neural-pulse-slow" />
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
        {liveNodes.map((node, index) => (
          <AgentNode
            key={node.id}
            node={node}
            index={index}
            chamberMode={chamberMode}
            isMissionOwner={missionOwnerId === node.id}
            previousActiveId={previousActiveId}
            feedEventKind={feedPulses[node.id]}
          />
        ))}
      </div>

      <p className="bc-core-label">NEURAL CORE · V5</p>

      <div className="bc-link-legend" aria-label="Connection types">
        <span className="bc-legend-item bc-legend-command">Command network</span>
        <span className="bc-legend-item bc-legend-intelligence">Intelligence flow</span>
        <span className="bc-legend-item bc-legend-feedback">Feedback matrix</span>
      </div>
    </div>
  );
}

function NeuralLinkLayer({
  links,
  chamberMode,
  alertLinkIds,
  alwaysAmbient = false,
}: {
  links: NeuralLink[];
  chamberMode: LivingNetworkState["chamberMode"];
  alertLinkIds: Set<string>;
  alwaysAmbient?: boolean;
}) {
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
              chamberMode === "standby" && !link.active && "bc-neural-link-standby",
              alertLinkIds.has(link.id) && "bc-neural-link-alert",
            )}
            style={{ ["--bc-link-delay" as string]: `${link.delay}s` }}
            fill="none"
          />
          {link.active || alwaysAmbient || SPECIALIST_SIGNAL_ROUTE_IDS.has(link.id) ? (
            <>
              <AmbientRingParticle
                link={link}
                color={signalColorForLink(link)}
                signalRoute={SPECIALIST_SIGNAL_ROUTE_IDS.has(link.id)}
              />
              <AmbientRingParticle
                link={link}
                phaseOffset={1.35}
                color={signalColorForLink(link)}
                signalRoute={SPECIALIST_SIGNAL_ROUTE_IDS.has(link.id)}
                variant="soft"
              />
              <AmbientRingParticle
                link={link}
                phaseOffset={2.8}
                color={signalColorForLink(link)}
                signalRoute={SPECIALIST_SIGNAL_ROUTE_IDS.has(link.id)}
                variant="soft"
              />
              {link.active && link.type !== "command" ? (
                <AmbientRingParticle
                  link={link}
                  phaseOffset={4.2}
                  color={signalColorForLink(link)}
                  signalRoute={SPECIALIST_SIGNAL_ROUTE_IDS.has(link.id)}
                />
              ) : null}
            </>
          ) : null}
        </g>
      ))}
    </>
  );
}

function signalColorForLink(link: NeuralLink): string | undefined {
  if (!link.fromId) return undefined;
  return AGENT_COLORS[link.fromId];
}

function AmbientRingParticle({
  link,
  phaseOffset = 0,
  color,
  signalRoute = false,
  variant = "default",
}: {
  link: NeuralLink;
  phaseOffset?: number;
  color?: string;
  signalRoute?: boolean;
  variant?: "default" | "soft";
}) {
  const energized = link.active || signalRoute;
  const delay = 0.8 + (linkHash(link.id) % 40) / 5 + phaseOffset;
  const duration =
    (10 + (linkHash(link.id) % 24)) /
    (link.type === "command" ? 1 : energized ? 1.15 : 1.5);
  const radius =
    variant === "soft"
      ? energized
        ? 2.2
        : 1.5
      : energized
        ? 3.2
        : 1.8;

  return (
    <circle
      r={radius}
      className={cn(
        "bc-ambient-packet",
        energized && "bc-ambient-packet-active",
        signalRoute && "bc-ambient-packet-signal",
        color && "bc-ambient-packet-agent",
      )}
      fill={color}
      opacity={energized ? 0.72 : 0.42}
      filter={color ? "url(#bc-packet-bloom)" : undefined}
    >
      <animateMotion
        dur={`${duration}s`}
        repeatCount="indefinite"
        begin={`${delay}s`}
        path={link.d}
      />
    </circle>
  );
}

function linkHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * (i + 3)) % 997;
  }
  return hash;
}

function LivePacketLayer({
  packets,
  onExpire,
}: {
  packets: LivePacket[];
  onExpire: (id: string) => void;
}) {
  return (
    <>
      {packets.map((packet) => (
        <LivePacket key={packet.id} packet={packet} onExpire={onExpire} />
      ))}
    </>
  );
}

function LivePacket({
  packet,
  onExpire,
}: {
  packet: LivePacket;
  onExpire: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(
      () => onExpire(packet.id),
      packet.duration * 1000 + 300,
    );
    return () => clearTimeout(timer);
  }, [packet.id, packet.duration, onExpire]);

  const color = AGENT_COLORS[packet.fromId];
  const filter =
    packet.type === "intelligence"
      ? "url(#bc-packet-trail)"
      : packet.type === "feedback"
        ? "url(#bc-purple-glow)"
        : undefined;

  const delay = (linkHash(packet.id) % 20) / 10;

  return (
    <g className="bc-live-packet-group">
      <circle
        r={packet.size * 2.4}
        className={cn("bc-live-packet-trail", `bc-live-packet-trail-${packet.type}`)}
        fill={color}
        opacity={0.42}
        filter="url(#bc-packet-trail-strong)"
      >
        <animateMotion
          dur={`${packet.duration}s`}
          repeatCount="1"
          begin={`${delay}s`}
          fill="freeze"
          path={packet.path}
        />
      </circle>
      <circle
        r={packet.size * 1.15}
        className={cn("bc-live-packet", `bc-live-packet-${packet.type}`)}
        fill={color}
        filter={filter ?? "url(#bc-packet-bloom)"}
      >
        <animateMotion
          dur={`${packet.duration}s`}
          repeatCount="1"
          begin={`${delay}s`}
          fill="freeze"
          path={packet.path}
        />
      </circle>
    </g>
  );
}

function AgentNode({
  node,
  index,
  chamberMode,
  isMissionOwner,
  previousActiveId,
  feedEventKind,
}: {
  node: LiveAgentNode;
  index: number;
  chamberMode: LivingNetworkState["chamberMode"];
  isMissionOwner: boolean;
  previousActiveId: AgentNodeId | null;
  feedEventKind?: BrainCoreFeedItem["kind"];
}) {
  const agentId = node.id;
  const pos = nodeCoords(node.angle, agentId);
  const nodeColor = AGENT_COLORS[agentId] ?? "#38bdf8";
  const isCeoEvent = agentId === "ceo" && chamberMode === "ceo-event" && node.isLiveActive;
  const isActive = node.isLiveActive || isMissionOwner || Boolean(feedEventKind);
  const isRecent = !isActive && previousActiveId === agentId;
  const isSpecialist = SPECIALIST_AGENT_IDS.has(agentId);
  const showSignalParticles = isActive || (isSpecialist && isRecent);
  const lightTier = isActive ? "active" : isRecent ? "recent" : "standby";

  return (
    <div
      className={cn(
        "bc-node",
        `bc-node-id-${node.id}`,
        `bc-node-live-${node.liveState}`,
        `bc-node-light-${lightTier}`,
        isActive && "bc-node-live-active",
        isRecent && "bc-node-live-recent",
        node.liveState !== "idle" && "bc-node-active",
        isCeoEvent && "bc-node-ceo-event",
        isMissionOwner && "bc-node-mission-owner",
        feedEventKind && `bc-node-feed-event bc-node-feed-event-${feedEventKind}`,
      )}
      style={{
        left: `${(pos.x / CHAMBER_SIZE) * 100}%`,
        top: `${(pos.y / CHAMBER_SIZE) * 100}%`,
        ["--bc-node-color" as string]: nodeColor,
        ["--bc-node-delay" as string]: `${index * 0.45}s`,
        ["--bc-node-light" as string]: isActive ? "1" : isRecent ? "0.5" : "0.25",
      }}
    >
      <span className="bc-node-orbit-glow" aria-hidden />
      <span className="bc-node-halo" aria-hidden />
      <span className="bc-node-aura" aria-hidden />
      {showSignalParticles ? <span className="bc-node-ring" aria-hidden /> : null}
      {showSignalParticles ? (
        <span className="bc-node-particles" aria-hidden>
          {Array.from({ length: isSpecialist ? 8 : 6 }).map((_, i) => (
            <span
              key={i}
              className="bc-node-particle"
              style={{
                ["--bc-np-angle" as string]: `${i * 60}deg`,
                ["--bc-np-delay" as string]: `${(i * 0.35) % 2}s`,
                ["--bc-np-dist" as string]: `${14 + (i % 3) * 6}px`,
              }}
            />
          ))}
        </span>
      ) : null}
      {node.liveState === "reporting" ? (
        <span className="bc-node-report-beam" aria-hidden />
      ) : null}
      <span className="bc-node-dot" />
      <div className="bc-node-body">
        <strong>{node.label}</strong>
        <small className={isActive ? "bc-node-status-live" : undefined}>
          {node.statusLabel}
        </small>
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
