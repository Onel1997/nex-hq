import type { SvgAssetDefinition, SvgAssetFamily, SvgAssetPackValidation } from "@/lib/design/svg-assets/types";

const TYPOGRAPHY_SUPPORT_FAMILIES: SvgAssetFamily[] = [
  "divider",
  "capsule",
  "museum-label",
  "gallery-marker",
  "frame",
];

const ORNAMENT_FAMILIES: SvgAssetFamily[] = ["ornament", "texture", "halo", "star"];

const APPAREL_SCALE_FAMILIES: SvgAssetFamily[] = [
  "halo",
  "frame",
  "cross",
  "star",
  "grid",
  "ornament",
];

const LOGO_LIKE_PATTERNS = [/logo/i, /brand-mark/i, /trademark/i];

function familyDiversity(assets: SvgAssetDefinition[]): number {
  return new Set(assets.map((a) => a.family)).size;
}

function complexitySpread(assets: SvgAssetDefinition[]): { low: number; high: number; avg: number } {
  const complexities = assets.map((a) => a.complexity);
  const low = complexities.filter((c) => c <= 3).length;
  const high = complexities.filter((c) => c >= 6).length;
  const avg = complexities.reduce((sum, c) => sum + c, 0) / Math.max(assets.length, 1);
  return { low, high, avg };
}

function similarityScore(a: SvgAssetDefinition, b: SvgAssetDefinition): number {
  let score = 0;
  if (a.family === b.family) score += 3;
  if (a.renderMode === b.renderMode) score += 1;
  if (Math.abs(a.complexity - b.complexity) <= 1) score += 1;
  if (Math.abs(a.visualWeight - b.visualWeight) < 0.08) score += 1;
  const sharedTags = a.styleTags.filter((t) => b.styleTags.includes(t)).length;
  score += sharedTags;
  return score;
}

function countSimilarPairs(assets: SvgAssetDefinition[], threshold: number): number {
  let pairs = 0;
  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      if (similarityScore(assets[i]!, assets[j]!) >= threshold) pairs++;
    }
  }
  return pairs;
}

function countLogoLike(assets: SvgAssetDefinition[]): number {
  return assets.filter((a) => LOGO_LIKE_PATTERNS.some((p) => p.test(a.name) || p.test(a.id))).length;
}

export function validateAssetPack(assets: SvgAssetDefinition[]): SvgAssetPackValidation {
  if (assets.length === 0) {
    return { passed: false, reason: "empty pack", diversityScore: 0, apparelScaleScore: 0 };
  }

  const diversity = familyDiversity(assets);
  const { low, high, avg } = complexitySpread(assets);
  const similarPairs = countSimilarPairs(assets, 5);
  const logoLike = countLogoLike(assets);
  const ornamentCount = assets.filter((a) => ORNAMENT_FAMILIES.includes(a.family)).length;
  const typographySupport = assets.filter((a) => TYPOGRAPHY_SUPPORT_FAMILIES.includes(a.family)).length;
  const apparelScale = assets.filter((a) => APPAREL_SCALE_FAMILIES.includes(a.family)).length;

  const diversityScore = Math.min(100, diversity * 14 + ornamentCount * 6);
  const apparelScaleScore = Math.min(100, (apparelScale / assets.length) * 100);

  if (similarPairs > Math.max(2, Math.floor(assets.length * 0.35))) {
    return {
      passed: false,
      reason: "too many similar assets",
      diversityScore,
      apparelScaleScore,
    };
  }

  if (low > Math.ceil(assets.length * 0.55)) {
    return {
      passed: false,
      reason: "too many low-complexity assets",
      diversityScore,
      apparelScaleScore,
    };
  }

  if (logoLike > 0) {
    return {
      passed: false,
      reason: "logo-like assets detected",
      diversityScore,
      apparelScaleScore,
    };
  }

  if (ornamentCount < 1 && assets.length >= 4) {
    return {
      passed: false,
      reason: "not enough ornament diversity",
      diversityScore,
      apparelScaleScore,
    };
  }

  if (typographySupport < 1 && assets.length >= 4) {
    return {
      passed: false,
      reason: "not enough typography-support assets",
      diversityScore,
      apparelScaleScore,
    };
  }

  if (apparelScale < Math.ceil(assets.length * 0.35)) {
    return {
      passed: false,
      reason: "not enough apparel-scale assets",
      diversityScore,
      apparelScaleScore,
    };
  }

  if (avg < 3.2 && assets.length >= 5) {
    return {
      passed: false,
      reason: "pack complexity too low",
      diversityScore,
      apparelScaleScore,
    };
  }

  if (high < 1 && assets.length >= 6) {
    return {
      passed: false,
      reason: "pack lacks premium complexity",
      diversityScore,
      apparelScaleScore,
    };
  }

  return { passed: true, diversityScore, apparelScaleScore };
}

export function validateFullRegistry(assets: SvgAssetDefinition[]): SvgAssetPackValidation {
  return validateAssetPack(assets);
}
