import { AmbienceField } from "@/components/facility/motion/ambience-field";

export function FacilityBackdrop() {
  return (
    <div className="facility-backdrop" aria-hidden>
      <div className="facility-backdrop-depth" />
      <div className="facility-backdrop-grid" />
      <div className="facility-backdrop-radial" />
      <div className="facility-backdrop-brain-bloom" />
      <div className="facility-backdrop-vignette" />
      <AmbienceField />
    </div>
  );
}
