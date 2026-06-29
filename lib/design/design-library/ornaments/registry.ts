import type { DesignStyleId, OrnamentDefinition, OrnamentId } from "@/lib/design/design-library/types";

function orn(
  id: OrnamentId,
  name: string,
  density: OrnamentDefinition["density"],
  styles: DesignStyleId[],
): OrnamentDefinition {
  return { id, name, density, recommendedStyles: styles };
}

export const ORNAMENT_REGISTRY: Record<OrnamentId, OrnamentDefinition> = {
  "rule-lines": orn("rule-lines", "Rule Lines", "sparse", ["minimal-luxury", "editorial-fashion", "swiss-typography"]),
  "micro-dots": orn("micro-dots", "Micro Dots", "moderate", ["silent-luxury", "japanese-minimal", "scandinavian-minimal"]),
  "editorial-dividers": orn("editorial-dividers", "Editorial Dividers", "sparse", ["editorial-fashion", "swiss-typography"]),
  coordinates: orn("coordinates", "Coordinates", "sparse", ["technical-streetwear", "vintage-washed"]),
  "registration-marks": orn("registration-marks", "Registration Marks", "sparse", ["technical-streetwear"]),
  "luxury-borders": orn("luxury-borders", "Luxury Borders", "sparse", ["monochrome-luxury", "minimal-luxury"]),
  "corner-marks": orn("corner-marks", "Corner Marks", "sparse", ["architectural", "modern-gothic"]),
  "alignment-guides": orn("alignment-guides", "Alignment Guides", "moderate", ["swiss-typography", "technical-streetwear"]),
  "tiny-capsules": orn("tiny-capsules", "Tiny Capsules", "sparse", ["minimal-luxury", "silent-luxury", "monochrome-luxury"]),
  "minimal-labels": orn("minimal-labels", "Minimal Labels", "sparse", ["faith", "scandinavian-minimal"]),
  "roman-ids": orn("roman-ids", "Roman IDs", "sparse", ["minimal-luxury", "faith", "monochrome-luxury"]),
  "collection-numbers": orn("collection-numbers", "Collection Numbers", "sparse", ["vintage-washed", "editorial-fashion"]),
  "flank-strikes": orn("flank-strikes", "Flank Strikes", "sparse", ["silent-luxury", "architectural"]),
  "vertical-rules": orn("vertical-rules", "Vertical Rules", "sparse", ["editorial-fashion", "architectural"]),
  "micro-lines": orn("micro-lines", "Micro Lines", "moderate", ["minimal-luxury", "silent-luxury", "editorial-fashion"]),
};

export function getOrnament(id: OrnamentId): OrnamentDefinition {
  return ORNAMENT_REGISTRY[id] ?? ORNAMENT_REGISTRY["rule-lines"];
}
