import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import { getSvgAssetRegistry } from "@/lib/design/svg-assets/registry";
import { validateAssetPack } from "@/lib/design/svg-assets/quality";
import type {
  SvgAssetDefinition,
  SvgAssetFamily,
  SvgAssetPack,
  SvgAssetPlacement,
  SvgAssetSelectionInput,
} from "@/lib/design/svg-assets/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

const FAMILY_PRIORITY: Record<string, SvgAssetFamily[]> = {
  "luxury-editorial": ["divider", "ornament", "frame", "halo", "star"],
  "gallery-poster": ["gallery-marker", "frame", "museum-label", "divider", "grid"],
  "museum-label": ["museum-label", "divider", "gallery-marker", "capsule"],
  "architectural-frame": ["frame", "grid", "gallery-marker", "directional-marker"],
  "faith-collection": ["cross", "halo", "ornament", "star"],
  "oversized-graphic": ["halo", "texture", "star", "frame"],
  "silent-collection": ["halo", "cross", "divider", "star"],
  "modern-minimal": ["star", "cross", "divider", "capsule"],
  "technical-luxury": ["grid", "capsule", "directional-marker", "gallery-marker"],
  "fashion-campaign": ["texture", "ornament", "capsule", "directional-marker"],
};

const TONE_FAMILIES: Record<string, SvgAssetFamily[]> = {
  solemn: ["cross", "halo", "museum-label"],
  bold: ["frame", "star", "texture"],
  refined: ["divider", "ornament", "museum-label"],
  technical: ["grid", "capsule", "directional-marker", "gallery-marker"],
  celestial: ["halo", "star", "cross"],
  editorial: ["divider", "frame", "ornament", "museum-label"],
};

function briefFamilies(brief: SvgAssetSelectionInput["brief"]): SvgAssetFamily[] {
  const text = `${brief.visualConcept} ${brief.geometry} ${brief.visualElements.join(" ")} ${brief.designDescription}`.toLowerCase();
  const families: SvgAssetFamily[] = [];
  if (/halo|ring|orbit|arc/.test(text)) families.push("halo");
  if (/frame|border|architect/.test(text)) families.push("frame");
  if (/divider|rule|line/.test(text)) families.push("divider");
  if (/gallery|exhibit|museum/.test(text)) families.push("gallery-marker", "museum-label");
  if (/capsule|code|label/.test(text)) families.push("capsule");
  if (/cross|faith|sacred/.test(text)) families.push("cross");
  if (/star|celestial|spark/.test(text)) families.push("star");
  if (/grid|matrix|blueprint/.test(text)) families.push("grid");
  if (/ornament|flourish|decorative/.test(text)) families.push("ornament");
  if (/texture|grain|noise|distress/.test(text)) families.push("texture");
  if (/arrow|direction|vector|compass/.test(text)) families.push("directional-marker");
  return families;
}

function scoreAsset(asset: SvgAssetDefinition, input: SvgAssetSelectionInput, familyRank: number): number {
  let score = asset.qualityScore * 0.35 + asset.complexity * 4 + asset.visualWeight * 18;
  score -= familyRank * 6;

  if (asset.recommendedStyles.includes(input.styleId)) score += 22;
  if (asset.recommendedTemplates.includes(input.templateId)) score += 18;
  if (asset.recommendedPlacements.includes(input.placement)) score += 12;

  const briefText = `${input.brief.visualConcept} ${input.brief.designDescription}`.toLowerCase();
  for (const tag of asset.styleTags) {
    if (briefText.includes(tag)) score += 8;
  }

  if (input.symbolSystem && asset.family === "cross") score += 14;
  if (input.symbolSystem && asset.family === "halo") score += 12;
  if (input.ornamentSystem && (asset.family === "ornament" || asset.family === "texture")) score += 14;

  const collection = (input.collection ?? input.brief.title ?? "").toLowerCase();
  if (collection && asset.name.toLowerCase().includes(collection.slice(0, 4))) score += 6;

  if (input.compositionScore && input.compositionScore > 90 && asset.complexity >= 5) score += 8;
  if (input.compositionScore && input.compositionScore < 85 && asset.visualWeight < 0.45) score += 6;

  score += range(input.seed, asset.id.length + familyRank, -4, 4);
  return score;
}

function resolveTargetFamilies(input: SvgAssetSelectionInput): SvgAssetFamily[] {
  const fromBrief = briefFamilies(input.brief);
  const fromTemplate = FAMILY_PRIORITY[input.templateId] ?? [];
  const toneKey = Object.keys(TONE_FAMILIES).find((k) =>
    `${input.emotionalTone ?? ""} ${input.brief.visualConcept} ${input.brief.designDescription}`.toLowerCase().includes(k),
  );
  const fromTone = toneKey ? TONE_FAMILIES[toneKey] : [];

  const merged = [...new Set([...fromBrief, ...fromTemplate, ...fromTone])];
  if (merged.length === 0) {
    return FAMILY_PRIORITY[input.templateId] ?? ["halo", "frame", "divider", "ornament"];
  }
  return merged;
}

function pickVariant(asset: SvgAssetDefinition, seed: number): string {
  const idx = Math.abs(range(seed, asset.id.charCodeAt(0), 0, asset.variants.length - 0.01));
  return asset.variants[Math.floor(idx)] ?? asset.variants[0] ?? "default";
}

function buildPlacement(
  asset: SvgAssetDefinition,
  input: SvgAssetSelectionInput,
  layer: SvgAssetPlacement["layer"],
  index: number,
  scaleMul: number,
  opacityMul: number,
): SvgAssetPlacement {
  const offsetX = range(input.seed, index * 11 + 3, -input.heroScale * 0.22, input.heroScale * 0.22);
  const offsetY = range(input.seed, index * 11 + 5, -input.heroScale * 0.18, input.heroScale * 0.28);
  return {
    asset,
    cx: snap(input.focal.x + offsetX),
    cy: snap(input.focal.y + offsetY),
    scale: input.heroScale * scaleMul,
    rotation: range(input.seed, index * 13 + 7, -12, 12),
    opacity: opacityMul,
    variant: pickVariant(asset, input.seed + index),
    layer,
  };
}

export function selectAssetsForComposition(input: SvgAssetSelectionInput): SvgAssetPack {
  const registry = getSvgAssetRegistry();
  const targetFamilies = resolveTargetFamilies(input);
  const selected: SvgAssetPlacement[] = [];
  const usedFamilies = new Set<SvgAssetFamily>();

  targetFamilies.forEach((family, familyRank) => {
    const candidates = registry
      .filter((a) => a.family === family)
      .map((asset) => ({ asset, score: scoreAsset(asset, input, familyRank) }))
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) return;

    const heroPick = candidates[0]!.asset;
    selected.push(buildPlacement(heroPick, input, "hero", selected.length, 0.42 + familyRank * 0.02, 0.72));
    usedFamilies.add(family);

    const supportPick = candidates[Math.min(2, candidates.length - 1)]!.asset;
    if (supportPick.id !== heroPick.id) {
      selected.push(buildPlacement(supportPick, input, "secondary", selected.length, 0.24, 0.48));
    }
  });

  const decorativeFamilies: SvgAssetFamily[] = ["divider", "texture", "gallery-marker", "capsule"];
  decorativeFamilies.forEach((family, i) => {
    if (usedFamilies.has(family)) return;
    const candidates = registry
      .filter((a) => a.family === family)
      .map((asset) => ({ asset, score: scoreAsset(asset, input, i + 4) }))
      .sort((a, b) => b.score - a.score);
    if (candidates[0]) {
      selected.push(buildPlacement(candidates[0].asset, input, "decorative", selected.length, 0.18, 0.38));
      usedFamilies.add(family);
    }
  });

  const capped = selected.slice(0, 8);
  const validation = validateAssetPack(capped.map((p) => p.asset));

  console.log(`[SVG ASSETS] Selected pack: ${capped.map((p) => p.asset.id).join(", ")}`);

  return {
    assets: capped,
    families: [...usedFamilies],
    validation,
  };
}

export function selectAssetsFromPremiumContext(ctx: PremiumRenderContext, templateId: string, compositionScore?: number): SvgAssetPack {
  return selectAssetsForComposition({
    brief: ctx.spec.brief,
    styleId: ctx.spec.style.id,
    templateId: templateId as SvgAssetSelectionInput["templateId"],
    collection: ctx.spec.brief.title,
    placement: ctx.placement,
    emotionalTone: ctx.spec.brief.visualConcept,
    symbolSystem: ctx.spec.template.primarySymbol,
    ornamentSystem: ctx.spec.style.preferredOrnaments[0],
    seed: ctx.seed,
    heroScale: ctx.heroScale,
    focal: ctx.focal,
    compositionScore,
    premiumContext: ctx,
  });
}
