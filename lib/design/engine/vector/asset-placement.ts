import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { buildColorScheme } from "@/lib/design/vector-engine/color";
import type {
  ArtworkSpec,
  AssetId,
  CreativeComposition,
  DesignIntelligence,
  LayoutZones,
  PlacedAsset,
  StyleProfile,
} from "@/lib/design/engine/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

function placeAsset(
  id: string,
  asset: AssetId,
  zone: PlacedAsset["zone"],
  cx: number,
  cy: number,
  scale: number,
  seed: number,
  index: number,
  colorRole: PlacedAsset["colorRole"] = "primary",
): PlacedAsset {
  return {
    id,
    asset,
    zone,
    cx: snap(cx + range(seed, index, -8, 8)),
    cy: snap(cy + range(seed, index + 50, -6, 6)),
    scale,
    rotation: range(seed, index + 100, -5, 5),
    opacity: range(seed, index + 150, 0.75, 0.95),
    colorRole,
  };
}

/** Converts intelligence + layout into positioned asset specifications. */
export function buildAssetPlacement(
  brief: DesignStudioBrief,
  composition: CreativeComposition,
  intelligence: DesignIntelligence,
  style: StyleProfile,
  layout: LayoutZones,
): { assets: PlacedAsset[]; colors: ArtworkSpec["colors"] } {
  const seed = composition.seed;
  const colors = buildColorScheme(brief.colorPalette, brief.color, brief.materialEffects, seed);
  const heroCx = snap(layout.heroZone.x + layout.heroZone.width / 2);
  const heroCy = snap(layout.heroZone.y + layout.heroZone.height / 2);
  const heroScale = layout.heroZone.width * style.geometryScale * composition.visualWeight * 0.58;

  const assets: PlacedAsset[] = [];
  let idx = 0;

  for (const asset of intelligence.primaryAssets) {
    assets.push(
      placeAsset(`primary-${idx}`, asset, "hero", heroCx, heroCy, heroScale, seed, idx++, "primary"),
    );
  }

  const secondaryY = heroCy + heroScale * 0.22;
  for (const asset of intelligence.secondaryAssets) {
    assets.push(
      placeAsset(
        `secondary-${idx}`,
        asset,
        "secondary",
        heroCx,
        secondaryY,
        heroScale * 0.65,
        seed,
        idx++,
        "secondary",
      ),
    );
  }

  const accentPositions = [
    { x: layout.safeZone.x + layout.safeZone.width * 0.08, y: layout.safeZone.y + layout.marginTop },
    { x: layout.safeZone.x + layout.safeZone.width * 0.92, y: layout.safeZone.y + layout.safeZone.height * 0.92 },
    { x: layout.safeZone.x + layout.safeZone.width * 0.5, y: layout.typeZone.y - layout.baselineGrid * 2 },
  ];

  for (const asset of intelligence.accentAssets) {
    const pos = accentPositions[idx % accentPositions.length]!;
    assets.push(
      placeAsset(
        `accent-${idx}`,
        asset,
        "decorative",
        pos.x,
        pos.y,
        heroScale * (asset === "coordinate-marks" ? 1 : 0.35),
        seed,
        idx++,
        asset === "capsule-code" ? "ink" : "accent",
      ),
    );
  }

  if (composition.symmetry === "asymmetric") {
    assets.push(
      placeAsset(
        "asym-accent",
        "minimal-symbol",
        "accent",
        layout.safeZone.x + layout.safeZone.width * 0.72,
        heroCy + heroScale * 0.15,
        heroScale * 0.2,
        seed,
        idx++,
        "accent",
      ),
    );
  }

  return { assets, colors };
}
