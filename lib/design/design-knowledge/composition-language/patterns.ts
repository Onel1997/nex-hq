import type { KnowledgeRecipeMeta } from "@/lib/design/design-knowledge/types";
import { expandArchetype, lerp } from "@/lib/design/design-knowledge/shared/variant";

export interface CompositionPattern {
  id: string;
  meta: KnowledgeRecipeMeta;
  focalStrategy: "single-dominant" | "dual-hierarchy" | "scattered-accent";
  typeGeometryRatio: number;
  negativeSpaceMin: number;
  movementRequired: boolean;
  depthLayers: number;
  overlapRequired: boolean;
  asymmetryMin: number;
}

const FIT = ["oversized-front", "oversized-back", "center-chest"] as const;

function pat(p: Omit<CompositionPattern, "id" | "meta">): Omit<CompositionPattern, "id" | "meta"> {
  return p;
}

const ARCHETYPES: Parameters<typeof expandArchetype<CompositionPattern>>[0][] = [
  { archetype: "Editorial Cascade", base: pat({ focalStrategy: "dual-hierarchy", typeGeometryRatio: 0.62, negativeSpaceMin: 0.38, movementRequired: true, depthLayers: 3, overlapRequired: true, asymmetryMin: 0.12 }), variantCount: 12, name: () => "Editorial Cascade", tags: ["cascade"], collections: ["editorial"], garmentFit: [...FIT], mutate: (b, v, s) => ({ ...b, typeGeometryRatio: lerp(s, v, 0.55, 0.72) }) },
  { archetype: "Luxury Void", base: pat({ focalStrategy: "single-dominant", typeGeometryRatio: 0.48, negativeSpaceMin: 0.52, movementRequired: false, depthLayers: 2, overlapRequired: false, asymmetryMin: 0.08 }), variantCount: 12, name: () => "Luxury Void", tags: ["void"], collections: ["silent"], garmentFit: [...FIT], mutate: (b, v, s) => ({ ...b, negativeSpaceMin: lerp(s, v, 0.48, 0.65) }) },
  { archetype: "Campaign Impact", base: pat({ focalStrategy: "single-dominant", typeGeometryRatio: 0.7, negativeSpaceMin: 0.32, movementRequired: true, depthLayers: 4, overlapRequired: true, asymmetryMin: 0.15 }), variantCount: 12, name: () => "Campaign Impact", tags: ["campaign"], collections: ["season"], garmentFit: [...FIT], mutate: (b, v, s) => ({ ...b, typeGeometryRatio: lerp(s, v, 0.65, 0.78) }) },
  { archetype: "Faith Axis", base: pat({ focalStrategy: "dual-hierarchy", typeGeometryRatio: 0.45, negativeSpaceMin: 0.4, movementRequired: true, depthLayers: 3, overlapRequired: true, asymmetryMin: 0.1 }), variantCount: 12, name: () => "Faith Axis", tags: ["faith"], collections: ["faith"], garmentFit: [...FIT], mutate: (b) => ({ ...b, movementRequired: true }) },
  { archetype: "Museum Quiet", base: pat({ focalStrategy: "single-dominant", typeGeometryRatio: 0.5, negativeSpaceMin: 0.5, movementRequired: false, depthLayers: 2, overlapRequired: false, asymmetryMin: 0.1 }), variantCount: 12, name: () => "Museum Quiet", tags: ["museum"], collections: ["museum"], garmentFit: [...FIT], mutate: (b, v, s) => ({ ...b, negativeSpaceMin: lerp(s, v, 0.45, 0.58) }) },
  { archetype: "Architect Structure", base: pat({ focalStrategy: "dual-hierarchy", typeGeometryRatio: 0.4, negativeSpaceMin: 0.42, movementRequired: false, depthLayers: 3, overlapRequired: true, asymmetryMin: 0.12 }), variantCount: 12, name: () => "Architect Structure", tags: ["architect"], collections: ["architect"], garmentFit: [...FIT], mutate: (b, v, s) => ({ ...b, typeGeometryRatio: lerp(s, v, 0.35, 0.48) }) },
  { archetype: "Depth Interleave", base: pat({ focalStrategy: "dual-hierarchy", typeGeometryRatio: 0.55, negativeSpaceMin: 0.38, movementRequired: true, depthLayers: 5, overlapRequired: true, asymmetryMin: 0.14 }), variantCount: 12, name: () => "Depth Interleave", tags: ["depth"], collections: ["editorial"], garmentFit: [...FIT], mutate: (b, v, s) => ({ ...b, depthLayers: Math.round(lerp(s, v, 4, 6)) }) },
  { archetype: "Diagonal Flow", base: pat({ focalStrategy: "dual-hierarchy", typeGeometryRatio: 0.58, negativeSpaceMin: 0.36, movementRequired: true, depthLayers: 3, overlapRequired: true, asymmetryMin: 0.18 }), variantCount: 12, name: () => "Diagonal Flow", tags: ["diagonal"], collections: ["season"], garmentFit: [...FIT], mutate: (b, v, s) => ({ ...b, asymmetryMin: lerp(s, v, 0.14, 0.22) }) },
];

export const COMPOSITION_PATTERN_COUNT = ARCHETYPES.length * 12;

export function buildAllCompositionPatterns(seed = 0): CompositionPattern[] {
  return ARCHETYPES.flatMap((a) => expandArchetype<CompositionPattern>(a, seed));
}
