"use client";

import { MasterArtworkWorkspace } from "@/components/design/v2";
import type { DesignMissionState } from "@/lib/design/design-mission-store";

interface DesignMissionPanelProps {
  mission?: DesignMissionState;
  onPatchMission: (updater: (state: DesignMissionState) => DesignMissionState) => void;
}

export function DesignMissionPanel({ mission, onPatchMission }: DesignMissionPanelProps) {
  return <MasterArtworkWorkspace mission={mission} onPatchMission={onPatchMission} />;
}

export function DesignMissionEmptyState() {
  return <MasterArtworkWorkspace />;
}
