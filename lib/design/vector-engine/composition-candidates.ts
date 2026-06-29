import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { hashString } from "@/lib/design/vector-engine/hash";
import type {
  CompositionCandidate,
  CompositionCandidateId,
  CompositionId,
  HierarchyMode,
  PrintScaleMode,
} from "@/lib/design/vector-engine/types";

const CANDIDATE_FAMILIES: CompositionCandidate[] = [
  {
    id: "minimal-luxury-wordmark",
    name: "Minimal Luxury Wordmark",
    styleFamily: "minimal-luxury",
    layoutFamily: "center-chest",
    emotionalTone: "quiet confidence",
    negativeSpaceRatio: 0.42,
    visualWeight: 0.62,
    symmetry: "symmetric",
    printScale: "standard",
    typographySystem: {
      hierarchy: "type-first",
      headlineScale: 1.02,
      headlineYOffset: 0.04,
      trackingBoost: 0.14,
      includeSubHeadline: true,
      includeCoordinates: true,
      includeRomanNumeral: true,
      includeCapsuleCode: true,
      alignment: "center",
      scaleMode: "standard",
    },
    geometrySystem: {
      primaryKind: "minimal-symbol",
      secondaryKinds: ["ring"],
      scale: 0.34,
      yOffset: -0.1,
      includeDualArcs: true,
      includeMissingCenter: false,
      includeOuterFrame: false,
      includeBrokenCircle: false,
    },
    detailSystem: {
      microDetailCount: 4,
      includeFlankLines: false,
      includeMicroLines: true,
      includeCoordinateMarks: true,
      includeVerticalRules: false,
      includeCapsuleCode: true,
      includeSideRoman: true,
      includeEditorialRules: true,
    },
  },
  {
    id: "interrupted-arc-emblem",
    name: "Interrupted Arc Emblem",
    styleFamily: "silent-luxury",
    layoutFamily: "center-chest",
    emotionalTone: "refined restraint",
    negativeSpaceRatio: 0.38,
    visualWeight: 0.78,
    symmetry: "symmetric",
    printScale: "standard",
    typographySystem: {
      hierarchy: "balanced",
      headlineScale: 0.92,
      headlineYOffset: 0.14,
      trackingBoost: 0.1,
      includeSubHeadline: true,
      includeCoordinates: true,
      includeRomanNumeral: true,
      includeCapsuleCode: true,
      alignment: "center",
      scaleMode: "standard",
    },
    geometrySystem: {
      primaryKind: "arc",
      secondaryKinds: ["ring", "broken-circle"],
      scale: 0.58,
      yOffset: -0.06,
      includeDualArcs: true,
      includeMissingCenter: true,
      includeOuterFrame: true,
      includeBrokenCircle: false,
    },
    detailSystem: {
      microDetailCount: 5,
      includeFlankLines: true,
      includeMicroLines: true,
      includeCoordinateMarks: true,
      includeVerticalRules: true,
      includeCapsuleCode: true,
      includeSideRoman: true,
      includeEditorialRules: false,
    },
  },
  {
    id: "editorial-back-print",
    name: "Editorial Back Print",
    styleFamily: "editorial-fashion",
    layoutFamily: "oversized-back",
    emotionalTone: "runway editorial",
    negativeSpaceRatio: 0.28,
    visualWeight: 0.92,
    symmetry: "symmetric",
    printScale: "oversized",
    typographySystem: {
      hierarchy: "type-first",
      headlineScale: 1.18,
      headlineYOffset: 0.08,
      trackingBoost: 0.08,
      includeSubHeadline: true,
      includeCoordinates: true,
      includeRomanNumeral: false,
      includeCapsuleCode: true,
      alignment: "center",
      scaleMode: "oversized",
    },
    geometrySystem: {
      primaryKind: "frame",
      secondaryKinds: ["parallel-lines", "rectangle"],
      scale: 0.52,
      yOffset: -0.08,
      includeDualArcs: false,
      includeMissingCenter: false,
      includeOuterFrame: true,
      includeBrokenCircle: false,
    },
    detailSystem: {
      microDetailCount: 6,
      includeFlankLines: true,
      includeMicroLines: true,
      includeCoordinateMarks: true,
      includeVerticalRules: true,
      includeCapsuleCode: true,
      includeSideRoman: false,
      includeEditorialRules: true,
    },
  },
  {
    id: "asymmetric-chest-mark",
    name: "Asymmetric Chest Mark",
    styleFamily: "avant-garde",
    layoutFamily: "asymmetrical",
    emotionalTone: "off-center tension",
    negativeSpaceRatio: 0.4,
    visualWeight: 0.68,
    symmetry: "asymmetric",
    printScale: "standard",
    typographySystem: {
      hierarchy: "balanced",
      headlineScale: 0.88,
      headlineYOffset: 0.12,
      trackingBoost: 0.12,
      includeSubHeadline: false,
      includeCoordinates: true,
      includeRomanNumeral: true,
      includeCapsuleCode: false,
      alignment: "asymmetric",
      scaleMode: "standard",
    },
    geometrySystem: {
      primaryKind: "broken-circle",
      secondaryKinds: ["arc", "minimal-symbol"],
      scale: 0.48,
      yOffset: -0.04,
      includeDualArcs: true,
      includeMissingCenter: true,
      includeOuterFrame: false,
      includeBrokenCircle: true,
    },
    detailSystem: {
      microDetailCount: 4,
      includeFlankLines: true,
      includeMicroLines: false,
      includeCoordinateMarks: true,
      includeVerticalRules: false,
      includeCapsuleCode: false,
      includeSideRoman: true,
      includeEditorialRules: false,
    },
  },
  {
    id: "oversized-typography-print",
    name: "Oversized Typography Print",
    styleFamily: "editorial-fashion",
    layoutFamily: "oversized-front",
    emotionalTone: "bold statement",
    negativeSpaceRatio: 0.22,
    visualWeight: 0.95,
    symmetry: "symmetric",
    printScale: "oversized",
    typographySystem: {
      hierarchy: "type-first",
      headlineScale: 1.24,
      headlineYOffset: 0.02,
      trackingBoost: 0.06,
      includeSubHeadline: true,
      includeCoordinates: false,
      includeRomanNumeral: false,
      includeCapsuleCode: true,
      alignment: "center",
      scaleMode: "oversized",
    },
    geometrySystem: {
      primaryKind: "parallel-lines",
      secondaryKinds: ["frame"],
      scale: 0.42,
      yOffset: -0.14,
      includeDualArcs: false,
      includeMissingCenter: false,
      includeOuterFrame: false,
      includeBrokenCircle: false,
    },
    detailSystem: {
      microDetailCount: 3,
      includeFlankLines: false,
      includeMicroLines: true,
      includeCoordinateMarks: false,
      includeVerticalRules: true,
      includeCapsuleCode: true,
      includeSideRoman: false,
      includeEditorialRules: true,
    },
  },
  {
    id: "quiet-luxury-micro-mark",
    name: "Quiet Luxury Micro Mark",
    styleFamily: "silent-luxury",
    layoutFamily: "minimal",
    emotionalTone: "whispered luxury",
    negativeSpaceRatio: 0.48,
    visualWeight: 0.42,
    symmetry: "symmetric",
    printScale: "micro",
    typographySystem: {
      hierarchy: "geometry-first",
      headlineScale: 0.72,
      headlineYOffset: 0.18,
      trackingBoost: 0.18,
      includeSubHeadline: false,
      includeCoordinates: true,
      includeRomanNumeral: true,
      includeCapsuleCode: true,
      alignment: "center",
      scaleMode: "micro",
    },
    geometrySystem: {
      primaryKind: "ring",
      secondaryKinds: ["minimal-symbol"],
      scale: 0.28,
      yOffset: -0.08,
      includeDualArcs: true,
      includeMissingCenter: true,
      includeOuterFrame: false,
      includeBrokenCircle: false,
    },
    detailSystem: {
      microDetailCount: 3,
      includeFlankLines: false,
      includeMicroLines: true,
      includeCoordinateMarks: true,
      includeVerticalRules: false,
      includeCapsuleCode: true,
      includeSideRoman: true,
      includeEditorialRules: false,
    },
  },
  {
    id: "architectural-frame-layout",
    name: "Architectural Frame Layout",
    styleFamily: "architectural",
    layoutFamily: "center-chest",
    emotionalTone: "structural calm",
    negativeSpaceRatio: 0.36,
    visualWeight: 0.74,
    symmetry: "symmetric",
    printScale: "standard",
    typographySystem: {
      hierarchy: "balanced",
      headlineScale: 0.94,
      headlineYOffset: 0.1,
      trackingBoost: 0.11,
      includeSubHeadline: true,
      includeCoordinates: true,
      includeRomanNumeral: true,
      includeCapsuleCode: true,
      alignment: "center",
      scaleMode: "standard",
    },
    geometrySystem: {
      primaryKind: "frame",
      secondaryKinds: ["rectangle", "parallel-lines"],
      scale: 0.54,
      yOffset: -0.05,
      includeDualArcs: false,
      includeMissingCenter: false,
      includeOuterFrame: true,
      includeBrokenCircle: false,
    },
    detailSystem: {
      microDetailCount: 5,
      includeFlankLines: true,
      includeMicroLines: true,
      includeCoordinateMarks: true,
      includeVerticalRules: true,
      includeCapsuleCode: true,
      includeSideRoman: false,
      includeEditorialRules: true,
    },
  },
  {
    id: "broken-circle-symbol",
    name: "Broken Circle Symbol",
    styleFamily: "modern-gothic",
    layoutFamily: "center-chest",
    emotionalTone: "fragmented poise",
    negativeSpaceRatio: 0.34,
    visualWeight: 0.8,
    symmetry: "radial",
    printScale: "standard",
    typographySystem: {
      hierarchy: "geometry-first",
      headlineScale: 0.86,
      headlineYOffset: 0.16,
      trackingBoost: 0.13,
      includeSubHeadline: true,
      includeCoordinates: true,
      includeRomanNumeral: true,
      includeCapsuleCode: true,
      alignment: "center",
      scaleMode: "standard",
    },
    geometrySystem: {
      primaryKind: "broken-circle",
      secondaryKinds: ["arc", "ring"],
      scale: 0.56,
      yOffset: -0.06,
      includeDualArcs: true,
      includeMissingCenter: true,
      includeOuterFrame: true,
      includeBrokenCircle: true,
    },
    detailSystem: {
      microDetailCount: 5,
      includeFlankLines: true,
      includeMicroLines: true,
      includeCoordinateMarks: true,
      includeVerticalRules: true,
      includeCapsuleCode: true,
      includeSideRoman: true,
      includeEditorialRules: false,
    },
  },
  {
    id: "technical-streetwear-layout",
    name: "Technical Streetwear Layout",
    styleFamily: "technical-streetwear",
    layoutFamily: "vertical",
    emotionalTone: "utility precision",
    negativeSpaceRatio: 0.3,
    visualWeight: 0.76,
    symmetry: "asymmetric",
    printScale: "standard",
    typographySystem: {
      hierarchy: "balanced",
      headlineScale: 0.9,
      headlineYOffset: 0.06,
      trackingBoost: 0.16,
      includeSubHeadline: true,
      includeCoordinates: true,
      includeRomanNumeral: true,
      includeCapsuleCode: true,
      alignment: "left",
      scaleMode: "standard",
    },
    geometrySystem: {
      primaryKind: "grid",
      secondaryKinds: ["cross", "parallel-lines"],
      scale: 0.5,
      yOffset: -0.04,
      includeDualArcs: false,
      includeMissingCenter: false,
      includeOuterFrame: true,
      includeBrokenCircle: false,
    },
    detailSystem: {
      microDetailCount: 6,
      includeFlankLines: true,
      includeMicroLines: true,
      includeCoordinateMarks: true,
      includeVerticalRules: true,
      includeCapsuleCode: true,
      includeSideRoman: true,
      includeEditorialRules: true,
    },
  },
  {
    id: "gallery-type-system",
    name: "Gallery Dept Inspired Type System",
    styleFamily: "vintage-washed",
    layoutFamily: "oversized-front",
    emotionalTone: "archive typography",
    negativeSpaceRatio: 0.26,
    visualWeight: 0.88,
    symmetry: "asymmetric",
    printScale: "oversized",
    typographySystem: {
      hierarchy: "type-first",
      headlineScale: 1.14,
      headlineYOffset: 0.0,
      trackingBoost: 0.05,
      includeSubHeadline: true,
      includeCoordinates: true,
      includeRomanNumeral: true,
      includeCapsuleCode: true,
      alignment: "asymmetric",
      scaleMode: "oversized",
    },
    geometrySystem: {
      primaryKind: "parallel-lines",
      secondaryKinds: ["frame", "rectangle"],
      scale: 0.38,
      yOffset: -0.12,
      includeDualArcs: false,
      includeMissingCenter: false,
      includeOuterFrame: false,
      includeBrokenCircle: false,
    },
    detailSystem: {
      microDetailCount: 4,
      includeFlankLines: false,
      includeMicroLines: true,
      includeCoordinateMarks: true,
      includeVerticalRules: true,
      includeCapsuleCode: true,
      includeSideRoman: true,
      includeEditorialRules: true,
    },
  },
];

function briefText(brief: DesignStudioBrief): string {
  return [
    brief.role,
    brief.placement,
    brief.printArea,
    brief.visualConcept,
    brief.designDescription,
    brief.geometry,
    brief.typography,
    brief.materialEffects,
    brief.negativeSpaceRules,
    ...brief.visualElements,
  ]
    .join(" ")
    .toLowerCase();
}

function detectHierarchy(text: string): HierarchyMode {
  if (text.includes("no type") || text.includes("graphic only") || text.includes("symbol only")) {
    return "geometry-first";
  }
  if (
    text.includes("type-first") ||
    text.includes("typographic") ||
    text.includes("wordmark") ||
    text.includes("headline")
  ) {
    return "type-first";
  }
  return "balanced";
}

function detectPrintScale(text: string): PrintScaleMode {
  if (text.includes("micro") || text.includes("subtle") || text.includes("small mark")) return "micro";
  if (text.includes("oversized") || text.includes("statement") || text.includes("full front")) return "oversized";
  return "standard";
}

function detectComposition(text: string): CompositionId {
  if (text.includes("asym") || text.includes("offset") || text.includes("off-center")) return "asymmetrical";
  if (text.includes("oversized") && text.includes("back")) return "oversized-back";
  if (text.includes("oversized") || text.includes("full front")) return "oversized-front";
  if (text.includes("vertical") || text.includes("stacked")) return "vertical";
  if (text.includes("minimal") || text.includes("micro")) return "minimal";
  if (text.includes("left chest")) return "left-chest";
  if (text.includes("upper chest")) return "upper-chest";
  return "center-chest";
}

function keywordScore(text: string, keywords: string[]): number {
  return keywords.reduce((sum, kw) => sum + (text.includes(kw) ? 1 : 0), 0);
}

export function generateCompositionCandidates(brief: DesignStudioBrief): CompositionCandidate[] {
  return CANDIDATE_FAMILIES.map((candidate) => ({ ...candidate }));
}

export function scoreCompositionCandidate(
  candidate: CompositionCandidate,
  brief: DesignStudioBrief,
): number {
  const text = briefText(brief);
  const hierarchy = detectHierarchy(text);
  const printScale = detectPrintScale(text);
  const composition = detectComposition(text);

  const styleKeywords: Record<CompositionCandidateId, string[]> = {
    "minimal-luxury-wordmark": ["minimal", "luxury", "premium", "wordmark", "clean"],
    "interrupted-arc-emblem": ["arc", "emblem", "ring", "orbital", "interrupted", "halo"],
    "editorial-back-print": ["editorial", "back", "runway", "fashion", "oversized back"],
    "asymmetric-chest-mark": ["asym", "offset", "off-center", "chest"],
    "oversized-typography-print": ["oversized", "statement", "bold", "typography", "headline"],
    "quiet-luxury-micro-mark": ["quiet", "silent", "micro", "subtle", "whisper"],
    "architectural-frame-layout": ["architect", "frame", "structural", "border", "grid"],
    "broken-circle-symbol": ["broken", "segment", "incomplete", "circle", "fragment"],
    "technical-streetwear-layout": ["technical", "utility", "schematic", "streetwear", "grid"],
    "gallery-type-system": ["vintage", "archive", "washed", "distressed", "type system"],
  };

  const briefAlignment = keywordScore(text, styleKeywords[candidate.id]) / 5;
  const styleFit = keywordScore(text, [candidate.styleFamily.replace(/-/g, " ")]) * 0.25 + 0.5;
  const layoutFit =
    candidate.layoutFamily === composition
      ? 1
      : candidate.layoutFamily.includes(composition.split("-")[0] ?? "")
        ? 0.7
        : 0.4;
  const hierarchyFit =
    candidate.typographySystem.hierarchy === hierarchy
      ? 1
      : candidate.typographySystem.hierarchy === "balanced" || hierarchy === "balanced"
        ? 0.75
        : 0.45;
  const negativeSpaceFit =
    1 -
    Math.abs(
      candidate.negativeSpaceRatio -
        (text.includes("negative space") || text.includes("breathing room") ? 0.4 : 0.28),
    );

  const printScaleFit = candidate.printScale === printScale ? 1 : candidate.printScale === "standard" ? 0.65 : 0.5;

  const total =
    briefAlignment * 0.28 +
    styleFit * 0.18 +
    layoutFit * 0.2 +
    hierarchyFit * 0.18 +
    negativeSpaceFit * 0.1 +
    printScaleFit * 0.06;

  candidate.scoreBreakdown = {
    briefAlignment,
    styleFit,
    layoutFit,
    hierarchyFit,
    negativeSpaceFit,
    total,
  };

  return total;
}

export function selectBestCompositionCandidate(brief: DesignStudioBrief): CompositionCandidate {
  const seed = hashString(
    [brief.designId, brief.geometry, brief.placement, ...brief.visualElements].join("|"),
  );
  const candidates = generateCompositionCandidates(brief);
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCompositionCandidate(candidate, brief),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));

  const topScore = scored[0]?.score ?? 0;
  const tied = scored.filter((entry) => Math.abs(entry.score - topScore) < 0.02);
  const selected = tied[seed % tied.length]?.candidate ?? scored[0]!.candidate;
  const score = selected.scoreBreakdown?.total ?? topScore;

  console.log(
    `[SVG ENGINE] Creative composition candidate selected: ${selected.name} score ${score.toFixed(2)}`,
  );

  return selected;
}
