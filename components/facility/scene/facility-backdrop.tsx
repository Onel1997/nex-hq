import { AmbienceField } from "@/components/facility/motion/ambience-field";
import { FACILITY_ZONES } from "@/lib/facility/layout";

export function FacilityBackdrop() {
  return (
    <div className="facility-backdrop" aria-hidden>
      <div className="facility-backdrop-depth" />
      <div className="facility-backdrop-grid" />
      <div className="facility-backdrop-sectors" />
      <div className="facility-backdrop-radial" />
      <div className="facility-backdrop-brain-bloom" />
      <div className="facility-backdrop-vignette" />

      <div className="facility-zone-labels">
        {FACILITY_ZONES.map((zone) => (
          <span
            key={zone.id}
            className={`facility-zone-label facility-zone-${zone.id}`}
            style={{
              left: `${zone.left}%`,
              top: `${zone.top}%`,
            }}
          >
            {zone.label}
          </span>
        ))}
      </div>

      <AmbienceField />
    </div>
  );
}
