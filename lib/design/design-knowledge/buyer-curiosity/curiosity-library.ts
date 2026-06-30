import type { BuyerCuriosityPattern, CuriosityPatternId } from "@/lib/design/design-knowledge/buyer-curiosity/types";

export const BUYER_CURIOSITY_PATTERNS: BuyerCuriosityPattern[] = [
  {
    id: "scroll-stop-hook",
    name: "Scroll Stop Hook",
    dimensions: ["visualHook", "curiosity", "shareability"],
    visualHooks: [
      "cropped-hero-word",
      "partial-typography",
      "dominant-focal-point",
      "premium-tension",
    ],
    keywords: [
      "scroll-stop",
      "scroll stop",
      "cropped",
      "statement",
      "hero",
      "oversized",
      "editorial",
    ],
    styleBias: ["editorial-fashion", "modern-gothic", "architectural"],
    layoutBias: ["oversized-back", "oversized-front", "editorial-layout"],
    templateBias: ["oversized-graphic", "editorial-poster", "gallery-composition"],
    templateAvoid: ["minimal-emblem", "micro-graphic", "technical-blueprint"],
    rewards: ["one unforgettable focal point", "cropped hero typography", "premium tension"],
    penalties: ["large centered text", "safe layout", "template feeling"],
  },
  {
    id: "identity-pull",
    name: "Identity Pull",
    dimensions: ["identity", "desire", "recognizability"],
    visualHooks: ["dominant-focal-point", "unexpected-overlap", "premium-tension"],
    keywords: [
      "identity",
      "need this",
      "between us",
      "only",
      "intimate",
      "faith",
      "collection",
    ],
    styleBias: ["editorial-fashion", "faith", "minimal-luxury"],
    layoutBias: ["oversized-back", "symbol-above-type", "editorial-layout"],
    templateBias: ["faith-collection", "editorial-poster", "oversized-graphic"],
    templateAvoid: ["technical-blueprint", "luxury-wordmark"],
    rewards: ["identity expression", "I need this hoodie signal", "premium fashion feel"],
    penalties: ["nice graphic only", "generic editorial layout", "logo mark"],
  },
  {
    id: "mystery-gap",
    name: "Mystery Gap",
    dimensions: ["mystery", "curiosity", "visualHook"],
    visualHooks: ["partial-typography", "cropped-hero-word", "dramatic-whitespace"],
    keywords: ["mystery", "silence", "between", "quiet", "architectural", "interrupted"],
    styleBias: ["silent-luxury", "minimal-luxury", "architectural"],
    layoutBias: ["oversized-back", "gallery-layout", "editorial-layout"],
    templateBias: ["silent-collection", "gallery-composition", "oversized-graphic"],
    templateAvoid: ["technical-blueprint"],
    rewards: ["mystery", "emotional curiosity", "premium whitespace"],
    penalties: ["predictable symmetry", "visual noise", "cheap complexity"],
  },
  {
    id: "social-native",
    name: "Social Native",
    dimensions: ["shareability", "memorability", "recognizability"],
    visualHooks: ["dominant-focal-point", "cropped-hero-word", "unexpected-overlap"],
    keywords: ["campaign", "social", "instagram", "lookbook", "moodboard", "feed"],
    styleBias: ["editorial-fashion", "vintage-washed", "monochrome-luxury"],
    layoutBias: ["oversized-back", "oversized-front", "gallery-layout"],
    templateBias: ["editorial-poster", "oversized-graphic", "gallery-composition"],
    templateAvoid: ["minimal-emblem", "micro-graphic"],
    rewards: ["Instagram-ready focal", "lookbook compatibility", "memorable typography"],
    penalties: ["generic graphics", "multiple competing heroes"],
  },
  {
    id: "premium-restraint",
    name: "Premium Restraint",
    dimensions: ["premiumSimplicity", "luxuryRestraint", "desire"],
    visualHooks: ["dramatic-whitespace", "dominant-focal-point", "premium-tension"],
    keywords: ["restraint", "quiet", "luxury", "daily", "essential", "minimal", "breathing"],
    styleBias: ["silent-luxury", "minimal-luxury", "scandinavian-minimal", "monochrome-luxury"],
    layoutBias: ["micro-chest", "center-chest", "gallery-layout"],
    templateBias: ["minimal-emblem", "silent-collection", "micro-graphic"],
    templateAvoid: ["oversized-graphic", "editorial-poster"],
    rewards: ["premium restraint", "premium fashion feel", "one focal point"],
    penalties: ["visual noise", "clutter", "cheap complexity"],
  },
  {
    id: "unforgettable-focal",
    name: "Unforgettable Focal",
    dimensions: ["memorability", "visualHook", "desire"],
    visualHooks: [
      "unexpected-overlap",
      "dominant-focal-point",
      "partial-typography",
      "premium-tension",
    ],
    keywords: ["focal", "unforgettable", "layered", "ghost", "overlap", "tension"],
    styleBias: ["editorial-fashion", "architectural", "faith"],
    layoutBias: ["oversized-back", "editorial-layout", "wrap-composition"],
    templateBias: ["oversized-graphic", "faith-collection", "editorial-poster"],
    templateAvoid: ["luxury-wordmark", "technical-blueprint"],
    rewards: ["one unforgettable focal relationship", "memorable typography", "type-frame overlap"],
    penalties: ["generic editorial layout", "predictable symmetry", "safe layout"],
  },
];

export function getAllBuyerCuriosityPatterns(): BuyerCuriosityPattern[] {
  return BUYER_CURIOSITY_PATTERNS;
}

export function getBuyerCuriosityPattern(id: CuriosityPatternId): BuyerCuriosityPattern {
  const pattern = BUYER_CURIOSITY_PATTERNS.find((p) => p.id === id);
  if (!pattern) throw new Error(`Unknown buyer curiosity pattern: ${id}`);
  return pattern;
}
