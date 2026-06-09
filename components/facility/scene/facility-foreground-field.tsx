"use client";

import { memo, useEffect, useRef } from "react";

interface DataPacket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  life: number;
}

interface ForegroundParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: number;
}

interface NeuralStream {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
  hue: number;
}

function seedParticles(count: number): ForegroundParticle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.0005,
    vy: -0.00025 - Math.random() * 0.00035,
    size: 0.5 + Math.random() * 2,
    alpha: 0.12 + Math.random() * 0.4,
    hue: Math.random() > 0.7 ? 270 : Math.random() > 0.4 ? 200 : 45,
  }));
}

function seedStreams(count: number): NeuralStream[] {
  return Array.from({ length: count }, () => ({
    x: 0.15 + Math.random() * 0.7,
    y: Math.random(),
    speed: 0.0008 + Math.random() * 0.0012,
    length: 0.04 + Math.random() * 0.08,
    alpha: 0.08 + Math.random() * 0.18,
    hue: Math.random() > 0.5 ? 200 : 280,
  }));
}

export const FacilityForegroundField = memo(function FacilityForegroundField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ForegroundParticle[]>(seedParticles(64));
  const streamsRef = useRef<NeuralStream[]>(seedStreams(8));
  const packetsRef = useRef<DataPacket[]>([]);
  const nexusPulseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    let tick = 0;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const w = rect.width;
      const h = rect.height;
      tick += 0.016;

      ctx.clearRect(0, 0, w, h);

      // Nexus volumetric pulse
      nexusPulseRef.current = 0.5 + Math.sin(tick * 0.8) * 0.5;
      const pulse = nexusPulseRef.current;
      const nexusX = w * 0.5;
      const nexusY = h * 0.47;
      const pulseGrad = ctx.createRadialGradient(
        nexusX,
        nexusY,
        0,
        nexusX,
        nexusY,
        w * 0.28,
      );
      pulseGrad.addColorStop(0, `rgba(56, 189, 248, ${0.04 * pulse})`);
      pulseGrad.addColorStop(0.4, `rgba(34, 211, 238, ${0.02 * pulse})`);
      pulseGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = pulseGrad;
      ctx.fillRect(0, 0, w, h);

      // Vertical neural data streams
      for (const stream of streamsRef.current) {
        stream.y += stream.speed;
        if (stream.y > 1.08) {
          stream.y = -stream.length;
          stream.x = 0.12 + Math.random() * 0.76;
        }

        const sx = stream.x * w;
        const sy = stream.y * h;
        const streamGrad = ctx.createLinearGradient(
          sx,
          sy,
          sx,
          sy + stream.length * h,
        );
        streamGrad.addColorStop(0, `hsla(${stream.hue}, 70%, 60%, 0)`);
        streamGrad.addColorStop(0.3, `hsla(${stream.hue}, 65%, 55%, ${stream.alpha})`);
        streamGrad.addColorStop(1, `hsla(${stream.hue}, 70%, 60%, 0)`);
        ctx.strokeStyle = streamGrad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + stream.length * h);
        ctx.stroke();
      }

      // Ambient drift particles
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -0.02) {
          p.y = 1.02;
          p.x = Math.random();
        }
        if (p.x < -0.02 || p.x > 1.02) p.vx *= -1;

        const flicker = p.alpha * (0.55 + Math.sin(tick * 3 + p.x * 20) * 0.45);
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 75%, 62%, ${flicker * 0.4})`;
        ctx.fill();
      }

      // Horizontal data packets
      if (Math.random() < 0.012) {
        const fromLeft = Math.random() > 0.5;
        packetsRef.current.push({
          x: fromLeft ? -0.05 : 1.05,
          y: 0.12 + Math.random() * 0.76,
          vx: fromLeft ? 0.0025 + Math.random() * 0.0015 : -(0.0025 + Math.random() * 0.0015),
          vy: (Math.random() - 0.5) * 0.0005,
          size: 3 + Math.random() * 5,
          hue: Math.random() > 0.6 ? 200 : Math.random() > 0.3 ? 270 : 45,
          life: 1,
        });
      }

      packetsRef.current = packetsRef.current.filter((pk) => {
        pk.x += pk.vx;
        pk.y += pk.vy;
        pk.life -= 0.0028;
        if (pk.life <= 0 || pk.x < -0.1 || pk.x > 1.1) return false;

        const px = pk.x * w;
        const py = pk.y * h;
        const trail = pk.vx > 0 ? -22 : 22;

        const grad = ctx.createLinearGradient(px, py, px + trail, py);
        grad.addColorStop(0, `hsla(${pk.hue}, 80%, 70%, 0)`);
        grad.addColorStop(0.55, `hsla(${pk.hue}, 70%, 55%, ${pk.life * 0.3})`);
        grad.addColorStop(1, `hsla(${pk.hue}, 75%, 60%, ${pk.life * 0.5})`);

        ctx.beginPath();
        ctx.moveTo(px + trail, py);
        ctx.lineTo(px, py);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = `hsla(${pk.hue}, 75%, 58%, ${pk.life * 0.45})`;
        ctx.fillRect(px - pk.size * 0.5, py - pk.size * 0.35, pk.size, pk.size * 0.7);

        return true;
      });

      if (packetsRef.current.length > 16) {
        packetsRef.current = packetsRef.current.slice(-16);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="facility-foreground-field"
      aria-hidden
    />
  );
});
