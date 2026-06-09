"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CeoDelegationResult } from "@/agents/ceo/delegation-types";
import { LabInspectorDrawer } from "@/components/facility/inspector/lab-inspector-drawer";
import { useCommandHistory } from "@/components/facility/hooks/use-command-history";
import { useFacilityStream } from "@/components/facility/hooks/use-facility-stream";
import { useLabInspector } from "@/components/facility/hooks/use-lab-inspector";
import { FacilityShell } from "@/components/facility/facility-shell";
import type { DelegationStatus } from "@/components/facility/hud/command-dock";
import type { AgentId } from "@/lib/constants/agents";
import type { BrainPulseKind } from "@/lib/facility/types";

export function FacilityPage() {
  const { data, loading, error, connected, refresh } = useFacilityStream();
  const { history, addEntry } = useCommandHistory();
  const [selectedLabId, setSelectedLabId] = useState<AgentId | null>(null);
  const [highlightedLabs, setHighlightedLabs] = useState<AgentId[]>([]);
  const [delegationStatus, setDelegationStatus] =
    useState<DelegationStatus>("idle");
  const [delegationMessage, setDelegationMessage] = useState<string>();
  const [delegationPulse, setDelegationPulse] =
    useState<BrainPulseKind>("none");

  const {
    data: inspectorData,
    loading: inspectorLoading,
    error: inspectorError,
    refresh: refreshInspector,
  } = useLabInspector(selectedLabId);

  useEffect(() => {
    if (!selectedLabId || !data) return;
    void refreshInspector(selectedLabId);
  }, [data?.refreshedAt, selectedLabId, refreshInspector, data]);

  const handleLabSelect = useCallback((agentId: AgentId) => {
    setSelectedLabId(agentId);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedLabId(null);
  }, []);

  const handleDelegate = useCallback(
    async (goal: string) => {
      setDelegationStatus("submitting");
      setDelegationMessage("Deploying agents…");
      setDelegationPulse("delegation");
      setHighlightedLabs([]);

      try {
        const response = await fetch("/api/ceo/delegate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal }),
        });

        const body = (await response.json()) as CeoDelegationResult & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error ?? "Delegation failed");
        }

        addEntry(goal, body.parentTaskId);
        const labs = body.tasks
          .map((task) => task.assigneeAgentId)
          .filter((id): id is AgentId => Boolean(id));
        setHighlightedLabs([...new Set(labs)]);

        setDelegationStatus("success");
        setDelegationMessage(
          `Deployed ${body.tasks.length} tasks · ${body.executions.filter((e) => e.outcome === "executed").length} executing`,
        );

        await refresh();
        if (selectedLabId) {
          await refreshInspector(selectedLabId);
        }

        setTimeout(() => {
          setDelegationPulse("none");
          setHighlightedLabs([]);
        }, 2000);

        setTimeout(() => {
          setDelegationStatus("idle");
          setDelegationMessage(undefined);
        }, 5000);
      } catch (err) {
        setDelegationStatus("error");
        setDelegationMessage(
          err instanceof Error ? err.message : "Delegation failed",
        );
        setDelegationPulse("none");
        setTimeout(() => {
          setDelegationStatus("idle");
          setDelegationMessage(undefined);
        }, 5000);
      }
    },
    [addEntry, refresh, refreshInspector, selectedLabId],
  );

  const selectedLab = useMemo(
    () => (selectedLabId && data ? data.labs[selectedLabId] : null),
    [data, selectedLabId],
  );

  return (
    <>
      <FacilityShell
        data={data}
        loading={loading}
        error={error}
        connected={connected}
        selectedLabId={selectedLabId}
        highlightedLabs={highlightedLabs}
        delegationPulse={delegationPulse}
        commandHistory={history}
        delegationStatus={delegationStatus}
        delegationMessage={delegationMessage}
        onLabSelect={handleLabSelect}
        onDelegate={handleDelegate}
      />
      <LabInspectorDrawer
        open={selectedLabId !== null}
        agentId={selectedLabId}
        lab={selectedLab}
        data={inspectorData}
        loading={inspectorLoading}
        error={inspectorError}
        onClose={handleCloseInspector}
      />
    </>
  );
}
