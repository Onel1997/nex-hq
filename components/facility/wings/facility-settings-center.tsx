"use client";

import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import { SettingsPanels } from "@/components/settings/settings-panels";
import { Settings } from "lucide-react";

export function FacilitySettingsCenter() {
  return (
    <FacilityDepartmentShell
      wingId="agents"
      title="Settings"
      icon={Settings}
      subtitle="Facility configuration and workspace preferences"
      hideWingNav
    >
      <div className="facility-settings-wrap">
        <SettingsPanels />
      </div>
    </FacilityDepartmentShell>
  );
}
