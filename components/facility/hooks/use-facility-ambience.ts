"use client";

import { useEffect, useState } from "react";
import type { AgentId } from "@/lib/constants/agents";

export interface AmbientPulse {
  id: string;
  agentId: AgentId | "brain" | "ceo";
  kind: "stream" | "synapse" | "nexus-breath";
}

/** Periodic environmental activity so the facility never feels static. */
export function useFacilityAmbience(
  activeExecutions: number,
  enabled = true,
): AmbientPulse | null {
  const [pulse, setPulse] = useState<AmbientPulse | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const agents: Array<AgentId | "brain" | "ceo"> = [
      "research",
      "designer",
      "marketing",
      "content",
      "image",
      "shopify",
      "brain",
      "ceo",
    ];
    const kinds: AmbientPulse["kind"][] = [
      "stream",
      "synapse",
      "nexus-breath",
    ];

    const interval = setInterval(
      () => {
        const agent = agents[Math.floor(Math.random() * agents.length)];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const id = `ambient-${Date.now()}`;
        setPulse({ id, agentId: agent, kind });
        setTimeout(() => setPulse(null), 1800);
      },
      activeExecutions > 0 ? 3200 : 4800,
    );

    return () => clearInterval(interval);
  }, [activeExecutions, enabled]);

  return pulse;
}
