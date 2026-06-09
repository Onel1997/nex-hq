"use client";

import { memo } from "react";

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 17 + 7) % 100}%`,
  top: `${(i * 23 + 11) % 100}%`,
  delay: `${(i * 0.7) % 8}s`,
  duration: `${6 + (i % 5) * 2}s`,
  size: i % 3 === 0 ? 2 : 1,
}));

const SPARKS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: `${12 + i * 9}%`,
  top: `${18 + (i % 5) * 16}%`,
  delay: `${i * 1.4}s`,
}));

const ARCS = Array.from({ length: 4 }, (_, i) => ({
  id: i,
  left: `${25 + i * 18}%`,
  top: `${35 + (i % 2) * 25}%`,
  delay: `${i * 2.5 + 1}s`,
  rotate: i * 45,
}));

export const AmbienceField = memo(function AmbienceField() {
  return (
    <div className="facility-ambience" aria-hidden>
      <div className="facility-ambience-energy-cloud facility-ambience-cloud-a" />
      <div className="facility-ambience-energy-cloud facility-ambience-cloud-b" />
      <div className="facility-ambience-neural-fog" />
      <div className="facility-ambience-neural-fog facility-ambience-neural-fog-b" />
      <div className="facility-ambience-energy-current" />
      <div className="facility-ambience-facility-light facility-ambience-light-top" />
      <div className="facility-ambience-facility-light facility-ambience-light-center" />
      <div className="facility-ambience-scanlines" />
      <div className="facility-ambience-dust">
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="facility-ambience-particle"
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
