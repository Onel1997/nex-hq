"use client";

import { useEffect, useState } from "react";

export type StartupPhase =
  | "boot"
  | "brain"
  | "silent-core"
  | "labs"
  | "ceo"
  | "telemetry"
  | "complete";

const PHASE_ORDER: StartupPhase[] = [
  "boot",
  "brain",
  "silent-core",
  "labs",
  "ceo",
  "telemetry",
  "complete",
];

const PHASE_MS: Record<Exclude<StartupPhase, "complete">, number> = {
  boot: 600,
  brain: 900,
  "silent-core": 550,
  labs: 650,
  ceo: 550,
  telemetry: 500,
};

export interface FacilityStartup {
  phase: StartupPhase;
  isComplete: boolean;
  progress: number;
}

/** Staggered command-center boot sequence on first facility load. */
export function useFacilityStartup(ready: boolean): FacilityStartup {
  const [phase, setPhase] = useState<StartupPhase>("boot");

  useEffect(() => {
    if (!ready) return;

    let index = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const advance = () => {
      const next = PHASE_ORDER[index];
      if (!next) return;
      setPhase(next);
      if (next === "complete") return;
      index += 1;
      timeout = setTimeout(advance, PHASE_MS[next]);
    };

    timeout = setTimeout(advance, PHASE_MS.boot);

    return () => clearTimeout(timeout);
  }, [ready]);

  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const progress = Math.round((phaseIndex / (PHASE_ORDER.length - 1)) * 100);

  return {
    phase,
    isComplete: phase === "complete",
    progress,
  };
}

export function phaseAtLeast(
  current: StartupPhase,
  target: StartupPhase,
): boolean {
  return PHASE_ORDER.indexOf(current) >= PHASE_ORDER.indexOf(target);
}
