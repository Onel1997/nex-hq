import { AmbienceField } from "@/components/facility/motion/ambience-field";
import { FacilityArchitecture } from "@/components/facility/scene/facility-architecture";
import { NEXUS_ENVIRONMENT_ANCHOR } from "@/lib/facility/layout";

export function FacilityBackdrop() {
  return (
    <div
      className="facility-backdrop"
      style={
        {
          "--brain-x": `${NEXUS_ENVIRONMENT_ANCHOR.left}%`,
          "--brain-y": `${NEXUS_ENVIRONMENT_ANCHOR.top}%`,
        } as React.CSSProperties
      }
      aria-hidden
    >
      <FacilityArchitecture />
      <div className="facility-atmo-fog" />
      <div className="facility-atmo-energy" />
      <AmbienceField />
    </div>
  );
}
