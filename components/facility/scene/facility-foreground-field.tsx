"use client";

import { NEXUS_ENVIRONMENT_ANCHOR } from "@/lib/facility/layout";
import { memo, useEffect, useRef } from "react";

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
    vx: (Math.random() - 0.5) * 0.00018,
    vy: -0.00008 - Math.random() * 0.00012,
    size: 0.35 + Math.random() * 0.9,
    alpha: 0.04 + Math.random() * 0.1,
  }));
}

export const FacilityForegroundField = memo(function FacilityForegroundField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ForegroundParticle[]>(seedParticles(18));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    let tick = 0;
    const nexusXRatio = NEXUS_ENVIRONMENT_ANCHOR.left / 100;
    const nexusYRatio = NEXUS_ENVIRONMENT_ANCHOR.top / 100;

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
      tick += 0.01;

      ctx.clearRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -0.02) {
          p.y = 1.02;
          p.x = Math.random();
        }
        if (p.x < -0.02 || p.x > 1.02) p.vx *= -1;

        const dist = Math.hypot(p.x - nexusXRatio, p.y - nexusYRatio);
        const nearNexus = Math.max(0, 1 - dist * 2.2);
        const flicker =
          p.alpha * (0.55 + Math.sin(tick * 1.2 + p.x * 10) * 0.35) *
          (0.7 + nearNexus * 0.3);
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(40, 120, 160, ${flicker})`;
        ctx.fill();
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
