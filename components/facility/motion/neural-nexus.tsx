"use client";

import {
  deriveBrainActivityLevel,
  derivePortIntensity,
  type BrainNexusState,
} from "@/lib/facility/derive-brain-nexus-state";
import {
  BRAIN_PORT_DEGREES,
  FACILITY_CONDUIT_NODES,
} from "@/lib/facility/graph";
import { FACILITY_SILENT_CORE } from "@/lib/facility/silent-core";
import type {
  BrainPulseKind,
  FacilityLabId,
  KnowledgeFlowSequence,
  LabSnapshot,
  NetworkSurgeMode,
} from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { memo, useEffect, useMemo, useRef } from "react";

interface NeuralNexusProps {
  state: BrainNexusState;
  labs: Record<FacilityLabId, LabSnapshot>;
  knowledgeFlow?: KnowledgeFlowSequence | null;
  surge?: boolean;
  pulse?: BrainPulseKind;
  networkSurge?: NetworkSurgeMode;
  activeExecutions?: number;
}

const STATE_CONFIG: Record<
  BrainNexusState,
  {
    fogSpeed: number;
    synapseSpeed: number;
    particleSpeed: number;
    connectionDist: number;
    clusterCount: number;
    particleCount: number;
    fragmentRate: number;
    thoughtRate: number;
  }
> = {
  idle: {
    fogSpeed: 0.14,
    synapseSpeed: 0.45,
    particleSpeed: 0.32,
    connectionDist: 26,
    clusterCount: 8,
    particleCount: 120,
    fragmentRate: 0.004,
    thoughtRate: 0.012,
  },
  processing: {
    fogSpeed: 0.24,
    synapseSpeed: 0.85,
    particleSpeed: 0.68,
    connectionDist: 30,
    clusterCount: 9,
    particleCount: 145,
    fragmentRate: 0.007,
    thoughtRate: 0.028,
  },
  learning: {
    fogSpeed: 0.2,
    synapseSpeed: 1,
    particleSpeed: 0.58,
    connectionDist: 34,
    clusterCount: 10,
    particleCount: 165,
    fragmentRate: 0.009,
    thoughtRate: 0.022,
  },
  decision: {
    fogSpeed: 0.22,
    synapseSpeed: 0.78,
    particleSpeed: 0.62,
    connectionDist: 28,
    clusterCount: 8,
    particleCount: 130,
    fragmentRate: 0.006,
    thoughtRate: 0.02,
  },
  alert: {
    fogSpeed: 0.3,
    synapseSpeed: 1.15,
    particleSpeed: 0.9,
    connectionDist: 24,
    clusterCount: 7,
    particleCount: 115,
    fragmentRate: 0.005,
    thoughtRate: 0.035,
  },
  synthesizing: {
    fogSpeed: 0.38,
    synapseSpeed: 1.45,
    particleSpeed: 1.1,
    connectionDist: 36,
    clusterCount: 11,
    particleCount: 190,
    fragmentRate: 0.014,
    thoughtRate: 0.055,
  },
};

interface NeuralNode {
  x: number;
  y: number;
  z: number;
  radius: number;
  phase: number;
  drift: number;
  activation: number;
  activationDecay: number;
}

interface SynapseLink {
  a: number;
  b: number;
  strength: number;
}

interface NexusParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  node: number;
  phase: number;
}

interface FogBlob {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
}

interface DataFragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  char: string;
}

interface ThoughtPulse {
  from: number;
  to: number;
  progress: number;
  speed: number;
  alpha: number;
}

interface KnowledgeOrbit {
  label: string;
  radius: number;
  tilt: number;
  speed: number;
  phase: number;
}

interface SynapticDot {
  linkIdx: number;
  progress: number;
  speed: number;
}

const KNOWLEDGE_ORBITS: KnowledgeOrbit[] = [
  { label: "TASKS", radius: 38, tilt: 0.12, speed: 0.22, phase: 0 },
  { label: "REPORTS", radius: 34, tilt: -0.08, speed: -0.18, phase: 1.2 },
  { label: "MEMORY", radius: 30, tilt: 0.05, speed: 0.26, phase: 2.4 },
  { label: "GOALS", radius: 26, tilt: -0.1, speed: -0.2, phase: 3.6 },
  { label: "EVENTS", radius: 22, tilt: 0.07, speed: 0.3, phase: 4.8 },
];

function seedNeuralNodes(count: number): NeuralNode[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const angle = i * golden;
    const r = 8 + Math.sqrt(t) * 22;
    return {
      x: Math.cos(angle) * r + (Math.random() - 0.5) * 3,
      y: Math.sin(angle) * r * 0.88 + (Math.random() - 0.5) * 3,
      z: (Math.random() - 0.5) * 8,
      radius: 1.2 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
      drift: 0.25 + Math.random() * 0.35,
      activation: 0,
      activationDecay: 0.92 + Math.random() * 0.04,
    };
  });
}

function buildSynapseLinks(nodes: NeuralNode[], maxDist: number): SynapseLink[] {
  const links: SynapseLink[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
      if (dist < maxDist) {
        links.push({ a: i, b: j, strength: 1 - dist / maxDist });
      }
    }
  }
  return links;
}

function seedFog(count: number): FogBlob[] {
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 72,
    y: (Math.random() - 0.5) * 72,
    radius: 16 + Math.random() * 24,
    vx: (Math.random() - 0.5) * 0.06,
    vy: (Math.random() - 0.5) * 0.06,
    alpha: 0.035 + Math.random() * 0.045,
  }));
}

function seedParticles(nodes: NeuralNode[], count: number): NexusParticle[] {
  const particles: NexusParticle[] = [];
  for (let i = 0; i < count; i++) {
    const node = Math.floor(Math.random() * nodes.length);
    const n = nodes[node];
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 6;
    particles.push({
      x: n.x + Math.cos(angle) * dist,
      y: n.y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      size: 0.4 + Math.random() * 1,
      node,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return particles;
}

function statePalette(state: BrainNexusState) {
  switch (state) {
    case "alert":
      return {
        fog: "248, 113, 113",
        synapse: "248, 113, 113",
        particle: "252, 165, 165",
        core: "80, 20, 20",
        gold: "255, 180, 80",
        cyan: "34, 211, 238",
      };
    case "synthesizing":
      return {
        fog: "255, 209, 102",
        synapse: "56, 189, 248",
        particle: "255, 209, 102",
        core: "20, 35, 55",
        gold: "255, 209, 102",
        cyan: "34, 211, 238",
      };
    case "decision":
      return {
        fog: "255, 209, 102",
        synapse: "56, 189, 248",
        particle: "186, 230, 253",
        core: "18, 32, 48",
        gold: "255, 209, 102",
        cyan: "34, 211, 238",
      };
    case "learning":
      return {
        fog: "52, 211, 153",
        synapse: "34, 211, 238",
        particle: "110, 231, 183",
        core: "12, 38, 48",
        gold: "255, 209, 102",
        cyan: "34, 211, 238",
      };
    case "processing":
      return {
        fog: "56, 189, 248",
        synapse: "34, 211, 238",
        particle: "125, 211, 252",
        core: "10, 28, 45",
        gold: "255, 209, 102",
        cyan: "34, 211, 238",
      };
    default:
      return {
        fog: "56, 189, 248",
        synapse: "100, 160, 200",
        particle: "148, 180, 210",
        core: "8, 18, 32",
        gold: "255, 209, 102",
        cyan: "34, 211, 238",
      };
  }
}

const FRAGMENT_CHARS = [
  "MEM",
  "CTX",
  "SIG",
  "PAT",
  "REC",
  "DEC",
  "λ",
  "Σ",
  "◈",
];

function drawContainmentRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  tick: number,
  palette: ReturnType<typeof statePalette>,
  synthesisMode: boolean,
  activityLevel: number,
) {
  const rings = [
    { r: 44, dash: [6, 8], speed: 0.12, alpha: 0.06, color: palette.gold },
    { r: 40, dash: [4, 6], speed: -0.15, alpha: 0.08, color: palette.synapse },
    { r: 36, dash: [3, 5], speed: 0.18, alpha: 0.1, color: palette.cyan },
  ];

  for (const ring of rings) {
    const radius = ring.r * scale;
    const rotation = tick * ring.speed * (synthesisMode ? 2.2 : 1 + activityLevel);
    const alpha = ring.alpha * (synthesisMode ? 2 : 1) * (0.7 + activityLevel * 0.5);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${ring.color}, ${alpha})`;
    ctx.lineWidth = 0.6;
    ctx.setLineDash(ring.dash);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawKnowledgeOrbits(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  tick: number,
  palette: ReturnType<typeof statePalette>,
  synthesisMode: boolean,
  activityLevel: number,
) {
  for (const orbit of KNOWLEDGE_ORBITS) {
    const angle = tick * orbit.speed * (synthesisMode ? 2.5 : 1 + activityLevel * 0.4) + orbit.phase;
    const rx = orbit.radius * scale;
    const ry = orbit.radius * scale * (0.72 + orbit.tilt);
    const alpha = 0.06 + activityLevel * 0.04 + (synthesisMode ? 0.08 : 0);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${palette.synapse}, ${alpha})`;
    ctx.lineWidth = 0.4;
    ctx.stroke();

    const labelAngle = -angle + Math.PI * 0.25;
    const lx = Math.cos(labelAngle) * rx;
    const ly = Math.sin(labelAngle) * ry;
    ctx.font = `${4.5}px monospace`;
    ctx.fillStyle = `rgba(${palette.particle}, ${0.18 + activityLevel * 0.12})`;
    ctx.textAlign = "center";
    ctx.fillText(orbit.label, lx, ly);
    ctx.restore();
  }
}

function drawIntakePorts(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  tick: number,
  palette: ReturnType<typeof statePalette>,
  portIntensity: Record<string, number>,
  synthesisMode: boolean,
) {
  const portRadius = 42 * scale;

  for (const nodeId of FACILITY_CONDUIT_NODES) {
    const angleDeg = BRAIN_PORT_DEGREES[nodeId] ?? -90;
    const angle = (angleDeg * Math.PI) / 180;
    const intensity = portIntensity[nodeId] ?? 0.15;
    const px = cx + Math.cos(angle) * portRadius;
    const py = cy + Math.sin(angle) * portRadius;
    const pulse = 0.55 + Math.sin(tick * 2.2 + angle) * 0.45;
    const glow = synthesisMode
      ? Math.max(intensity, 0.75) * pulse
      : intensity * pulse;

    const outerGrad = ctx.createRadialGradient(px, py, 0, px, py, 8 * scale);
    outerGrad.addColorStop(0, `rgba(${palette.cyan}, ${glow * 0.35})`);
    outerGrad.addColorStop(0.5, `rgba(${palette.synapse}, ${glow * 0.12})`);
    outerGrad.addColorStop(1, "rgba(5, 7, 10, 0)");
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.arc(px, py, 8 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, 1.8 + glow * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${palette.cyan}, ${0.4 + glow * 0.55})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, 3.5 + glow * 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${palette.gold}, ${0.15 + glow * 0.35})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function drawNeuralNetwork(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  tick: number,
  nodes: NeuralNode[],
  links: SynapseLink[],
  thoughtPulses: ThoughtPulse[],
  synapticDots: SynapticDot[],
  palette: ReturnType<typeof statePalette>,
  synapseSpeed: number,
  synthesisMode: boolean,
) {
  for (const link of links) {
    const a = nodes[link.a];
    const b = nodes[link.b];
    if (!a || !b) continue;

    const ax = cx + a.x * scale;
    const ay = cy + a.y * scale * (1 - a.z * 0.008);
    const bx = cx + b.x * scale;
    const by = cy + b.y * scale * (1 - b.z * 0.008);
    const actBoost = (a.activation + b.activation) * 0.5;
    const alpha = link.strength * (0.12 + actBoost * 0.35) * (synthesisMode ? 1.4 : 1);

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    const mx = (ax + bx) / 2 + Math.sin(tick * synapseSpeed + link.a) * 2 * scale;
    const my = (by + ay) / 2 + Math.cos(tick * synapseSpeed + link.b) * 2 * scale;
    ctx.quadraticCurveTo(mx, my, bx, by);
    ctx.strokeStyle = `rgba(${palette.synapse}, ${alpha})`;
    ctx.lineWidth = 0.35 + actBoost * 0.5;
    ctx.stroke();
  }

  for (const dot of synapticDots) {
    const link = links[dot.linkIdx];
    if (!link) continue;
    const a = nodes[link.a];
    const b = nodes[link.b];
    if (!a || !b) continue;

    const ax = a.x * scale;
    const ay = a.y * scale;
    const bx = b.x * scale;
    const by = b.y * scale;
    const t = dot.progress;
    const px = cx + ax + (bx - ax) * t;
    const py = cy + ay + (by - ay) * t;

    ctx.beginPath();
    ctx.arc(px, py, 0.8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${palette.cyan}, ${0.5 + link.strength * 0.4})`;
    ctx.fill();
  }

  for (const pulse of thoughtPulses) {
    const a = nodes[pulse.from];
    const b = nodes[pulse.to];
    if (!a || !b) continue;

    const ax = a.x * scale;
    const ay = a.y * scale;
    const bx = b.x * scale;
    const by = b.y * scale;
    const t = pulse.progress;
    const px = cx + ax + (bx - ax) * t;
    const py = cy + ay + (by - ay) * t;

    const flashGrad = ctx.createRadialGradient(px, py, 0, px, py, 6 * scale);
    flashGrad.addColorStop(0, `rgba(${palette.gold}, ${pulse.alpha * 0.8})`);
    flashGrad.addColorStop(0.4, `rgba(${palette.cyan}, ${pulse.alpha * 0.4})`);
    flashGrad.addColorStop(1, "rgba(5, 7, 10, 0)");
    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.arc(px, py, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const node of nodes) {
    node.x += Math.sin(tick * node.drift + node.phase) * 0.025 * synapseSpeed;
    node.y += Math.cos(tick * node.drift * 0.85 + node.phase) * 0.025 * synapseSpeed;
    node.activation *= node.activationDecay;

    const depthScale = 1 - node.z * 0.012;
    const nx = cx + node.x * scale;
    const ny = cy + node.y * scale * depthScale;
    const nodePulse = 0.45 + Math.sin(tick * 1.6 + node.phase) * 0.35;
    const act = node.activation * nodePulse;

    const nodeGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, node.radius * 2.5 * scale);
    nodeGrad.addColorStop(0, `rgba(${palette.cyan}, ${0.25 + act * 0.5})`);
    nodeGrad.addColorStop(0.5, `rgba(${palette.synapse}, ${0.08 + act * 0.2})`);
    nodeGrad.addColorStop(1, "rgba(5, 7, 10, 0)");
    ctx.fillStyle = nodeGrad;
    ctx.beginPath();
    ctx.arc(nx, ny, node.radius * 2 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(nx, ny, node.radius * 0.6 + act * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${palette.particle}, ${0.55 + act * 0.45})`;
    ctx.fill();
  }
}

function drawCentralNucleus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  tick: number,
  palette: ReturnType<typeof statePalette>,
  synthesisMode: boolean,
  absorbBoost: boolean,
) {
  const breathe = 1 + Math.sin(tick * 0.65) * 0.04;

  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14 * scale * breathe);
  coreGrad.addColorStop(0, `rgba(${palette.core}, ${synthesisMode ? 0.85 : 0.75})`);
  coreGrad.addColorStop(0.35, `rgba(${palette.synapse}, ${absorbBoost ? 0.22 : 0.12})`);
  coreGrad.addColorStop(0.65, `rgba(${palette.gold}, ${synthesisMode ? 0.12 : 0.05})`);
  coreGrad.addColorStop(1, "rgba(5, 7, 10, 0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 14 * scale * breathe, 0, Math.PI * 2);
  ctx.fill();

  const nucleusGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 5 * scale);
  nucleusGrad.addColorStop(0, `rgba(${palette.cyan}, ${0.35 + (synthesisMode ? 0.25 : 0)})`);
  nucleusGrad.addColorStop(0.6, `rgba(${palette.synapse}, 0.15)`);
  nucleusGrad.addColorStop(1, "rgba(5, 7, 10, 0)");
  ctx.fillStyle = nucleusGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 5 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 1.5 + Math.sin(tick * 1.8) * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${palette.cyan}, ${0.45 + Math.sin(tick * 1.5) * 0.15})`;
  ctx.fill();

  const filaments = synthesisMode ? 32 : 20;
  for (let i = 0; i < filaments; i++) {
    const angle = (i / filaments) * Math.PI * 2 + tick * 0.05;
    const len = (10 + Math.sin(tick * 0.85 + i) * 3) * scale;
    const ex = cx + Math.cos(angle) * len;
    const ey = cy + Math.sin(angle) * len;
    const alpha = 0.08 + Math.sin(tick + i) * 0.06;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = `rgba(${palette.synapse}, ${alpha * (synthesisMode ? 1.8 : 1)})`;
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
}

export const NeuralNexus = memo(function NeuralNexus({
  state,
  labs,
  knowledgeFlow,
  surge = false,
  pulse = "none",
  networkSurge = "none",
  activeExecutions = 0,
}: NeuralNexusProps) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NeuralNode[]>([]);
  const linksRef = useRef<SynapseLink[]>([]);
  const particlesRef = useRef<NexusParticle[]>([]);
  const fogRef = useRef<FogBlob[]>([]);
  const fragmentsRef = useRef<DataFragment[]>([]);
  const thoughtPulsesRef = useRef<ThoughtPulse[]>([]);
  const synapticDotsRef = useRef<SynapticDot[]>([]);
  const config = STATE_CONFIG[state];
  const palette = statePalette(state);
  const synthesisMode =
    state === "synthesizing" ||
    pulse === "final-report" ||
    networkSurge === "final-report";
  const pulseAgentId = knowledgeFlow?.agentId ?? null;
  const portIntensity = useMemo(
    () => derivePortIntensity(labs, pulse, pulseAgentId),
    [labs, pulse, pulseAgentId],
  );
  const activityLevel = useMemo(
    () => deriveBrainActivityLevel(labs, activeExecutions),
    [labs, activeExecutions],
  );
  const absorbBoost =
    knowledgeFlow?.phase === "nexus-absorb" ||
    knowledgeFlow?.phase === "nexus-to-ceo";

  useEffect(() => {
    nodesRef.current = seedNeuralNodes(config.clusterCount + 4);
    linksRef.current = buildSynapseLinks(nodesRef.current, config.connectionDist);
    particlesRef.current = seedParticles(
      nodesRef.current,
      config.particleCount,
    );
    fogRef.current = seedFog(10);
    synapticDotsRef.current = linksRef.current.slice(0, 18).map((_, i) => ({
      linkIdx: i % linksRef.current.length,
      progress: Math.random(),
      speed: 0.004 + Math.random() * 0.008,
    }));
  }, [config.clusterCount, config.connectionDist, config.particleCount]);

  useEffect(() => {
    const canvases = [bgRef.current, midRef.current, fgRef.current].filter(
      Boolean,
    ) as HTMLCanvasElement[];
    if (canvases.length === 0) return;

    let raf = 0;
    let tick = 0;

    const setupCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      return { w: rect.width, h: rect.height };
    };

    const draw = () => {
      const bg = bgRef.current;
      const mid = midRef.current;
      const fg = fgRef.current;
      const bgCtx = bg?.getContext("2d");
      const midCtx = mid?.getContext("2d");
      const fgCtx = fg?.getContext("2d");
      if (!bg || !mid || !fg || !bgCtx || !midCtx || !fgCtx) return;

      const { w, h } = setupCanvas(bg, bgCtx);
      setupCanvas(mid, midCtx);
      setupCanvas(fg, fgCtx);

      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) / 100;
      tick += 0.016;

      const activityBoost = 0.65 + activityLevel * 0.55;
      const fogSpeed = config.fogSpeed * (surge ? 1.5 : 1) * activityBoost;
      const synapseSpeed =
        config.synapseSpeed * (absorbBoost ? 1.7 : 1) * (synthesisMode ? 1.6 : activityBoost);
      const particleSpeed =
        config.particleSpeed * (surge ? 1.4 : 1) * (synthesisMode ? 1.5 : activityBoost);

      bgCtx.clearRect(0, 0, w, h);

      for (const blob of fogRef.current) {
        blob.x += blob.vx * fogSpeed;
        blob.y += blob.vy * fogSpeed;
        if (Math.hypot(blob.x, blob.y) > 48) {
          blob.vx *= -1;
          blob.vy *= -1;
        }
        const breathe = 1 + Math.sin(tick * 0.35 + blob.x) * 0.1;
        const grad = bgCtx.createRadialGradient(
          cx + blob.x * scale,
          cy + blob.y * scale,
          0,
          cx + blob.x * scale,
          cy + blob.y * scale,
          blob.radius * scale * breathe,
        );
        grad.addColorStop(0, `rgba(${palette.fog}, ${blob.alpha * 0.65})`);
        grad.addColorStop(1, "rgba(5, 7, 10, 0)");
        bgCtx.fillStyle = grad;
        bgCtx.beginPath();
        bgCtx.arc(
          cx + blob.x * scale,
          cy + blob.y * scale,
          blob.radius * scale * breathe,
          0,
          Math.PI * 2,
        );
        bgCtx.fill();
      }

      drawContainmentRings(
        bgCtx,
        cx,
        cy,
        scale,
        tick,
        palette,
        synthesisMode,
        activityLevel,
      );

      midCtx.clearRect(0, 0, w, h);

      drawKnowledgeOrbits(
        midCtx,
        cx,
        cy,
        scale,
        tick,
        palette,
        synthesisMode,
        activityLevel,
      );

      const nodes = nodesRef.current;
      const links = linksRef.current;

      if (
        Math.random() <
        config.thoughtRate * (synthesisMode ? 2.5 : 1) * (0.5 + activityLevel)
      ) {
        const from = Math.floor(Math.random() * nodes.length);
        let to = Math.floor(Math.random() * nodes.length);
        if (to === from) to = (to + 1) % nodes.length;
        thoughtPulsesRef.current.push({
          from,
          to,
          progress: 0,
          speed: 0.015 + Math.random() * 0.025,
          alpha: 0.7 + Math.random() * 0.3,
        });
        if (nodes[from]) nodes[from].activation = 1;
        if (nodes[to]) nodes[to].activation = Math.max(nodes[to]?.activation ?? 0, 0.6);
      }

      thoughtPulsesRef.current = thoughtPulsesRef.current.filter((p) => {
        p.progress += p.speed * synapseSpeed;
        return p.progress < 1;
      });
      if (thoughtPulsesRef.current.length > 12) {
        thoughtPulsesRef.current = thoughtPulsesRef.current.slice(-12);
      }

      if (Math.random() < 0.008 * activityLevel && links.length > 0) {
        const linkIdx = Math.floor(Math.random() * links.length);
        const link = links[linkIdx];
        if (link && nodes[link.a]) nodes[link.a].activation = 0.85;
        if (link && nodes[link.b]) nodes[link.b].activation = 0.65;
      }

      for (const dot of synapticDotsRef.current) {
        dot.progress += dot.speed * synapseSpeed;
        if (dot.progress > 1) dot.progress = 0;
      }

      drawNeuralNetwork(
        midCtx,
        cx,
        cy,
        scale,
        tick,
        nodes,
        links,
        thoughtPulsesRef.current,
        synapticDotsRef.current,
        palette,
        synapseSpeed,
        synthesisMode,
      );

      drawCentralNucleus(
        midCtx,
        cx,
        cy,
        scale,
        tick,
        palette,
        synthesisMode,
        absorbBoost,
      );

      if (!FACILITY_SILENT_CORE) {
        drawIntakePorts(
          midCtx,
          cx,
          cy,
          scale,
          tick,
          palette,
          portIntensity,
          synthesisMode,
        );
      }

      fgCtx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;

      for (const p of particles) {
        const node = nodes[p.node];
        if (!node) continue;
        const dx = node.x - p.x;
        const dy = node.y - p.y;
        p.vx += dx * 0.005 + Math.sin(tick + p.phase) * 0.004;
        p.vy += dy * 0.005 + Math.cos(tick * 0.7 + p.phase) * 0.004;
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.x += p.vx * particleSpeed;
        p.y += p.vy * particleSpeed;

        const flicker = 0.35 + Math.sin(tick * 3.5 + p.phase) * 0.45;
        fgCtx.beginPath();
        fgCtx.arc(
          cx + p.x * scale,
          cy + p.y * scale,
          p.size * 0.45,
          0,
          Math.PI * 2,
        );
        fgCtx.fillStyle = `rgba(${palette.particle}, ${flicker * 0.85})`;
        fgCtx.fill();
      }

      if (Math.random() < config.fragmentRate * (absorbBoost ? 2.5 : 1)) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 28;
        fragmentsRef.current.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.15 - Math.random() * 0.35,
          life: 1,
          char: FRAGMENT_CHARS[Math.floor(Math.random() * FRAGMENT_CHARS.length)],
        });
      }

      fragmentsRef.current = fragmentsRef.current.filter((f) => {
        f.x += f.vx * particleSpeed;
        f.y += f.vy * particleSpeed;
        f.life -= 0.01;
        if (f.life <= 0) return false;

        fgCtx.font = `bold ${4 + f.life * 3.5}px monospace`;
        fgCtx.textAlign = "center";
        fgCtx.fillStyle = `rgba(${palette.cyan}, ${f.life * 0.65})`;
        fgCtx.fillText(f.char, cx + f.x * scale, cy + f.y * scale);
        return true;
      });

      if (fragmentsRef.current.length > 20) {
        fragmentsRef.current = fragmentsRef.current.slice(-20);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [
    config,
    state,
    surge,
    absorbBoost,
    palette,
    synthesisMode,
    activityLevel,
    portIntensity,
  ]);

  return (
    <div
      className={cn(
        "facility-neural-nexus facility-neural-nexus-v6 facility-neural-nexus-v4",
        `facility-neural-nexus-${state}`,
        absorbBoost && "facility-neural-nexus-absorbing",
        surge && "facility-neural-nexus-surge",
        synthesisMode && "facility-neural-nexus-synthesis",
      )}
      aria-hidden
    >
      <div className="facility-nexus-depth-ring facility-nexus-depth-outer" />
      <div className="facility-nexus-depth-ring facility-nexus-depth-energy" />
      <div className="facility-nexus-depth-ring facility-nexus-depth-knowledge" />

      <canvas ref={bgRef} className="facility-nexus-layer facility-nexus-bg" />
      <canvas ref={midRef} className="facility-nexus-layer facility-nexus-mid" />
      <canvas ref={fgRef} className="facility-nexus-layer facility-nexus-fg" />

      <div
        className="facility-nexus-intake-glow"
        style={{ opacity: 0.06 + activityLevel * 0.14 }}
      />

      {knowledgeFlow && knowledgeFlow.phase !== "complete" && (
        <div className="facility-nexus-flow-absorb" aria-hidden />
      )}

      {synthesisMode && (
        <div className="facility-nexus-synthesis-wave" aria-hidden />
      )}
    </div>
  );
});
