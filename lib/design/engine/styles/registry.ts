import type { StyleFamily, StyleProfile } from "@/lib/design/engine/types";

const BASE: Omit<StyleProfile, "family" | "productionMethod"> = {
  strokeHairline: 0.35,
  strokeThin: 0.6,
  strokeRegular: 1,
  trackingTight: 0.12,
  trackingNormal: 0.28,
  trackingWide: 0.48,
  headlineScale: 1,
  geometryScale: 1,
  negativeSpaceBias: 0.2,
  alignmentBias: "center",
};

const STYLES: Record<StyleFamily, Omit<StyleProfile, "family" | "productionMethod">> = {
  "minimal-luxury": {
    ...BASE,
    trackingWide: 0.52,
    headlineScale: 1.05,
    geometryScale: 0.88,
    negativeSpaceBias: 0.32,
    alignmentBias: "center",
    strokeHairline: 0.3,
  },
  "editorial-fashion": {
    ...BASE,
    trackingWide: 0.58,
    headlineScale: 1.15,
    geometryScale: 0.72,
    negativeSpaceBias: 0.28,
    alignmentBias: "optical",
    strokeThin: 0.5,
  },
  "silent-luxury": {
    ...BASE,
    trackingWide: 0.44,
    headlineScale: 0.92,
    geometryScale: 0.65,
    negativeSpaceBias: 0.38,
    strokeHairline: 0.25,
    strokeThin: 0.45,
  },
  architectural: {
    ...BASE,
    trackingNormal: 0.22,
    geometryScale: 1.12,
    negativeSpaceBias: 0.18,
    alignmentBias: "center",
    strokeRegular: 0.85,
  },
  faith: {
    ...BASE,
    trackingWide: 0.42,
    geometryScale: 0.95,
    negativeSpaceBias: 0.3,
    strokeThin: 0.55,
  },
  "vintage-washed": {
    ...BASE,
    trackingNormal: 0.32,
    geometryScale: 0.9,
    negativeSpaceBias: 0.22,
    strokeThin: 0.7,
  },
  "modern-gothic": {
    ...BASE,
    trackingTight: 0.08,
    trackingWide: 0.35,
    headlineScale: 1.1,
    geometryScale: 1.05,
    negativeSpaceBias: 0.15,
    strokeRegular: 1.2,
  },
  "japanese-minimalism": {
    ...BASE,
    trackingWide: 0.55,
    headlineScale: 0.88,
    geometryScale: 0.6,
    negativeSpaceBias: 0.42,
    strokeHairline: 0.28,
    alignmentBias: "optical",
  },
  "utility-wear": {
    ...BASE,
    trackingTight: 0.18,
    trackingNormal: 0.2,
    geometryScale: 1.08,
    negativeSpaceBias: 0.12,
    strokeRegular: 1.1,
    alignmentBias: "left",
  },
  "avant-garde": {
    ...BASE,
    trackingWide: 0.62,
    headlineScale: 1.2,
    geometryScale: 0.78,
    negativeSpaceBias: 0.35,
    alignmentBias: "optical",
  },
  "technical-streetwear": {
    ...BASE,
    trackingTight: 0.15,
    trackingNormal: 0.24,
    geometryScale: 1.15,
    negativeSpaceBias: 0.14,
    strokeThin: 0.55,
    alignmentBias: "left",
  },
  "scandinavian-minimal": {
    ...BASE,
    trackingWide: 0.5,
    headlineScale: 0.95,
    geometryScale: 0.7,
    negativeSpaceBias: 0.36,
    strokeHairline: 0.32,
  },
  "swiss-typography": {
    ...BASE,
    trackingTight: 0.06,
    trackingNormal: 0.14,
    headlineScale: 1.18,
    geometryScale: 0.55,
    negativeSpaceBias: 0.25,
    alignmentBias: "optical",
    strokeHairline: 0.4,
  },
};

export function resolveStyleProfile(
  family: StyleFamily,
  productionMethod: string,
): StyleProfile {
  const profile = STYLES[family] ?? STYLES["minimal-luxury"];
  return { ...profile, family, productionMethod };
}

export const ALL_STYLE_FAMILIES = Object.keys(STYLES) as StyleFamily[];
