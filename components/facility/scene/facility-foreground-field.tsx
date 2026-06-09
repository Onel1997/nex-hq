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
}

function seedParticles(count: number): ForegroundParticle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.0004,
    vy: -0.0002 - Math.random() * 0.0003,
    size: 0.5 + Math.random() * 1.5,
    alpha: 0.15 + Math.random() * 0.35,
  }));
}

export const FacilityForegroundField = memo(function FacilityForegroundField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ForegroundParticle[]>(seedParticles(40));
  const packetsRef = useRef<DataPacket[]>([]);

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

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -0.02) {
          p.y = 1.02;
          p.x = Math.random();
        }
        if (p.x < -0.02 || p.x > 1.02) p.vx *= -1;

        const flicker = p.alpha * (0.6 + Math.sin(tick * 3 + p.x * 20) * 0.4);
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${flicker * 0.35})`;
        ctx.fill();
      }

      if (Math.random() < 0.008) {
        const fromLeft = Math.random() > 0.5;
        packetsRef.current.push({
          x: fromLeft ? -0.05 : 1.05,
          y: 0.15 + Math.random() * 0.7,
          vx: fromLeft ? 0.002 + Math.random() * 0.001 : -(0.002 + Math.random() * 0.001),
          vy: (Math.random() - 0.5) * 0.0004,
          size: 3 + Math.random() * 4,
          hue: Math.random() > 0.5 ? 200 : 45,
          life: 1,
        });
      }

      packetsRef.current = packetsRef.current.filter((pk) => {
        pk.x += pk.vx;
        pk.y += pk.vy;
        pk.life -= 0.003;
        if (pk.life <= 0 || pk.x < -0.1 || pk.x > 1.1) return false;

        const px = pk.x * w;
        const py = pk.y * h;
        const trail = pk.vx > 0 ? -18 : 18;

        const grad = ctx.createLinearGradient(px, py, px + trail, py);
        grad.addColorStop(0, `hsla(${pk.hue}, 80%, 70%, 0)`);
        grad.addColorStop(0.6, `hsla(${pk.hue}, 70%, 55%, ${pk.life * 0.25})`);
        grad.addColorStop(1, `hsla(${pk.hue}, 75%, 60%, ${pk.life * 0.45})`);

        ctx.beginPath();
        ctx.moveTo(px + trail, py);
        ctx.lineTo(px, py);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = `hsla(${pk.hue}, 75%, 58%, ${pk.life * 0.4})`;
        ctx.fillRect(px - pk.size * 0.5, py - pk.size * 0.35, pk.size, pk.size * 0.7);

        return true;
      });

      if (packetsRef.current.length > 12) {
        packetsRef.current = packetsRef.current.slice(-12);
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
