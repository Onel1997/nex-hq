import type {
  DesignStyleId,
  LayoutId,
  OrnamentId,
  SymbolId,
  TemplateId,
} from "@/lib/design/design-library/types";
import type { GarmentPlacement } from "@/lib/design/design-knowledge/wearability/placement";

export type WearabilityPrincipleId =
  | "daily-rotation"
  | "luxury-restraint"
  | "visual-comfort"
  | "print-density"
  | "garment-balance"
  | "outfit-compatibility"
  | "premium-placement"
  | "distance-readability"
  | "timelessness"
  | "minimal-confidence";

export interface WearabilityPrinciple {
  id: WearabilityPrincipleId;
  name: string;
  description: string;
  /** Templates that embody this principle on fabric. */
  templateBias: TemplateId[];
  layoutBias: LayoutId[];
  styleBias: DesignStyleId[];
  ornamentPreferences: OrnamentId[];
  symbolPreferences: SymbolId[];
  /** Templates to avoid for this principle. */
  templateAvoid: TemplateId[];
  keywords: string[];
}

export const WEARABILITY_PRINCIPLES: WearabilityPrinciple[] = [
  {
    id: "daily-rotation",
    name: "Daily Rotation",
    description: "Would someone wear this weekly with black jeans, denim, or cargos?",
    templateBias: ["minimal-emblem", "micro-graphic", "silent-collection", "monochrome-symbol"],
    layoutBias: ["center-chest", "micro-chest", "symbol-above-type"],
    styleBias: ["minimal-luxury", "silent-luxury", "scandinavian-minimal", "monochrome-luxury"],
    ornamentPreferences: ["rule-lines", "micro-lines", "coordinates"],
    symbolPreferences: ["frame", "minimal-star", "diamond"],
    templateAvoid: ["editorial-poster", "technical-blueprint", "oversized-graphic"],
    keywords: ["daily", "rotation", "everyday", "essential", "quiet", "wearable", "subtle"],
  },
  {
    id: "luxury-restraint",
    name: "Luxury Restraint",
    description: "Less but better — remove one ornament, increase negative space.",
    templateBias: ["minimal-emblem", "silent-collection", "luxury-wordmark", "monochrome-symbol"],
    layoutBias: ["center-chest", "micro-chest", "gallery-layout"],
    styleBias: ["silent-luxury", "minimal-luxury", "monochrome-luxury", "scandinavian-minimal"],
    ornamentPreferences: ["rule-lines", "luxury-borders", "roman-ids"],
    symbolPreferences: ["frame", "broken-circle", "halo"],
    templateAvoid: ["technical-blueprint", "oversized-graphic"],
    keywords: ["restraint", "luxury", "premium", "calm", "breathing", "negative space", "refined"],
  },
  {
    id: "visual-comfort",
    name: "Visual Comfort",
    description: "Calm on the eye — no visual fatigue across multiple wears.",
    templateBias: ["silent-collection", "minimal-emblem", "gallery-composition"],
    layoutBias: ["center-chest", "gallery-layout", "floating-composition"],
    styleBias: ["silent-luxury", "scandinavian-minimal", "japanese-minimal"],
    ornamentPreferences: ["rule-lines", "vertical-rules"],
    symbolPreferences: ["halo", "broken-circle"],
    templateAvoid: ["technical-blueprint"],
    keywords: ["comfort", "calm", "soft", "gentle", "quiet", "understated"],
  },
  {
    id: "print-density",
    name: "Print Density",
    description: "Reject poster compositions — reward breathing room and focal hierarchy.",
    templateBias: ["minimal-emblem", "micro-graphic", "monochrome-symbol"],
    layoutBias: ["micro-chest", "center-chest", "symbol-above-type"],
    styleBias: ["minimal-luxury", "silent-luxury"],
    ornamentPreferences: ["rule-lines"],
    symbolPreferences: ["frame"],
    templateAvoid: ["editorial-poster", "technical-blueprint"],
    keywords: ["density", "clutter", "poster", "overfilled", "breathing", "hierarchy"],
  },
  {
    id: "garment-balance",
    name: "Garment Balance",
    description: "Composition proportional to garment zone — not a floating graphic.",
    templateBias: ["oversized-graphic", "faith-collection", "gallery-composition"],
    layoutBias: ["oversized-front", "oversized-back", "wrap-composition"],
    styleBias: ["editorial-fashion", "architectural", "faith"],
    ornamentPreferences: ["editorial-dividers", "flank-strikes", "vertical-rules"],
    symbolPreferences: ["broken-circle", "interrupted-arc", "frame"],
    templateAvoid: ["micro-graphic"],
    keywords: ["garment", "scale", "oversized", "back", "statement", "hero"],
  },
  {
    id: "outfit-compatibility",
    name: "Outfit Compatibility",
    description: "Works with premium streetwear silhouettes and neutral palettes.",
    templateBias: ["minimal-emblem", "editorial-poster", "oversized-graphic"],
    layoutBias: ["oversized-front", "oversized-back", "center-chest"],
    styleBias: ["editorial-fashion", "minimal-luxury", "vintage-washed"],
    ornamentPreferences: ["rule-lines", "flank-strikes"],
    symbolPreferences: ["broken-circle", "frame"],
    templateAvoid: ["technical-blueprint"],
    keywords: ["outfit", "versatile", "pairing", "wardrobe", "streetwear"],
  },
  {
    id: "premium-placement",
    name: "Premium Placement",
    description: "Placement-aware composition — chest restraint vs back density.",
    templateBias: ["minimal-emblem", "oversized-graphic", "editorial-poster"],
    layoutBias: ["center-chest", "oversized-back", "oversized-front", "micro-chest"],
    styleBias: ["minimal-luxury", "editorial-fashion", "silent-luxury"],
    ornamentPreferences: ["luxury-borders", "rule-lines", "coordinates"],
    symbolPreferences: ["frame", "broken-circle"],
    templateAvoid: [],
    keywords: ["placement", "chest", "back", "sleeve", "emblem", "print area"],
  },
  {
    id: "distance-readability",
    name: "Distance Readability",
    description: "Strong silhouette and hierarchy visible from 2–3 meters.",
    templateBias: ["oversized-graphic", "luxury-wordmark", "editorial-poster"],
    layoutBias: ["oversized-front", "oversized-back", "editorial-layout"],
    styleBias: ["editorial-fashion", "swiss-typography", "architectural"],
    ornamentPreferences: ["flank-strikes", "editorial-dividers"],
    symbolPreferences: ["frame", "broken-circle", "cross"],
    templateAvoid: ["micro-graphic"],
    keywords: ["readable", "distance", "silhouette", "bold", "statement", "headline"],
  },
  {
    id: "timelessness",
    name: "Timelessness",
    description: "Ages well across collections — not trend-graphic disposable.",
    templateBias: ["minimal-emblem", "gallery-composition", "faith-collection"],
    layoutBias: ["center-chest", "gallery-layout", "symbol-above-type"],
    styleBias: ["minimal-luxury", "architectural", "faith", "monochrome-luxury"],
    ornamentPreferences: ["roman-ids", "luxury-borders", "rule-lines"],
    symbolPreferences: ["frame", "sacred-geometry", "cross"],
    templateAvoid: ["technical-blueprint"],
    keywords: ["timeless", "classic", "archive", "museum", "enduring", "collection"],
  },
  {
    id: "minimal-confidence",
    name: "Minimal Confidence",
    description: "Understated premium — quiet mark that signals taste without shouting.",
    templateBias: ["minimal-emblem", "micro-graphic", "silent-collection"],
    layoutBias: ["micro-chest", "center-chest", "corner-print"],
    styleBias: ["silent-luxury", "minimal-luxury", "monochrome-luxury"],
    ornamentPreferences: ["coordinates", "micro-lines", "rule-lines"],
    symbolPreferences: ["minimal-star", "diamond", "frame"],
    templateAvoid: ["editorial-poster", "oversized-graphic"],
    keywords: ["minimal", "confidence", "quiet", "emblem", "micro", "understated"],
  },
];

export function getWearabilityPrinciple(id: WearabilityPrincipleId): WearabilityPrinciple | undefined {
  return WEARABILITY_PRINCIPLES.find((p) => p.id === id);
}

export function principlesForPlacement(placement: GarmentPlacement): WearabilityPrincipleId[] {
  switch (placement) {
    case "micro-emblem":
    case "left-chest":
    case "center-chest":
      return ["daily-rotation", "luxury-restraint", "minimal-confidence", "print-density"];
    case "oversized-back":
      return ["garment-balance", "distance-readability", "outfit-compatibility", "timelessness"];
    case "oversized-front":
      return ["garment-balance", "distance-readability", "premium-placement", "outfit-compatibility"];
    case "sleeve":
      return ["minimal-confidence", "luxury-restraint", "visual-comfort"];
    case "dual-print":
      return ["premium-placement", "garment-balance", "outfit-compatibility"];
    default:
      return ["daily-rotation", "luxury-restraint", "premium-placement"];
  }
}
