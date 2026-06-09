"use client";

import { FacilityStatusBar } from "@/components/facility/hud/facility-status-bar";
import type { FacilitySnapshot } from "@/lib/facility/types";

interface FacilityHudProps {
  data: FacilitySnapshot;
  connected?: boolean;
}

export function FacilityHud({ data, connected }: FacilityHudProps) {
  return (
    <FacilityStatusBar
      workspaceName={data.workspace.name}
      telemetry={data.telemetry}
      connected={connected}
    />
  );
}
