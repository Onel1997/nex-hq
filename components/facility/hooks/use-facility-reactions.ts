"use client";

import { useEffect, useRef, useState } from "react";
import type { BrainPulseKind, FacilityEvent } from "@/lib/facility/types";

const PULSE_DURATIONS: Record<Exclude<BrainPulseKind, "none">, number> = {
  "task-complete": 800,
  "report-approved": 1200,
  "final-report": 2000,
  delegation: 1600,
};

function eventToPulse(
  type: string,
): { pulse: Exclude<BrainPulseKind, "none"> | null; networkOnly?: boolean } {
  switch (type) {
    case "task.execution.started":
      return { pulse: null, networkOnly: true };
    case "task.completed":
      return { pulse: "task-complete" };
    case "report.approved":
      return { pulse: "report-approved" };
    case "ceo.final_report.generated":
    case "ceo.final_report.completed":
      return { pulse: "final-report" };
    default:
      return { pulse: null };
  }
}

export interface FacilityReactions {
  brainPulse: BrainPulseKind;
  networkPulse: boolean;
}

/** Detect new Brain events and trigger visual feedback without excessive rerenders. */
export function useFacilityReactions(
  events: FacilityEvent[],
  externalPulse: BrainPulseKind = "none",
): FacilityReactions {
  const seenIdsRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [brainPulse, setBrainPulse] = useState<BrainPulseKind>("none");
  const [networkPulse, setNetworkPulse] = useState(false);

  useEffect(() => {
    const seen = seenIdsRef.current;
    const isInitial = seen.size === 0;

    for (const event of events) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      if (isInitial) continue;

      const reaction = eventToPulse(event.type);
      if (!reaction.pulse && !reaction.networkOnly) continue;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (reaction.pulse) {
        setBrainPulse(reaction.pulse);
      }
      if (
        reaction.networkOnly ||
        reaction.pulse === "report-approved" ||
        reaction.pulse === "final-report"
      ) {
        setNetworkPulse(true);
      }

      const duration = reaction.pulse
        ? PULSE_DURATIONS[reaction.pulse]
        : 900;

      timeoutRef.current = setTimeout(() => {
        setBrainPulse("none");
        setNetworkPulse(false);
      }, duration);
    }
  }, [events]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const activePulse =
    externalPulse !== "none" ? externalPulse : brainPulse;
  const activeNetwork =
    networkPulse ||
    externalPulse === "delegation" ||
    externalPulse === "report-approved" ||
    externalPulse === "final-report";

  return {
    brainPulse: activePulse,
    networkPulse: activeNetwork,
  };
}
