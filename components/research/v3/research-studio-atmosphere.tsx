"use client";

import type { CSSProperties } from "react";

export function ResearchStudioAtmosphere() {
  return (
    <div className="rs3-atmosphere" aria-hidden>
      <div className="rs3-atmosphere-gradient rs3-atmosphere-gradient-a" />
      <div className="rs3-atmosphere-gradient rs3-atmosphere-gradient-b" />
      <div className="rs3-atmosphere-gradient rs3-atmosphere-gradient-c" />
      <div className="rs3-atmosphere-glow" />
      <div className="rs3-atmosphere-particles">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className="rs3-particle"
            style={
              {
                "--i": i,
                "--x": `${8 + ((i * 37) % 84)}%`,
                "--y": `${12 + ((i * 23) % 76)}%`,
                "--d": `${14 + (i % 8) * 3}s`,
                "--delay": `${-(i % 12) * 1.1}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="rs3-atmosphere-grid" />
    </div>
  );
}
