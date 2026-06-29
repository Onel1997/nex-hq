import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  CreativeComposition,
  EmotionalDirection,
  LayoutFamily,
  StreetwearCategory,
  StyleFamily,
  SymmetryMode,
  VisualHierarchy,
} from "@/lib/design/engine/types";
import { detectLayoutFamily } from "@/lib/design/engine/layout/registry";
import { hashString, pick, range } from "@/lib/design/vector-engine/hash";

function detectStyleFamily(brief: DesignStudioBrief, seed: number): StyleFamily {
  const text = [
    brief.visualConcept,
    brief.designDescription,
    brief.typography,
    brief.materialEffects,
    brief.geometry,
    brief.role,
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("swiss") || text.includes("helvetica") || text.includes("grid type")) return "swiss-typography";
  if (text.includes("scandinavian") || text.includes("nordic")) return "scandinavian-minimal";
  if (text.includes("technical") || text.includes("schematic") || text.includes("utility")) return "technical-streetwear";
  if (text.includes("avant") || text.includes("experimental")) return "avant-garde";
  if (text.includes("utility") || text.includes("workwear")) return "utility-wear";
  if (text.includes("japanese") || text.includes("wabi")) return "japanese-minimalism";
  if (text.includes("gothic") || text.includes("dark")) return "modern-gothic";
  if (text.includes("vintage") || text.includes("washed") || text.includes("faded")) return "vintage-washed";
  if (text.includes("faith") || text.includes("spiritual") || text.includes("sacred")) return "faith";
  if (text.includes("architect") || text.includes("structural") || text.includes("frame")) return "architectural";
  if (text.includes("silent") || text.includes("subtle") || text.includes("whisper")) return "silent-luxury";
  if (text.includes("editorial") || text.includes("fashion") || text.includes("runway")) return "editorial-fashion";
  if (text.includes("minimal") || text.includes("luxury") || text.includes("premium")) return "minimal-luxury";

  const fallbacks: StyleFamily[] = [
    "minimal-luxury",
    "silent-luxury",
    "editorial-fashion",
    "architectural",
    "vintage-washed",
  ];
  return pick(seed, 0, fallbacks);
}

function detectHierarchy(brief: DesignStudioBrief): VisualHierarchy {
  const typeText = brief.typography.toLowerCase();
  const geoText = `${brief.geometry} ${brief.visualConcept}`.toLowerCase();
  if (typeText.includes("no type") || typeText.includes("graphic only")) return "geometry-primary";
  if (typeText.includes("type-first") || typeText.includes("typographic") || typeText.includes("headline")) {
    return "typography-primary";
  }
  if (geoText.includes("symbol") || geoText.includes("mark only")) return "geometry-primary";
  return "balanced";
}

function detectEmotion(brief: DesignStudioBrief): EmotionalDirection {
  const text = `${brief.visualConcept} ${brief.designDescription} ${brief.role}`.toLowerCase();
  if (text.includes("faith") || text.includes("spiritual") || text.includes("sacred")) return "spiritual";
  if (text.includes("technical") || text.includes("schematic")) return "technical";
  if (text.includes("rebel") || text.includes("punk") || text.includes("raw")) return "rebellious";
  if (text.includes("quiet") || text.includes("silent") || text.includes("subtle")) return "quiet";
  return "confident";
}

function detectCategory(brief: DesignStudioBrief): StreetwearCategory {
  const role = brief.role.toLowerCase();
  if (role.includes("hero") || role.includes("statement")) return "statement";
  if (role.includes("type") || role.includes("wordmark")) return "typographic";
  if (role.includes("archive") || role.includes("vintage")) return "archive";
  if (role.includes("graphic") || role.includes("illustration")) return "graphic";
  return "essentials";
}

function detectSymmetry(style: StyleFamily, layout: LayoutFamily): SymmetryMode {
  if (layout === "split-layout" || layout === "corner-placement" || layout === "dual-print") return "asymmetric";
  if (style === "avant-garde" || style === "modern-gothic") return "asymmetric";
  if (style === "faith" || style === "architectural") return "radial";
  return "symmetric";
}

function luxuryLevel(brief: DesignStudioBrief, style: StyleFamily): 1 | 2 | 3 | 4 | 5 {
  const score = brief.printReadinessScore;
  const styleBoost =
    style === "silent-luxury" || style === "minimal-luxury" || style === "editorial-fashion" ? 1 : 0;
  const level = Math.min(5, Math.max(1, Math.round(score / 22) + styleBoost)) as 1 | 2 | 3 | 4 | 5;
  return level;
}

/** Decides visual hierarchy, rhythm, and emotional direction before any rendering. */
export function buildCreativeComposition(brief: DesignStudioBrief): CreativeComposition {
  const seed = hashString(
    [brief.designId, brief.geometry, brief.placement, ...brief.visualElements].join("|"),
  );
  const styleFamily = detectStyleFamily(brief, seed);
  const layoutFamily = detectLayoutFamily(brief.placement, brief.printArea, brief.role);
  const visualHierarchy = detectHierarchy(brief);
  const emotionalDirection = detectEmotion(brief);
  const streetwearCategory = detectCategory(brief);
  const symmetry = detectSymmetry(styleFamily, layoutFamily);
  const luxuryLevelVal = luxuryLevel(brief, styleFamily);

  const negativeSpaceRatio =
    0.18 +
    (visualHierarchy === "typography-primary" ? 0.12 : 0.06) +
    (emotionalDirection === "quiet" ? 0.1 : 0) +
    (styleFamily === "japanese-minimalism" || styleFamily === "silent-luxury" ? 0.08 : 0);

  const compositionRhythm = range(seed, 1, 0.85, 1.15);
  const visualWeight = range(seed, 2, 0.7, 1.0) * (luxuryLevelVal / 3);

  return {
    seed,
    styleFamily,
    layoutFamily,
    visualHierarchy,
    focalPoint: { x: 0, y: 0 },
    symmetry,
    emotionalDirection,
    luxuryLevel: luxuryLevelVal,
    streetwearCategory,
    negativeSpaceRatio: Math.min(0.45, negativeSpaceRatio),
    compositionRhythm,
    visualWeight,
    collectionTone: brief.campaignPotential ?? brief.role,
  };
}
