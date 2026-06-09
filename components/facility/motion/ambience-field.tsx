"use client";

import { cn } from "@/lib/utils";
import { memo } from "react";

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${(i * 23 + 13) % 100}%`,
  top: `${(i * 31 + 7) % 100}%`,
  delay: `${(i * 1.1) % 16}s`,
  duration: `${16 + (i % 4) * 5}s`,
  size: i % 4 === 0 ? 1.5 : 1,
}));

const DATA_STREAMS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  left: `${14 + i * 14}%`,
  delay: `${i * 3.2}s`,
  duration: `${22 + (i % 3) * 8}s`,
  height: `${10 + (i % 2) * 6}%`,
}));

const DISTANT_FLICKERS = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  left: `${10 + i * 18}%`,
  top: `${14 + (i % 3) * 28}%`,
  delay: `${i * 4.5 + 2}s`,
  duration: `${12 + (i % 2) * 5}s`,
}));

export const AmbienceField = memo(function AmbienceField() {
  return (
    <div className="facility-ambience" aria-hidden>
      <div className="facility-ambience-data-streams">
        {DATA_STREAMS.map((stream) => (
          <span
            key={stream.id}
            className="facility-ambience-data-stream"
            style={{
              left: stream.left,
              height: stream.height,
              animationDelay: stream.delay,
              animationDuration: stream.duration,
            }}
          />
        ))}
      </div>

      <div className="facility-ambience-particles">
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className={cn("facility-ambience-particle")}
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

      <div className="facility-ambience-distant-flickers">
        {DISTANT_FLICKERS.map((f) => (
          <span
            key={f.id}
            className="facility-ambience-holo-flicker"
            style={{
              left: f.left,
              top: f.top,
              animationDelay: f.delay,
              animationDuration: f.duration,
            }}
          />
        ))}
      </div>
    </div>
  );
});
