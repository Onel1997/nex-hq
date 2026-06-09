"use client";

import { useEffect, useRef, useState } from "react";
import {
  createCeoDecision,
  matchCeoDecision,
} from "@/lib/facility/ceo-decisions";
import {
  advanceKnowledgeFlowPhase,
  createKnowledgeFlow,
  matchKnowledgeFlow,
  phaseDuration,
} from "@/lib/facility/knowledge-flow";
import {
  createTransmission,
  matchTransmission,
} from "@/lib/facility/transmissions";
import type {
  BrainPulseKind,
  CeoDecision,
  FacilityEvent,
  KnowledgeFlowSequence,
  NetworkSurgeMode,
  PulseIntensity,
  TransmissionEvent,
} from "@/lib/facility/types";

const PULSE_DURATIONS: Record<Exclude<BrainPulseKind, "none">, number> = {
  "task-started": 700,
  "task-complete": 800,
  "report-approved": 1200,
  "report-rejected": 900,
  "final-report": 2800,
  delegation: 2000,
};

interface EventReaction {
  pulse: Exclude<BrainPulseKind, "none"> | null;
  intensity: PulseIntensity;
  networkOnly?: boolean;
  networkFlash?: boolean;
  verdictPulse?: boolean;
  surgeMode?: NetworkSurgeMode;
}

function eventToReaction(type: string): EventReaction {
  switch (type) {
    case "task.execution.started":
      return { pulse: "task-started", intensity: "small", networkOnly: true };
    case "task.completed":
    case "task.execution.completed":
      return { pulse: "task-complete", intensity: "small" };
    case "report.approved":
      return {
        pulse: "report-approved",
        intensity: "medium",
        networkFlash: true,
        surgeMode: "approval",
      };
    case "report.rejected":
    case "report.revision_requested":
      return { pulse: "report-rejected", intensity: "small" };
    case "ceo.final_report.generated":
    case "ceo.final_report.completed":
      return {
        pulse: "final-report",
        intensity: "large",
        networkFlash: true,
        verdictPulse: true,
        surgeMode: "final-report",
      };
    case "task.created":
    case "task.assigned":
      return {
        pulse: "delegation",
        intensity: "medium",
        networkFlash: true,
        surgeMode: "delegation",
      };
    default:
      return { pulse: null, intensity: "small" };
  }
}

export interface FacilityReactions {
  brainPulse: BrainPulseKind;
  pulseIntensity: PulseIntensity;
  networkPulse: boolean;
  networkSurge: NetworkSurgeMode;
  activeTransmission: TransmissionEvent | null;
  activeKnowledgeFlow: KnowledgeFlowSequence | null;
  ceoDecisions: CeoDecision[];
  verdictPulse: boolean;
}

/** Detect new Brain events and trigger visual feedback without excessive rerenders. */
export function useFacilityReactions(
  events: FacilityEvent[],
  externalPulse: BrainPulseKind = "none",
): FacilityReactions {
  const seenIdsRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transmissionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const verdictTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knowledgeFlowTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [brainPulse, setBrainPulse] = useState<BrainPulseKind>("none");
  const [pulseIntensity, setPulseIntensity] = useState<PulseIntensity>("medium");
  const [networkPulse, setNetworkPulse] = useState(false);
  const [networkSurge, setNetworkSurge] = useState<NetworkSurgeMode>("none");
  const [verdictPulse, setVerdictPulse] = useState(false);
  const [activeTransmission, setActiveTransmission] =
    useState<TransmissionEvent | null>(null);
  const [activeKnowledgeFlow, setActiveKnowledgeFlow] =
    useState<KnowledgeFlowSequence | null>(null);
  const [ceoDecisions, setCeoDecisions] = useState<CeoDecision[]>([]);

  const scheduleKnowledgeFlow = (flow: KnowledgeFlowSequence) => {
    for (const t of knowledgeFlowTimeoutsRef.current) clearTimeout(t);
    knowledgeFlowTimeoutsRef.current = [];

    setActiveKnowledgeFlow(flow);

    const schedulePhase = (current: KnowledgeFlowSequence) => {
      const duration = phaseDuration(current.phase);
      if (duration <= 0) {
        setActiveKnowledgeFlow(null);
        return;
      }

      const timeout = setTimeout(() => {
        const nextPhase = advanceKnowledgeFlowPhase(current);
        if (nextPhase === "complete") {
          setActiveKnowledgeFlow(null);
          return;
        }
        const next = { ...current, phase: nextPhase };
        setActiveKnowledgeFlow(next);
        schedulePhase(next);
      }, duration);

      knowledgeFlowTimeoutsRef.current.push(timeout);
    };

    schedulePhase(flow);
  };

  useEffect(() => {
    const seen = seenIdsRef.current;
    const isInitial = seen.size === 0;

    for (const event of events) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      if (isInitial) continue;

      const reaction = eventToReaction(event.type);
      const ceoMatch = matchCeoDecision(event);

      if (ceoMatch) {
        const decision = createCeoDecision(ceoMatch);
        setCeoDecisions((prev) => [decision, ...prev].slice(0, 5));
        setTimeout(() => {
          setCeoDecisions((prev) => prev.filter((d) => d.id !== decision.id));
        }, 4500);
      }

      if (!reaction.pulse && !reaction.networkOnly && !ceoMatch) continue;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (reaction.pulse) {
        setBrainPulse(reaction.pulse);
        setPulseIntensity(reaction.intensity);
      }
      if (reaction.networkOnly || reaction.networkFlash) {
        setNetworkPulse(true);
      }
      if (reaction.surgeMode) {
        setNetworkSurge(reaction.surgeMode);
        if (surgeTimeoutRef.current) clearTimeout(surgeTimeoutRef.current);
        surgeTimeoutRef.current = setTimeout(() => {
          setNetworkSurge("none");
        }, reaction.surgeMode === "final-report" ? 2800 : 1600);
      }
      if (reaction.verdictPulse) {
        setVerdictPulse(true);
        if (verdictTimeoutRef.current) clearTimeout(verdictTimeoutRef.current);
        verdictTimeoutRef.current = setTimeout(() => {
          setVerdictPulse(false);
        }, 2400);
      }

      const transmissionMatch = matchTransmission(event.type, event.actorId);
      if (transmissionMatch) {
        const tx = createTransmission(transmissionMatch);
        setActiveTransmission(tx);
        if (transmissionTimeoutRef.current) {
          clearTimeout(transmissionTimeoutRef.current);
        }
        transmissionTimeoutRef.current = setTimeout(() => {
          setActiveTransmission(null);
        }, 2200);
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
      if (transmissionTimeoutRef.current) {
        clearTimeout(transmissionTimeoutRef.current);
      }
      if (verdictTimeoutRef.current) clearTimeout(verdictTimeoutRef.current);
      if (surgeTimeoutRef.current) clearTimeout(surgeTimeoutRef.current);
      for (const t of knowledgeFlowTimeoutsRef.current) clearTimeout(t);
    };
  }, []);

  const activePulse =
    externalPulse !== "none" ? externalPulse : brainPulse;

  const activeIntensity: PulseIntensity =
    externalPulse === "final-report"
      ? "large"
      : externalPulse === "delegation" || externalPulse === "report-approved"
        ? "medium"
        : pulseIntensity;

  const activeNetwork =
    networkPulse ||
    externalPulse === "delegation" ||
    externalPulse === "report-approved" ||
    externalPulse === "final-report";

  const activeSurge: NetworkSurgeMode =
    externalPulse === "final-report"
      ? "final-report"
      : externalPulse === "delegation"
        ? "delegation"
        : networkSurge;

  const activeVerdictPulse =
    verdictPulse || externalPulse === "final-report";

  return {
    brainPulse: activePulse,
    pulseIntensity: activeIntensity,
    networkPulse: activeNetwork,
    networkSurge: activeSurge,
    activeTransmission,
    activeKnowledgeFlow,
    ceoDecisions,
    verdictPulse: activeVerdictPulse,
  };
}
