"use client";

import {
  CreativeWorkspace,
  CreativeWorkspaceEmpty,
} from "@/components/design/creative-workspace";
import type { DesignMissionState } from "@/lib/design/design-mission-store";
import type { ReactNode } from "react";

interface DesignMissionPanelProps {
  mission: DesignMissionState;
  onSelectBrief?: (designId: string) => void;
  onSaveDraft?: () => void;
  onPatchMission: (updater: (state: DesignMissionState) => DesignMissionState) => void;
  commerceSection?: ReactNode;
}

export function DesignMissionEmptyState() {
  return <CreativeWorkspaceEmpty />;
}

export function DesignMissionPanel(props: DesignMissionPanelProps) {
  return <CreativeWorkspace {...props} />;
}
