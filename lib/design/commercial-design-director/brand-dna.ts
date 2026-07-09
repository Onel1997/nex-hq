import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";

export interface BrandDnaAssessment {
  feelsLikeMilaene: boolean;
  strengthensCollection: boolean;
  fitsPreviousDrops: boolean;
  recognizableDesignLanguage: boolean;
  score: number;
  signals: string[];
  gaps: string[];
}

const MILAENE_PALETTE = ["#0a0a0a", "#1a1a1a", "#e8e4dc", "#8a8580", "#f5f2eb", "#2a2a2a"];
const MILAENE_MOODS = [
  "calm",
  "luxury",
  "urban",
  "editorial",
  "minimal",
  "reflection",
  "quiet",
  "street",
  "culture",
  "scarcity",
];
const MILAENE_SILHOUETTES = ["oversized", "boxy", "wide-leg", "structured"];

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function textSignalsMilaene(text: string): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const mood of MILAENE_MOODS) {
    if (lower.includes(mood)) hits += 1;
  }
  if (lower.includes("negative space")) hits += 2;
  if (lower.includes("limited")) hits += 1;
  if (lower.includes("drop")) hits += 1;
  return hits;
}

function paletteAligns(brief: DesignStudioBrief): boolean {
  const hexes = brief.colorPalette
    .map((c) => c.hex?.toLowerCase())
    .filter(Boolean) as string[];
  if (!hexes.length) return true;
  return hexes.some((hex) =>
    MILAENE_PALETTE.some((brand) => colorDistance(hex, brand) < 0.35),
  );
}

function colorDistance(a: string, b: string): number {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const dr = (ar - br) / 255;
  const dg = (ag - bg) / 255;
  const db = (ab - bb) / 255;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Does this design reinforce Milaene — not random graphics? */
export function evaluateBrandDna(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): BrandDnaAssessment {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 52;

  const conceptHits = textSignalsMilaene(
    `${brief.visualConcept} ${brief.designDescription} ${brief.negativeSpaceRules}`,
  );
  score += Math.min(18, conceptHits * 4);
  if (conceptHits >= 3) signals.push("concept language aligns with calm luxury streetwear");

  if (paletteAligns(brief)) {
    score += 12;
    signals.push("palette sits within Milaene obsidian / off-white / stone range");
  } else {
    gaps.push("palette drifts outside core Milaene colors");
    score -= 8;
  }

  const silhouetteFit = MILAENE_SILHOUETTES.some((s) => brief.product.toLowerCase().includes(s));
  if (silhouetteFit) {
    score += 10;
    signals.push("product silhouette matches Milaene oversized / boxy range");
  }

  if ((brief.dnaScore ?? 0) >= 75) {
    score += 10;
    signals.push("research DNA score supports collection identity");
  } else if (brief.dnaScore !== undefined && brief.dnaScore < 65) {
    gaps.push("DNA score suggests weak collection identity fit");
    score -= 6;
  }

  if (spec.style.id.includes("minimal") || spec.style.id.includes("editorial")) {
    score += 8;
    signals.push("style system reads editorial-minimal — on-brand");
  }

  if (spec.template.id === "technical-blueprint") {
    gaps.push("blueprint template risks off-brand construction-diagram feel");
    score -= 12;
  }

  if (brief.designerInstructions.some((i) => i.toLowerCase().includes("neon"))) {
    gaps.push("neon instructions conflict with Milaene palette restraint");
    score -= 10;
  }

  const negativeSpace = brief.negativeSpaceRules.toLowerCase().includes("negative") ||
    brief.negativeSpaceRules.toLowerCase().includes("breathing");
  if (negativeSpace) {
    score += 6;
    signals.push("negative space rules support quiet luxury positioning");
  }

  score = clamp(score);

  return {
    feelsLikeMilaene: score >= 72,
    strengthensCollection: (brief.dnaScore ?? score) >= 70 && score >= 68,
    fitsPreviousDrops: score >= 65 && paletteAligns(brief),
    recognizableDesignLanguage:
      score >= 74 && (spec.style.id.includes("editorial") || spec.style.id.includes("minimal")),
    score,
    signals,
    gaps,
  };
}
