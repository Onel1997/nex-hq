import { HALO_ASSETS } from "@/lib/design/svg-assets/families/halos";
import { FRAME_ASSETS } from "@/lib/design/svg-assets/families/frames";
import { DIVIDER_ASSETS } from "@/lib/design/svg-assets/families/dividers";
import { MARKER_ASSETS } from "@/lib/design/svg-assets/families/markers";
import { CAPSULE_ASSETS } from "@/lib/design/svg-assets/families/capsules";
import { LABEL_ASSETS } from "@/lib/design/svg-assets/families/labels";
import { CROSS_ASSETS } from "@/lib/design/svg-assets/families/crosses";
import { STAR_ASSETS } from "@/lib/design/svg-assets/families/stars";
import { GRID_ASSETS } from "@/lib/design/svg-assets/families/grids";
import { ORNAMENT_ASSETS } from "@/lib/design/svg-assets/families/ornaments";
import { TEXTURE_ASSETS } from "@/lib/design/svg-assets/families/texture";
import type { SvgAssetDefinition, SvgAssetFamily } from "@/lib/design/svg-assets/types";

export const SVG_ASSET_REGISTRY: SvgAssetDefinition[] = [
  ...HALO_ASSETS,
  ...FRAME_ASSETS,
  ...DIVIDER_ASSETS,
  ...MARKER_ASSETS,
  ...CAPSULE_ASSETS,
  ...LABEL_ASSETS,
  ...CROSS_ASSETS,
  ...STAR_ASSETS,
  ...GRID_ASSETS,
  ...ORNAMENT_ASSETS,
  ...TEXTURE_ASSETS,
];

export const SVG_ASSETS_BY_ID: Record<string, SvgAssetDefinition> = Object.fromEntries(
  SVG_ASSET_REGISTRY.map((asset) => [asset.id, asset]),
);

export const SVG_ASSETS_BY_FAMILY: Record<SvgAssetFamily, SvgAssetDefinition[]> = SVG_ASSET_REGISTRY.reduce(
  (acc, asset) => {
    if (!acc[asset.family]) acc[asset.family] = [];
    acc[asset.family].push(asset);
    return acc;
  },
  {} as Record<SvgAssetFamily, SvgAssetDefinition[]>,
);

let registryLogged = false;

export function getSvgAssetRegistry(): SvgAssetDefinition[] {
  if (!registryLogged) {
    console.log(`[SVG ASSETS] Loaded assets: ${SVG_ASSET_REGISTRY.length}`);
    registryLogged = true;
  }
  return SVG_ASSET_REGISTRY;
}

export function getSvgAsset(id: string): SvgAssetDefinition | undefined {
  getSvgAssetRegistry();
  return SVG_ASSETS_BY_ID[id];
}

export function getSvgAssetsByFamily(family: SvgAssetFamily): SvgAssetDefinition[] {
  getSvgAssetRegistry();
  return SVG_ASSETS_BY_FAMILY[family] ?? [];
}

export function getSvgAssetFamilyCount(): Record<SvgAssetFamily, number> {
  getSvgAssetRegistry();
  return Object.fromEntries(
    Object.entries(SVG_ASSETS_BY_FAMILY).map(([family, assets]) => [family, assets.length]),
  ) as Record<SvgAssetFamily, number>;
}
