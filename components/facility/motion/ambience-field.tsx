"use client";

import { cn } from "@/lib/utils";
import { memo } from "react";

const PARTICLES = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  left: `${(i * 17 + 7) % 100}%`,
  top: `${(i * 23 + 11) % 100}%`,
  delay: `${(i * 0.7) % 8}s`,
  duration: `${5 + (i % 6) * 2}s`,
  size: i % 4 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1,
  hue: i % 5 === 0 ? "gold" : i % 3 === 0 ? "purple" : "cyan",
}));

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + i * 5.5}%`,
  top: `${12 + (i % 7) * 12}%`,
  delay: `${i * 1.1}s`,
}));

const ARCS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  left: `${18 + i * 14}%`,
  top: `${30 + (i % 3) * 22}%`,
  delay: `${i * 2.2 + 0.5}s`,
  rotate: i * 32,
}));

const FILAMENTS = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  left: `${20 + i * 16}%`,
  delay: `${i * 3.5}s`,
  duration: `${14 + i * 3}s`,
}));

const LIGHT_SHAFTS = [
  { id: "a", left: "22%", rotate: -8, opacity: 0.35 },
  { id: "b", left: "50%", rotate: 0, opacity: 0.5 },
  { id: "c", left: "78%", rotate: 8, opacity: 0.3 },
] as const;

export const AmbienceField = memo(function AmbienceField() {
  return (
    <div className="facility-ambience" aria-hidden>
      <div className="facility-ambience-energy-cloud facility-ambience-cloud-a" />
      <div className="facility-ambience-energy-cloud facility-ambience-cloud-b" />
      <div className="facility-ambience-energy-cloud facility-ambience-cloud-c" />
      <div className="facility-ambience-neural-fog" />
      <div className="facility-ambience-neural-fog facility-ambience-neural-fog-b" />
      <div className="facility-ambience-neural-fog facility-ambience-neural-fog-c" />
      <div className="facility-ambience-energy-current" />
      <div className="facility-ambience-energy-current facility-ambience-energy-current-b" />

      <div className="facility-ambience-light-shafts">
        {LIGHT_SHAFTS.map((shaft) => (
          <span
            key={shaft.id}
            className="facility-ambience-light-shaft"
            style={{
              left: shaft.left,
              rotate: `${shaft.rotate}deg`,
              opacity: shaft.opacity,
            }}
          />
        ))}
      </div>

      <div className="facility-ambience-filaments">
        {FILAMENTS.map((f) => (
          <span
            key={f.id}
            className="facility-ambience-filament"
            style={{
              left: f.left,
              animationDelay: f.delay,
              animationDuration: f.duration,
            }}
          />
        ))}
      </div>

      <div className="facility-ambience-facility-light facility-ambience-light-top" />
      <div className="facility-ambience-facility-light facility-ambience-light-center" />
      <div className="facility-ambience-facility-light facility-ambience-light-nexus" />
      <div className="facility-ambience-scanlines" />
      <div className="facility-ambience-dust">
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className={cn(
              "facility-ambience-particle",
              `facility-ambience-particle-${p.hue}`,
            )}
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>
      <div className="facility-ambience-sparks">
        {SPARKS.map((s) => (
          <span
            key={s.id}
            className="facility-ambience-spark"
            style={{ left: s.left, top: s.top, animationDelay: s.delay }}
          />
        ))}
      </div>
      <div className="facility-ambience-arcs">
        {ARCS.map((a) => (
          <span
            key={a.id}
            className="facility-ambience-arc"
            style={{
              left: a.left,
              top: a.top,
              animationDelay: a.delay,
              transform: `rotate(${a.rotate}deg)`,
            }}
          />
        ))}
      </div>
      <div className="facility-ambience-flicker" />
      <div className="facility-ambience-reactor-flicker" />
    </div>
  );
});
