"use client";

import { memo } from "react";

interface EnergyStreamPulseProps {
  path: string;
  /** Stagger offset so bursts feel organic, not synchronized. */
  phase: number;
  active?: boolean;
  color?: string;
  reverse?: boolean;
}

export const EnergyStreamPulse = memo(function EnergyStreamPulse({
  path,
  phase,
  active = false,
  color = "#38BDF8",
  reverse = false,
}: EnergyStreamPulseProps) {
  const motionKey = reverse ? "1;0" : "0;1";
  const baseDuration = active ? 3.2 : 5.8;
  const pulseDuration = active ? 2.8 : 4.6;
  const burstDelay = 9 + (phase % 5) * 1.4;

  return (
    <g>
      {/* Continuous carrier pulse */}
      <circle r={active ? 2.2 : 1.6} fill={color} opacity={active ? 0.55 : 0.32}>
        <animateMotion
          path={path}
          dur={`${baseDuration}s`}
          repeatCount="indefinite"
          begin={`${phase * 0.35}s`}
          keyPoints={motionKey}
          keyTimes="0;1"
          calcMode="linear"
        />
      </circle>

      {/* Trailing soft wake */}
      <circle r={active ? 4 : 3} fill={color} opacity={0.08}>
        <animateMotion
          path={path}
          dur={`${baseDuration}s`}
          repeatCount="indefinite"
          begin={`${phase * 0.35 + 0.18}s`}
          keyPoints={motionKey}
          keyTimes="0;1"
          calcMode="linear"
        />
      </circle>

      {/* Occasional brighter burst — slow, scheduled, never flashing */}
      <circle r={active ? 3.2 : 2.4} fill="#EAF2FF" opacity={0}>
        <animateMotion
          path={path}
          dur={`${pulseDuration}s`}
          repeatCount="indefinite"
          begin={`${burstDelay}s`}
          keyPoints={motionKey}
          keyTimes="0;1"
          calcMode="linear"
        />
        <animate
          attributeName="opacity"
          values="0;0;0.45;0.12;0"
          keyTimes="0;0.72;0.82;0.92;1"
          dur={`${burstDelay + pulseDuration}s`}
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
});
