import { DESIGN_TOKENS } from "@/lib/design/vector-engine/tokens";
import type {
  HierarchyPreset,
  TrackingPreset,
  TypographySystemDefinition,
  TypographySystemId,
  WeightPreset,
} from "@/lib/design/design-library/types";

const DISPLAY = DESIGN_TOKENS.fonts.display;
const SANS = DESIGN_TOKENS.fonts.sans;

const TRACKING: Record<string, TrackingPreset> = {
  tight: { id: "tight", value: 0.08 },
  normal: { id: "normal", value: 0.28 },
  wide: { id: "wide", value: 0.48 },
  luxury: { id: "luxury", value: 0.55 },
  editorial: { id: "editorial", value: 0.62 },
};

const WEIGHTS: Record<string, WeightPreset> = {
  light: { id: "light", value: 300 },
  regular: { id: "regular", value: 400 },
  medium: { id: "medium", value: 500 },
  semibold: { id: "semibold", value: 600 },
};

const HIERARCHY: Record<string, HierarchyPreset> = {
  compact: { id: "compact", headlineScale: 0.88, subheadlineScale: 0.85, decorScale: 0.8 },
  standard: { id: "standard", headlineScale: 1, subheadlineScale: 1, decorScale: 1 },
  statement: { id: "statement", headlineScale: 1.18, subheadlineScale: 1.05, decorScale: 0.95 },
  oversized: { id: "oversized", headlineScale: 1.28, subheadlineScale: 1.1, decorScale: 0.9 },
};

export const TYPOGRAPHY_REGISTRY: Record<TypographySystemId, TypographySystemDefinition> = {
  "luxury-serif": {
    id: "luxury-serif",
    name: "Luxury Serif",
    fontFamily: DISPLAY,
    trackingPresets: [TRACKING.wide, TRACKING.luxury],
    weightPresets: [WEIGHTS.light, WEIGHTS.regular, WEIGHTS.medium],
    hierarchyPresets: [HIERARCHY.standard, HIERARCHY.compact],
    baselineRhythm: 1.05,
    supportedRoles: ["headline", "subheadline", "roman-numeral", "micro-label", "caption"],
  },
  "editorial-serif": {
    id: "editorial-serif",
    name: "Editorial Serif",
    fontFamily: DISPLAY,
    trackingPresets: [TRACKING.editorial, TRACKING.wide],
    weightPresets: [WEIGHTS.light, WEIGHTS.regular],
    hierarchyPresets: [HIERARCHY.statement, HIERARCHY.oversized],
    baselineRhythm: 1.12,
    supportedRoles: ["headline", "stacked-headline", "subheadline", "curved-text", "caption"],
  },
  "modern-sans": {
    id: "modern-sans",
    name: "Modern Sans",
    fontFamily: SANS,
    trackingPresets: [TRACKING.normal, TRACKING.wide],
    weightPresets: [WEIGHTS.regular, WEIGHTS.medium],
    hierarchyPresets: [HIERARCHY.standard, HIERARCHY.statement],
    baselineRhythm: 1.05,
    supportedRoles: ["headline", "subheadline", "coordinates", "collection-code", "caption"],
  },
  grotesk: {
    id: "grotesk",
    name: "Grotesk",
    fontFamily: SANS,
    trackingPresets: [TRACKING.tight, TRACKING.normal],
    weightPresets: [WEIGHTS.regular, WEIGHTS.medium, WEIGHTS.semibold],
    hierarchyPresets: [HIERARCHY.standard, HIERARCHY.compact],
    baselineRhythm: 1,
    supportedRoles: ["headline", "subheadline", "coordinates", "vertical-text", "micro-label"],
  },
  condensed: {
    id: "condensed",
    name: "Condensed",
    fontFamily: DISPLAY,
    trackingPresets: [TRACKING.tight, TRACKING.normal],
    weightPresets: [WEIGHTS.regular, WEIGHTS.medium],
    hierarchyPresets: [HIERARCHY.compact, HIERARCHY.standard],
    baselineRhythm: 0.95,
    supportedRoles: ["headline", "stacked-headline", "roman-numeral", "collection-code", "caption"],
  },
  extended: {
    id: "extended",
    name: "Extended",
    fontFamily: DISPLAY,
    trackingPresets: [TRACKING.wide, TRACKING.editorial],
    weightPresets: [WEIGHTS.light, WEIGHTS.regular],
    hierarchyPresets: [HIERARCHY.statement, HIERARCHY.oversized],
    baselineRhythm: 1.15,
    supportedRoles: ["headline", "stacked-headline", "subheadline", "curved-text"],
  },
};

export function getTypographySystem(id: TypographySystemId): TypographySystemDefinition {
  return TYPOGRAPHY_REGISTRY[id] ?? TYPOGRAPHY_REGISTRY["modern-sans"];
}
