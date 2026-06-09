"use client";

import {
  deriveStreamIntensity,
  type BrainNexusState,
} from "@/lib/facility/derive-brain-nexus-state";
import type { FacilityLabId, KnowledgeFlowSequence, LabSnapshot } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { memo, useEffect, useMemo, useRef } from "react";

interface NeuralNexusProps {
  state: BrainNexusState;
  labs: Record<FacilityLabId, LabSnapshot>;
  knowledgeFlow?: KnowledgeFlowSequence | null;
  surge?: boolean;
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
  }
> = {
  idle: {
    fogSpeed: 0.18,
    synapseSpeed: 0.55,
    particleSpeed: 0.38,
    connectionDist: 24,
    clusterCount: 6,
    particleCount: 110,
    fragmentRate: 0.003,
  },
  processing: {
    fogSpeed: 0.28,
    synapseSpeed: 0.9,
    particleSpeed: 0.75,
    connectionDist: 28,
    clusterCount: 6,
    particleCount: 130,
    fragmentRate: 0.006,
  },
  learning: {
    fogSpeed: 0.22,
    synapseSpeed: 1.1,
    particleSpeed: 0.65,
    connectionDist: 32,
    clusterCount: 7,
    particleCount: 150,
    fragmentRate: 0.008,
  },
  decision: {
    fogSpeed: 0.25,
    synapseSpeed: 0.85,
    particleSpeed: 0.7,
    connectionDist: 26,
    clusterCount: 6,
    particleCount: 120,
    fragmentRate: 0.005,
  },
  alert: {
    fogSpeed: 0.35,
    synapseSpeed: 1.2,
    particleSpeed: 1,
    connectionDist: 24,
    clusterCount: 5,
    particleCount: 110,
    fragmentRate: 0.004,
  },
};

interface Cluster {
  x: number;
  y: number;
  radius: number;
  phase: number;
  drift: number;
}

interface NexusParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  cluster: number;
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

function seedClusters(count: number): Cluster[] {
  const offsets = [
    { x: -14, y: -6, r: 16 },
    { x: 12, y: -12, r: 14 },
    { x: -8, y: 14, r: 15 },
    { x: 16, y: 8, r: 12 },
    { x: 0, y: 0, r: 18 },
    { x: -18, y: 4, r: 11 },
    { x: 8, y: -2, r: 13 },
  ];
  return offsets.slice(0, count).map((o, i) => ({
    x: o.x + (Math.random() - 0.5) * 4,
    y: o.y + (Math.random() - 0.5) * 4,
    radius: o.r,
    phase: Math.random() * Math.PI * 2,
    drift: 0.3 + Math.random() * 0.4,
  }));
}

function seedFog(count: number): FogBlob[] {
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 70,
    y: (Math.random() - 0.5) * 70,
    radius: 18 + Math.random() * 28,
    vx: (Math.random() - 0.5) * 0.08,
    vy: (Math.random() - 0.5) * 0.08,
    alpha: 0.04 + Math.random() * 0.06,
  }));
}

function seedParticles(clusters: Cluster[], count: number): NexusParticle[] {
  const particles: NexusParticle[] = [];
  for (let i = 0; i < count; i++) {
    const cluster = Math.floor(Math.random() * clusters.length);
    const c = clusters[cluster];
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * c.radius * 0.85;
    particles.push({
      x: c.x + Math.cos(angle) * dist,
      y: c.y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      size: 0.5 + Math.random() * 1.2,
      cluster,
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
        core: "127, 29, 29",
      };
    case "decision":
      return {
        fog: "255, 209, 102",
        synapse: "56, 189, 248",
        particle: "255, 209, 102",
        core: "30, 41, 59",
      };
    case "learning":
      return {
        fog: "52, 211, 153",
        synapse: "34, 211, 238",
        particle: "110, 231, 183",
        core: "15, 40, 50",
      };
    case "processing":
      return {
        fog: "56, 189, 248",
        synapse: "34, 211, 238",
        particle: "125, 211, 252",
        core: "12, 30, 48",
      };
    default:
      return {
        fog: "56, 189, 248",
        synapse: "100, 116, 139",
        particle: "148, 163, 184",
        core: "10, 22, 38",
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

interface MemoryNode {
  angle: number;
  orbit: number;
  radius: number;
  label: string;
  phase: number;
  drift: number;
}

function seedMemoryNodes(count: number): MemoryNode[] {
  const labels = ["MEM", "CTX", "SIG", "PAT", "REC", "DEC", "IDX", "REF"];
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + Math.random() * 0.4,
    orbit: 22 + Math.random() * 14,
    radius: 3 + Math.random() * 2.5,
    label: labels[i % labels.length],
    phase: Math.random() * Math.PI * 2,
    drift: 0.2 + Math.random() * 0.3,
  }));
}

function drawHolographicRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  tick: number,
  palette: ReturnType<typeof statePalette>,
  absorbBoost: boolean,
) {
  const rings = [32, 26, 20];
  for (let r = 0; r < rings.length; r++) {
    const radius = rings[r] * scale;
    const rotation = tick * (0.15 + r * 0.08) * (r % 2 === 0 ? 1 : -1);
    const segments = 6 + r * 2;
    const alpha = (0.08 + r * 0.04) * (absorbBoost ? 1.5 : 1);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const wobble = Math.sin(tick * 1.2 + i + r) * 2 * scale;
      const px = Math.cos(a) * (radius + wobble);
      const py = Math.sin(a) * (radius + wobble);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(${palette.synapse}, ${alpha})`;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawCortexMesh(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  tick: number,
  palette: ReturnType<typeof statePalette>,
  absorbBoost: boolean,
) {
  const filaments = 24;
  for (let i = 0; i < filaments; i++) {
    const angle = (i / filaments) * Math.PI * 2 + tick * 0.06;
    const len = (14 + Math.sin(tick * 0.9 + i) * 4) * scale;
    const wave = Math.sin(tick * 1.4 + i * 0.5) * 3 * scale;
    const ex = cx + Math.cos(angle) * len + wave;
    const ey = cy + Math.sin(angle) * len + wave * 0.5;
    const alpha = 0.12 + Math.sin(tick + i) * 0.08;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(
      cx + Math.cos(angle + 0.3) * len * 0.5,
      cy + Math.sin(angle + 0.3) * len * 0.5,
      ex,
      ey,
    );
    ctx.strokeStyle = `rgba(${palette.synapse}, ${alpha * (absorbBoost ? 1.6 : 1)})`;
    ctx.lineWidth = 0.45;
    ctx.stroke();
  }

  const cortexGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20 * scale);
  cortexGrad.addColorStop(0, `rgba(${palette.particle}, ${absorbBoost ? 0.18 : 0.1})`);
  cortexGrad.addColorStop(0.35, `rgba(${palette.synapse}, 0.05)`);
  cortexGrad.addColorStop(0.7, `rgba(${palette.core}, 0.02)`);
  cortexGrad.addColorStop(1, "rgba(5, 7, 10, 0)");
  ctx.fillStyle = cortexGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 18 * scale * (1 + Math.sin(tick * 0.7) * 0.05), 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 2.5 + Math.sin(tick * 2) * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(234, 242, 255, ${0.22 + Math.sin(tick * 1.5) * 0.12})`;
  ctx.fill();
}

export const NeuralNexus = memo(function NeuralNexus({
  state,
  labs,
  knowledgeFlow,
  surge = false,
}: NeuralNexusProps) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const clustersRef = useRef<Cluster[]>([]);
  const particlesRef = useRef<NexusParticle[]>([]);
  const fogRef = useRef<FogBlob[]>([]);
  const fragmentsRef = useRef<DataFragment[]>([]);
  const memoryNodesRef = useRef<MemoryNode[]>([]);
  const config = STATE_CONFIG[state];
  const palette = statePalette(state);
  const streamIntensity = useMemo(() => deriveStreamIntensity(labs), [labs]);
  const absorbBoost =
    knowledgeFlow?.phase === "nexus-absorb" ||
    knowledgeFlow?.phase === "nexus-to-ceo";

  useEffect(() => {
    clustersRef.current = seedClusters(config.clusterCount);
    particlesRef.current = seedParticles(
      clustersRef.current,
      config.particleCount,
    );
    fogRef.current = seedFog(8);
    memoryNodesRef.current = seedMemoryNodes(8);
  }, [config.clusterCount, config.particleCount]);

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

      const fogSpeed = config.fogSpeed * (surge ? 1.4 : 1);
      const synapseSpeed = config.synapseSpeed * (absorbBoost ? 1.8 : 1);
      const particleSpeed =
        config.particleSpeed * (surge ? 1.5 : 1) * (absorbBoost ? 1.3 : 1);

      // ── BACKGROUND: volumetric fog + energy clouds ──
      bgCtx.clearRect(0, 0, w, h);
      for (const blob of fogRef.current) {
        blob.x += blob.vx * fogSpeed;
        blob.y += blob.vy * fogSpeed;
        if (Math.hypot(blob.x, blob.y) > 50) {
          blob.vx *= -1;
          blob.vy *= -1;
        }
        const breathe = 1 + Math.sin(tick * 0.4 + blob.x) * 0.12;
        const grad = bgCtx.createRadialGradient(
          cx + blob.x * scale,
          cy + blob.y * scale,
          0,
          cx + blob.x * scale,
          cy + blob.y * scale,
          blob.radius * scale * breathe,
        );
        grad.addColorStop(0, `rgba(${palette.fog}, ${blob.alpha * 0.75})`);
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

      // ── MIDGROUND: organic clusters + synapse web ──
      midCtx.clearRect(0, 0, w, h);
      const clusters = clustersRef.current;
      for (const c of clusters) {
        c.x += Math.sin(tick * c.drift + c.phase) * 0.04 * synapseSpeed;
        c.y += Math.cos(tick * c.drift * 0.8 + c.phase) * 0.04 * synapseSpeed;
      }

      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const a = clusters[i];
          const b = clusters[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 38) {
            const alpha = (1 - dist / 38) * 0.35 * (absorbBoost ? 1.6 : 1);
            const pulse = 0.6 + Math.sin(tick * 2.5 + i + j) * 0.4;
            midCtx.beginPath();
            midCtx.moveTo(cx + a.x * scale, cy + a.y * scale);
            const mx = (a.x + b.x) / 2 + Math.sin(tick + i) * 3;
            const my = (a.y + b.y) / 2 + Math.cos(tick + j) * 3;
            midCtx.quadraticCurveTo(
              cx + mx * scale,
              cy + my * scale,
              cx + b.x * scale,
              cy + b.y * scale,
            );
            midCtx.strokeStyle = `rgba(${palette.synapse}, ${alpha * pulse})`;
            midCtx.lineWidth = 0.6 + (absorbBoost ? 0.4 : 0);
            midCtx.stroke();
          }
        }
      }

      for (const c of clusters) {
        const nodePulse = 0.5 + Math.sin(tick * 1.8 + c.phase) * 0.5;
        const grad = midCtx.createRadialGradient(
          cx + c.x * scale,
          cy + c.y * scale,
          0,
          cx + c.x * scale,
          cy + c.y * scale,
          c.radius * 0.55 * scale,
        );
        grad.addColorStop(0, `rgba(${palette.synapse}, ${0.3 * nodePulse})`);
        grad.addColorStop(0.6, `rgba(${palette.particle}, ${0.08 * nodePulse})`);
        grad.addColorStop(1, "rgba(5, 7, 10, 0)");
        midCtx.fillStyle = grad;
        midCtx.beginPath();
        midCtx.arc(
          cx + c.x * scale,
          cy + c.y * scale,
          c.radius * 0.5 * scale,
          0,
          Math.PI * 2,
        );
        midCtx.fill();

        midCtx.beginPath();
        midCtx.arc(
          cx + c.x * scale,
          cy + c.y * scale,
          1.4 + nodePulse * 0.9,
          0,
          Math.PI * 2,
        );
        midCtx.fillStyle = `rgba(${palette.particle}, ${0.65 + nodePulse * 0.35})`;
        midCtx.fill();
      }

      drawHolographicRings(midCtx, cx, cy, scale, tick, palette, absorbBoost);

      for (const mem of memoryNodesRef.current) {
        mem.angle += mem.drift * 0.008 * synapseSpeed;
        const mx = Math.cos(mem.angle) * mem.orbit;
        const my = Math.sin(mem.angle) * mem.orbit * 0.85;
        const pulse = 0.55 + Math.sin(tick * 2 + mem.phase) * 0.45;

        midCtx.beginPath();
        midCtx.moveTo(cx, cy);
        midCtx.quadraticCurveTo(
          cx + mx * scale * 0.4,
          cy + my * scale * 0.4,
          cx + mx * scale,
          cy + my * scale,
        );
        midCtx.strokeStyle = `rgba(${palette.synapse}, ${0.15 * pulse})`;
        midCtx.lineWidth = 0.4;
        midCtx.stroke();

        const memGrad = midCtx.createRadialGradient(
          cx + mx * scale,
          cy + my * scale,
          0,
          cx + mx * scale,
          cy + my * scale,
          mem.radius * scale * 2,
        );
        memGrad.addColorStop(0, `rgba(${palette.particle}, ${0.5 * pulse})`);
        memGrad.addColorStop(1, "rgba(5, 7, 10, 0)");
        midCtx.fillStyle = memGrad;
        midCtx.beginPath();
        midCtx.arc(cx + mx * scale, cy + my * scale, mem.radius * scale, 0, Math.PI * 2);
        midCtx.fill();

        midCtx.font = `${5 + pulse}px monospace`;
        midCtx.fillStyle = `rgba(234, 242, 255, ${0.35 + pulse * 0.4})`;
        midCtx.textAlign = "center";
        midCtx.fillText(mem.label, cx + mx * scale, cy + my * scale + 1);
      }

      drawCortexMesh(midCtx, cx, cy, scale, tick, palette, absorbBoost);

      // ── FOREGROUND: particles + data fragments ──
      fgCtx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;

      for (const p of particles) {
        const cluster = clusters[p.cluster];
        if (!cluster) continue;
        const dx = cluster.x - p.x;
        const dy = cluster.y - p.y;
        p.vx += dx * 0.004 + Math.sin(tick + p.phase) * 0.003;
        p.vy += dy * 0.004 + Math.cos(tick * 0.7 + p.phase) * 0.003;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x += p.vx * particleSpeed;
        p.y += p.vy * particleSpeed;

        const flicker = 0.4 + Math.sin(tick * 4 + p.phase) * 0.5;
        fgCtx.beginPath();
        fgCtx.arc(
          cx + p.x * scale,
          cy + p.y * scale,
          p.size * 0.5,
          0,
          Math.PI * 2,
        );
        fgCtx.fillStyle = `rgba(${palette.particle}, ${flicker * 0.9})`;
        fgCtx.fill();
      }

      if (Math.random() < config.fragmentRate * (absorbBoost ? 3 : 1)) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 30;
        fragmentsRef.current.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -0.2 - Math.random() * 0.4,
          life: 1,
          char: FRAGMENT_CHARS[Math.floor(Math.random() * FRAGMENT_CHARS.length)],
        });
      }

      fragmentsRef.current = fragmentsRef.current.filter((f) => {
        f.x += f.vx * particleSpeed;
        f.y += f.vy * particleSpeed;
        f.life -= 0.012;
        if (f.life <= 0) return false;

        fgCtx.font = `bold ${5 + f.life * 4}px monospace`;
        fgCtx.textAlign = "center";
        fgCtx.fillStyle = `rgba(${palette.particle}, ${f.life * 0.75})`;
        fgCtx.fillText(f.char, cx + f.x * scale, cy + f.y * scale);
        return true;
      });

      if (fragmentsRef.current.length > 24) {
        fragmentsRef.current = fragmentsRef.current.slice(-24);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [config, state, surge, absorbBoost, palette]);

  const avgIntensity =
    Object.values(streamIntensity).reduce((a, b) => a + b, 0) /
    Object.keys(streamIntensity).length;

  return (
    <div
      className={cn(
        "facility-neural-nexus facility-neural-nexus-v6",
        `facility-neural-nexus-${state}`,
        absorbBoost && "facility-neural-nexus-absorbing",
        surge && "facility-neural-nexus-surge",
      )}
      aria-hidden
    >
      <canvas ref={bgRef} className="facility-nexus-layer facility-nexus-bg" />
      <canvas ref={midRef} className="facility-nexus-layer facility-nexus-mid" />
      <canvas ref={fgRef} className="facility-nexus-layer facility-nexus-fg" />

      <div
        className="facility-nexus-intake-glow"
        style={{ opacity: 0.08 + avgIntensity * 0.18 }}
      />

      {knowledgeFlow && knowledgeFlow.phase !== "complete" && (
        <div className="facility-nexus-flow-absorb" aria-hidden />
      )}
    </div>
  );
});
