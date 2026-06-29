import type { LayoutRecipe } from "@/lib/design/design-knowledge/layout-language/types";
import { expandArchetype, lerp } from "@/lib/design/design-knowledge/shared/variant";

const OVERSIZED: LayoutRecipe["meta"]["garmentFit"] = ["oversized-front", "oversized-back"];
const CHEST: LayoutRecipe["meta"]["garmentFit"] = ["center-chest", "oversized-front"];
const ALL: LayoutRecipe["meta"]["garmentFit"] = ["oversized-front", "oversized-back", "center-chest", "sleeve", "corner"];

function layoutBase(
  partial: Omit<LayoutRecipe, "id" | "meta">,
): Omit<LayoutRecipe, "id" | "meta"> {
  return partial;
}

const ARCHETYPES: Parameters<typeof expandArchetype<LayoutRecipe>>[0][] = [
  {
    archetype: "Luxury Editorial",
    base: layoutBase({
      hierarchy: "type-first", negativeSpace: 0.48, anchors: { focal: { rx: 0.5, ry: 0.38 }, type: { rx: 0.5, ry: 0.58 }, symbol: { rx: 0.5, ry: 0.32 } },
      balance: "asymmetric", density: "moderate", movement: "editorial-flow", cropping: "partial-frame", layerOrder: "type-first", tension: 0.62, marginRatio: 0.1, spread: 0.72,
    }),
    variantCount: 16, name: (v) => `Luxury Editorial`, tags: ["editorial", "luxury", "type-first"], collections: ["editorial", "season"], garmentFit: OVERSIZED,
    mutate: (b, v, s) => ({ ...b, negativeSpace: lerp(s, v, 0.38, 0.55), tension: lerp(s, v + 1, 0.5, 0.75), anchors: { ...b.anchors, focal: { rx: lerp(s, v + 2, 0.44, 0.56), ry: lerp(s, v + 3, 0.32, 0.42) } } }),
  },
  {
    archetype: "Gallery Editorial",
    base: layoutBase({
      hierarchy: "type-first", negativeSpace: 0.42, anchors: { focal: { rx: 0.48, ry: 0.35 }, type: { rx: 0.52, ry: 0.62 }, symbol: { rx: 0.46, ry: 0.28 }, secondary: { rx: 0.78, ry: 0.18 } },
      balance: "asymmetric", density: "rich", movement: "cascade", cropping: "edge-bleed", layerOrder: "depth-interleaved", tension: 0.7, marginRatio: 0.08, spread: 0.82,
    }),
    variantCount: 16, name: () => `Gallery Editorial`, tags: ["gallery", "poster", "oversized"], collections: ["editorial", "museum"], garmentFit: OVERSIZED,
    mutate: (b, v, s) => ({ ...b, spread: lerp(s, v, 0.72, 0.9), density: v % 3 === 0 ? "dense" : "rich" }),
  },
  {
    archetype: "Museum Label",
    base: layoutBase({
      hierarchy: "balanced", negativeSpace: 0.52, anchors: { focal: { rx: 0.54, ry: 0.4 }, type: { rx: 0.54, ry: 0.55 }, symbol: { rx: 0.54, ry: 0.35 } },
      balance: "optical", density: "sparse", movement: "static", cropping: "none", layerOrder: "ornament-accent", tension: 0.45, marginRatio: 0.12, spread: 0.55,
    }),
    variantCount: 16, name: () => `Museum Label`, tags: ["museum", "label", "micro-type"], collections: ["museum", "silent"], garmentFit: CHEST,
    mutate: (b, v, s) => ({ ...b, negativeSpace: lerp(s, v, 0.45, 0.62), marginRatio: lerp(s, v + 1, 0.1, 0.15) }),
  },
  {
    archetype: "Oversized Back",
    base: layoutBase({
      hierarchy: "geometry-first", negativeSpace: 0.38, anchors: { focal: { rx: 0.5, ry: 0.42 }, type: { rx: 0.5, ry: 0.68 }, symbol: { rx: 0.5, ry: 0.38 } },
      balance: "asymmetric", density: "rich", movement: "diagonal", cropping: "edge-bleed", layerOrder: "geometry-first", tension: 0.75, marginRatio: 0.06, spread: 0.88,
    }),
    variantCount: 16, name: () => `Oversized Back`, tags: ["oversized", "back-print"], collections: ["season", "capsule"], garmentFit: ["oversized-back"],
    mutate: (b, v, s) => ({ ...b, spread: lerp(s, v, 0.82, 0.95), tension: lerp(s, v + 1, 0.65, 0.85) }),
  },
  {
    archetype: "Oversized Front",
    base: layoutBase({
      hierarchy: "type-first", negativeSpace: 0.4, anchors: { focal: { rx: 0.48, ry: 0.4 }, type: { rx: 0.48, ry: 0.58 }, symbol: { rx: 0.52, ry: 0.36 } },
      balance: "asymmetric", density: "moderate", movement: "sweep", cropping: "partial-frame", layerOrder: "type-first", tension: 0.68, marginRatio: 0.08, spread: 0.8,
    }),
    variantCount: 16, name: () => `Oversized Front`, tags: ["oversized", "front-print"], collections: ["season", "editorial"], garmentFit: ["oversized-front"],
    mutate: (b, v, s) => ({ ...b, anchors: { ...b.anchors, type: { rx: lerp(s, v, 0.42, 0.54), ry: lerp(s, v + 1, 0.55, 0.65) } } }),
  },
  {
    archetype: "Silent Luxury",
    base: layoutBase({
      hierarchy: "balanced", negativeSpace: 0.58, anchors: { focal: { rx: 0.5, ry: 0.44 }, type: { rx: 0.5, ry: 0.56 }, symbol: { rx: 0.5, ry: 0.4 } },
      balance: "optical", density: "sparse", movement: "static", cropping: "none", layerOrder: "negative-space-dominant", tension: 0.38, marginRatio: 0.14, spread: 0.48,
    }),
    variantCount: 16, name: () => `Silent Luxury`, tags: ["silent", "minimal", "luxury"], collections: ["silent"], garmentFit: CHEST,
    mutate: (b, v, s) => ({ ...b, negativeSpace: lerp(s, v, 0.52, 0.68), spread: lerp(s, v + 1, 0.4, 0.55) }),
  },
  {
    archetype: "Faith Editorial",
    base: layoutBase({
      hierarchy: "geometry-first", negativeSpace: 0.44, anchors: { focal: { rx: 0.5, ry: 0.38 }, type: { rx: 0.5, ry: 0.62 }, symbol: { rx: 0.5, ry: 0.35 }, secondary: { rx: 0.12, ry: 0.5 } },
      balance: "radial", density: "moderate", movement: "radial", cropping: "circle-crop", layerOrder: "geometry-first", tension: 0.55, marginRatio: 0.1, spread: 0.65,
    }),
    variantCount: 16, name: () => `Faith Editorial`, tags: ["faith", "sacred", "vertical"], collections: ["faith"], garmentFit: ALL,
    mutate: (b, v, s) => ({ ...b, movement: v % 2 === 0 ? "radial" : "editorial-flow" }),
  },
  {
    archetype: "Architectural",
    base: layoutBase({
      hierarchy: "geometry-first", negativeSpace: 0.46, anchors: { focal: { rx: 0.5, ry: 0.4 }, type: { rx: 0.5, ry: 0.6 }, symbol: { rx: 0.5, ry: 0.38 } },
      balance: "symmetric", density: "moderate", movement: "static", cropping: "partial-frame", layerOrder: "geometry-first", tension: 0.52, marginRatio: 0.1, spread: 0.68,
    }),
    variantCount: 16, name: () => `Architectural`, tags: ["architectural", "frame", "structure"], collections: ["architect"], garmentFit: ALL,
    mutate: (b, v, s) => ({ ...b, balance: v % 3 === 0 ? "broken" : "asymmetric", tension: lerp(s, v, 0.45, 0.65) }),
  },
  {
    archetype: "Campaign Poster",
    base: layoutBase({
      hierarchy: "type-first", negativeSpace: 0.35, anchors: { focal: { rx: 0.46, ry: 0.36 }, type: { rx: 0.46, ry: 0.58 }, symbol: { rx: 0.54, ry: 0.34 } },
      balance: "asymmetric", density: "rich", movement: "cascade", cropping: "edge-bleed", layerOrder: "type-first", tension: 0.78, marginRatio: 0.06, spread: 0.85,
    }),
    variantCount: 16, name: () => `Campaign Poster`, tags: ["campaign", "poster", "bold"], collections: ["editorial", "season"], garmentFit: OVERSIZED,
    mutate: (b, v, s) => ({ ...b, density: v % 2 === 0 ? "dense" : "rich", spread: lerp(s, v, 0.78, 0.92) }),
  },
  {
    archetype: "Broken Editorial",
    base: layoutBase({
      hierarchy: "type-first", negativeSpace: 0.4, anchors: { focal: { rx: 0.42, ry: 0.38 }, type: { rx: 0.58, ry: 0.55 }, symbol: { rx: 0.48, ry: 0.32 }, secondary: { rx: 0.82, ry: 0.72 } },
      balance: "broken", density: "moderate", movement: "diagonal", cropping: "hard-crop", layerOrder: "depth-interleaved", tension: 0.72, marginRatio: 0.08, spread: 0.75,
    }),
    variantCount: 16, name: () => `Broken Editorial`, tags: ["broken", "offset", "editorial"], collections: ["editorial", "capsule"], garmentFit: OVERSIZED,
    mutate: (b, v, s) => ({ ...b, anchors: { focal: { rx: lerp(s, v, 0.35, 0.48), ry: lerp(s, v + 1, 0.32, 0.42) }, type: { rx: lerp(s, v + 2, 0.52, 0.65), ry: lerp(s, v + 3, 0.5, 0.62) }, symbol: { rx: lerp(s, v + 4, 0.44, 0.54), ry: lerp(s, v + 5, 0.28, 0.36) } } }),
  },
  {
    archetype: "Split Composition",
    base: layoutBase({
      hierarchy: "balanced", negativeSpace: 0.45, anchors: { focal: { rx: 0.35, ry: 0.42 }, type: { rx: 0.65, ry: 0.42 }, symbol: { rx: 0.5, ry: 0.38 } },
      balance: "asymmetric", density: "moderate", movement: "sweep", cropping: "partial-frame", layerOrder: "depth-interleaved", tension: 0.6, marginRatio: 0.09, spread: 0.7,
    }),
    variantCount: 16, name: () => `Split Composition`, tags: ["split", "dual-zone"], collections: ["editorial", "capsule"], garmentFit: ALL,
    mutate: (b, v, s) => ({ ...b, anchors: { ...b.anchors, focal: { rx: lerp(s, v, 0.28, 0.4), ry: b.anchors.focal.ry }, type: { rx: lerp(s, v + 1, 0.58, 0.72), ry: b.anchors.type.ry } } }),
  },
  {
    archetype: "Offset Composition",
    base: layoutBase({
      hierarchy: "type-first", negativeSpace: 0.47, anchors: { focal: { rx: 0.58, ry: 0.4 }, type: { rx: 0.62, ry: 0.58 }, symbol: { rx: 0.52, ry: 0.35 } },
      balance: "asymmetric", density: "sparse", movement: "editorial-flow", cropping: "none", layerOrder: "type-first", tension: 0.55, marginRatio: 0.11, spread: 0.62,
    }),
    variantCount: 16, name: () => `Offset Composition`, tags: ["offset", "asymmetric"], collections: ["silent", "museum"], garmentFit: CHEST,
    mutate: (b, v, s) => ({ ...b, anchors: { ...b.anchors, focal: { rx: lerp(s, v, 0.52, 0.65), ry: lerp(s, v + 1, 0.35, 0.45) } } }),
  },
  {
    archetype: "Diagonal Composition",
    base: layoutBase({
      hierarchy: "geometry-first", negativeSpace: 0.4, anchors: { focal: { rx: 0.38, ry: 0.32 }, type: { rx: 0.62, ry: 0.58 }, symbol: { rx: 0.45, ry: 0.38 }, secondary: { rx: 0.72, ry: 0.22 } },
      balance: "asymmetric", density: "moderate", movement: "diagonal", cropping: "edge-bleed", layerOrder: "geometry-first", tension: 0.68, marginRatio: 0.08, spread: 0.78,
    }),
    variantCount: 16, name: () => `Diagonal Composition`, tags: ["diagonal", "movement"], collections: ["editorial", "season"], garmentFit: OVERSIZED,
    mutate: (b, v, s) => ({ ...b, movement: "diagonal", tension: lerp(s, v, 0.58, 0.78) }),
  },
  {
    archetype: "Layered Composition",
    base: layoutBase({
      hierarchy: "balanced", negativeSpace: 0.42, anchors: { focal: { rx: 0.5, ry: 0.4 }, type: { rx: 0.5, ry: 0.55 }, symbol: { rx: 0.5, ry: 0.38 }, secondary: { rx: 0.28, ry: 0.65 } },
      balance: "optical", density: "rich", movement: "cascade", cropping: "partial-frame", layerOrder: "depth-interleaved", tension: 0.65, marginRatio: 0.09, spread: 0.74,
    }),
    variantCount: 16, name: () => `Layered Composition`, tags: ["layered", "depth"], collections: ["editorial", "architect"], garmentFit: ALL,
    mutate: (b, v, s) => ({ ...b, layerOrder: v % 2 === 0 ? "depth-interleaved" : "ornament-accent" }),
  },
  {
    archetype: "Negative Space Composition",
    base: layoutBase({
      hierarchy: "balanced", negativeSpace: 0.62, anchors: { focal: { rx: 0.5, ry: 0.42 }, type: { rx: 0.5, ry: 0.58 }, symbol: { rx: 0.5, ry: 0.4 } },
      balance: "optical", density: "sparse", movement: "static", cropping: "none", layerOrder: "negative-space-dominant", tension: 0.42, marginRatio: 0.15, spread: 0.45,
    }),
    variantCount: 16, name: () => `Negative Space`, tags: ["negative-space", "void", "luxury"], collections: ["silent", "museum"], garmentFit: CHEST,
    mutate: (b, v, s) => ({ ...b, negativeSpace: lerp(s, v, 0.55, 0.72), spread: lerp(s, v + 1, 0.38, 0.52) }),
  },
  {
    archetype: "Floating Composition",
    base: layoutBase({
      hierarchy: "geometry-first", negativeSpace: 0.5, anchors: { focal: { rx: 0.5, ry: 0.45 }, type: { rx: 0.5, ry: 0.62 }, symbol: { rx: 0.5, ry: 0.42 }, secondary: { rx: 0.15, ry: 0.2 } },
      balance: "asymmetric", density: "sparse", movement: "sweep", cropping: "none", layerOrder: "ornament-accent", tension: 0.48, marginRatio: 0.12, spread: 0.58,
    }),
    variantCount: 16, name: () => `Floating Composition`, tags: ["floating", "isolated"], collections: ["silent", "capsule"], garmentFit: CHEST,
    mutate: (b, v, s) => ({ ...b, anchors: { ...b.anchors, secondary: { rx: lerp(s, v, 0.1, 0.22), ry: lerp(s, v + 1, 0.12, 0.28) } } }),
  },
  {
    archetype: "Frame Composition",
    base: layoutBase({
      hierarchy: "geometry-first", negativeSpace: 0.44, anchors: { focal: { rx: 0.5, ry: 0.42 }, type: { rx: 0.5, ry: 0.58 }, symbol: { rx: 0.5, ry: 0.4 } },
      balance: "symmetric", density: "moderate", movement: "static", cropping: "partial-frame", layerOrder: "geometry-first", tension: 0.5, marginRatio: 0.1, spread: 0.7,
    }),
    variantCount: 16, name: () => `Frame Composition`, tags: ["frame", "border", "architectural"], collections: ["architect", "museum"], garmentFit: ALL,
    mutate: (b, v, s) => ({ ...b, cropping: v % 2 === 0 ? "partial-frame" : "hard-crop" }),
  },
  {
    archetype: "Minimal Luxury",
    base: layoutBase({
      hierarchy: "balanced", negativeSpace: 0.55, anchors: { focal: { rx: 0.5, ry: 0.44 }, type: { rx: 0.5, ry: 0.56 }, symbol: { rx: 0.5, ry: 0.42 } },
      balance: "optical", density: "sparse", movement: "static", cropping: "none", layerOrder: "negative-space-dominant", tension: 0.4, marginRatio: 0.13, spread: 0.5,
    }),
    variantCount: 16, name: () => `Minimal Luxury`, tags: ["minimal", "luxury", "restraint"], collections: ["silent", "capsule"], garmentFit: CHEST,
    mutate: (b, v, s) => ({ ...b, negativeSpace: lerp(s, v, 0.5, 0.65) }),
  },
  {
    archetype: "Asymmetric Composition",
    base: layoutBase({
      hierarchy: "type-first", negativeSpace: 0.43, anchors: { focal: { rx: 0.56, ry: 0.38 }, type: { rx: 0.6, ry: 0.56 }, symbol: { rx: 0.48, ry: 0.34 }, secondary: { rx: 0.18, ry: 0.7 } },
      balance: "asymmetric", density: "moderate", movement: "editorial-flow", cropping: "edge-bleed", layerOrder: "type-first", tension: 0.64, marginRatio: 0.09, spread: 0.72,
    }),
    variantCount: 16, name: () => `Asymmetric Composition`, tags: ["asymmetric", "offset", "editorial"], collections: ["editorial", "season"], garmentFit: OVERSIZED,
    mutate: (b, v, s) => ({ ...b, balance: "asymmetric", tension: lerp(s, v, 0.55, 0.75) }),
  },
  {
    archetype: "Wrap Composition",
    base: layoutBase({
      hierarchy: "balanced", negativeSpace: 0.4, anchors: { focal: { rx: 0.5, ry: 0.4 }, type: { rx: 0.5, ry: 0.6 }, symbol: { rx: 0.5, ry: 0.38 }, secondary: { rx: 0.08, ry: 0.5 } },
      balance: "asymmetric", density: "moderate", movement: "sweep", cropping: "edge-bleed", layerOrder: "depth-interleaved", tension: 0.58, marginRatio: 0.07, spread: 0.8,
    }),
    variantCount: 16, name: () => `Wrap Composition`, tags: ["wrap", "full-coverage"], collections: ["season", "capsule"], garmentFit: OVERSIZED,
    mutate: (b, v, s) => ({ ...b, spread: lerp(s, v, 0.75, 0.9) }),
  },
];

export const LAYOUT_ARCHETYPE_COUNT = ARCHETYPES.length;
export const LAYOUT_VARIANTS_PER_ARCHETYPE = 16;
export const LAYOUT_RECIPE_TARGET = LAYOUT_ARCHETYPE_COUNT * LAYOUT_VARIANTS_PER_ARCHETYPE;

export function buildAllLayoutRecipes(seed = 0): LayoutRecipe[] {
  return ARCHETYPES.flatMap((a) => expandArchetype<LayoutRecipe>(a, seed));
}
