import type {
  DesignStyleDefinition,
  LayoutDefinition,
  LayoutZones,
  OrnamentId,
  OrnamentPlacement,
  TemplateDefinition,
} from "@/lib/design/design-library/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

const ORNAMENT_POSITIONS = (
  zones: LayoutZones,
  scale: number,
): Array<{ x: number; y: number; scale: number }> => [
  { x: zones.safeZone.x + zones.safeZone.width * 0.5, y: zones.anchors.type.y + scale * 0.3, scale: scale * 0.35 },
  { x: zones.safeZone.x + zones.safeZone.width * 0.08, y: zones.safeZone.y + zones.marginTop, scale: scale * 0.28 },
  { x: zones.safeZone.x + zones.safeZone.width * 0.92, y: zones.safeZone.y + zones.safeZone.height * 0.92, scale: scale * 0.28 },
  { x: zones.anchors.focal.x, y: zones.anchors.symbol.y + scale * 0.55, scale: scale * 0.4 },
  { x: zones.safeZone.x + zones.safeZone.width * 0.5, y: zones.safeZone.y + zones.safeZone.height * 0.86, scale: scale * 0.32 },
];

export function selectOrnaments(
  style: DesignStyleDefinition,
  layout: LayoutDefinition,
  zones: LayoutZones,
  template: TemplateDefinition,
  seed: number,
): OrnamentPlacement[] {
  const ornamentIds = [...new Set([...template.ornaments, ...style.preferredOrnaments])].slice(0, 6);
  const heroScale = zones.heroZone.width * layout.scaling.ornamentScale;
  const positions = ORNAMENT_POSITIONS(zones, heroScale);

  return ornamentIds.map((ornamentId, index) => {
    const pos = positions[index % positions.length]!;
    return {
      id: `ornament-${index}`,
      ornamentId: ornamentId as OrnamentId,
      cx: snap(pos.x + range(seed, index + 30, -6, 6)),
      cy: snap(pos.y + range(seed, index + 40, -4, 4)),
      scale: pos.scale,
      rotation: range(seed, index + 60, -3, 3),
      opacity: range(seed, index + 70, 0.35, 0.65),
    };
  });
}
