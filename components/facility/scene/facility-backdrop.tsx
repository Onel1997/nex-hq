import { AmbienceField } from "@/components/facility/motion/ambience-field";
import { FacilityForegroundField } from "@/components/facility/scene/facility-foreground-field";
import { NEXUS_ENVIRONMENT_ANCHOR } from "@/lib/facility/layout";

export function FacilityBackdrop() {
  return (
    <div
      className="facility-backdrop"
      style={
        {
          "--nexus-x": `${NEXUS_ENVIRONMENT_ANCHOR.left}%`,
          "--nexus-y": `${NEXUS_ENVIRONMENT_ANCHOR.top}%`,
        } as React.CSSProperties
      }
      aria-hidden
    >
      <div className="facility-env-layer facility-env-base" />
      <div className="facility-env-layer facility-env-distant-dark" />
      <div className="facility-env-layer facility-env-volume" />
      <div className="facility-env-layer facility-env-neural-grid" />
      <div className="facility-env-layer facility-env-holo-structures" />
      <div className="facility-env-layer facility-env-nexus-light" />
      <AmbienceField />
      <FacilityForegroundField />
      <div className="facility-env-layer facility-env-edge-depth" />
    </div>
  );
}
