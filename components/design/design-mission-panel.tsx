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
  renderCommerceSection?: () => ReactNode;
}

export function DesignMissionEmptyState({
  onStartDemo,
  mockMode,
}: {
  onStartDemo?: () => void;
  mockMode?: boolean;
}) {
  return <CreativeWorkspaceEmpty onStartDemo={onStartDemo} mockMode={mockMode} />;
}

export function DesignMissionPanel(props: DesignMissionPanelProps) {
  return <CreativeWorkspace {...props} />;
}
