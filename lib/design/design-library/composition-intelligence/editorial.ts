import type { PremiumTemplateLayoutConfig } from "@/lib/design/design-library/templates/premium/types";

export type EditorialMode =
  | "gallery-poster"
  | "luxury-editorial"
  | "museum-label"
  | "campaign-spread"
  | "technical-editorial"
  | "faith-editorial";

export interface EditorialProfile {
  mode: EditorialMode;
  /** Broken alignment tolerance */
  brokenAlignment: number;
  /** Cropped frame tendency */
  cropTendency: number;
  /** Edge tension — elements pushed toward edges */
  edgeTension: number;
  /** Editorial line weight */
  lineWeight: number;
  score: number;
}

const TEMPLATE_EDITORIAL: Record<string, EditorialMode> = {
  "luxury-editorial": "luxury-editorial",
  "gallery-poster": "gallery-poster",
  "museum-label": "museum-label",
  "fashion-campaign": "campaign-spread",
  "technical-luxury": "technical-editorial",
  "faith-collection": "faith-editorial",
  "architectural-frame": "luxury-editorial",
  "oversized-graphic": "gallery-poster",
  "silent-collection": "museum-label",
  "modern-minimal": "museum-label",
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function resolveEditorialProfile(layout: PremiumTemplateLayoutConfig): EditorialProfile {
  const mode = TEMPLATE_EDITORIAL[layout.id] ?? "luxury-editorial";

  let score = 58;
  score += layout.asymmetry * 80;
  score += layout.negativeSpaceBias * 35;
  if (layout.preferOversized) score += 8;

  return {
    mode,
    brokenAlignment: layout.asymmetry,
    cropTendency: layout.asymmetry * 0.8 + 0.1,
    edgeTension: layout.asymmetry * 0.6 + 0.15,
    lineWeight: mode === "technical-editorial" ? 0.35 : 0.55,
    score: clamp(score),
  };
}

export function resemblesConstructionDiagram(profile: EditorialProfile, elementDensity: number): boolean {
  if (profile.mode === "technical-editorial" && elementDensity > 12 && profile.brokenAlignment < 0.1) {
    return true;
  }
  return false;
}

export function resemblesLogo(profile: EditorialProfile, symmetryIndex: number): boolean {
  return symmetryIndex < 0.06 && profile.cropTendency < 0.15 && profile.edgeTension < 0.2;
}
