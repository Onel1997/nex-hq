import {
  ADVANCED_ASSET_SPECS,
  assetDedupKey,
  CORE_ASSET_SPECS,
  findAssetSpec,
} from "./asset-specs";
import type { LegacyNormalizedImageAsset } from "./legacy-v2";

const SPEC_IDS = new Set([
  ...CORE_ASSET_SPECS.map((s) => s.id),
  ...ADVANCED_ASSET_SPECS.map((s) => s.id),
]);

function specPriority(asset: LegacyNormalizedImageAsset): number {
  if (SPEC_IDS.has(asset.id)) return 2;
  if (findAssetSpec(asset.id)) return 2;
  return 1;
}

function preferAsset(
  existing: LegacyNormalizedImageAsset,
  candidate: LegacyNormalizedImageAsset,
): LegacyNormalizedImageAsset {
  const existingPriority = specPriority(existing);
  const candidatePriority = specPriority(candidate);
  if (candidatePriority > existingPriority) return candidate;
  if (candidatePriority < existingPriority) return existing;
  return candidate.title.length >= existing.title.length ? candidate : existing;
}

/**
 * Collapse duplicate hero, mockup, campaign, and social concepts.
 * Keeps one asset per dedup key (type or type+variant).
 */
export function dedupeImageAssets(
  assets: LegacyNormalizedImageAsset[],
): LegacyNormalizedImageAsset[] {
  const byKey = new Map<string, LegacyNormalizedImageAsset>();

  for (const asset of assets) {
    const key = assetDedupKey(asset);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, asset);
      continue;
    }
    byKey.set(key, preferAsset(existing, asset));
  }

  return Array.from(byKey.values());
}

export function matchAssetToSpec(
  asset: LegacyNormalizedImageAsset,
  specs: typeof CORE_ASSET_SPECS,
): (typeof CORE_ASSET_SPECS)[number] | undefined {
  const byId = specs.find((s) => s.id === asset.id);
  if (byId) return byId;

  return specs.find((spec) => {
    if (spec.type !== asset.type) return false;
    if (spec.variant) return spec.variant === asset.variant;
    return !asset.variant;
  });
}
