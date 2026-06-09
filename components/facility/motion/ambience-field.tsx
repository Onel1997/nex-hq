"use client";

import { memo } from "react";

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${(i * 29 + 17) % 97 + 1}%`,
  top: `${(i * 37 + 9) % 95 + 2}%`,
  delay: `${(i * 1.4) % 24}s`,
  duration: `${32 + (i % 4) * 8}s`,
  size: i % 6 === 0 ? 1.1 : 0.8,
}));

export const AmbienceField = memo(function AmbienceField() {
  return (
    <div className="facility-ambience" aria-hidden>
      <div className="facility-ambience-particles">
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
    </div>
  );
});
