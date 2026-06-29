/**
 * Milaene Design Studio — local quality benchmark.
 * Run: npx tsx agents/design/verify-design-quality.ts
 *
 * Diagnostic only — no UI, no localStorage, no external APIs.
 */
import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { generateDesignSvgWithReview } from "@/lib/design/generate-design-svg";
import {
  COMMERCIAL_SCORE_DIMENSIONS,
  weakestCommercialDimensions,
  type CommercialScoreBreakdown,
  type CommercialScoreDimension,
} from "@/lib/design/commercial-design-director/commercial-score";
import { validateGeneratedSvg } from "@/lib/design/validate-svg";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURES: DesignStudioBrief[] = [
  {
    designId: "bench-hero-silent-axis",
    title: "Silent Axis",
    role: "Hero Piece",
    product: "Oversized Hoodie",
    color: "Washed Black",
    printArea: "Back",
    placement: "Oversized back print, centered vertical axis, 38cm x 48cm",
    dimensions: "380x480mm",
    visualConcept:
      "Architectural silence with interrupted geometry and editorial luxury tension",
    designDescription:
      "Multi-layer composition with structural symbols, roman numerals, and cropped headline typography overlapping the focal frame",
    geometry: "broken circle, vertical rules, interrupted arc, registration marks",
    visualElements: [
      "broken circle",
      "vertical rules",
      "cropped headline",
      "roman numeral",
    ],
    typography:
      "Stacked editorial headline with cropped offset subline and micro coordinates",
    colorPalette: [
      { name: "Washed Black", usage: "base garment", hex: "#1a1a1a" },
      { name: "Stone", usage: "print ink", hex: "#c8c4bc" },
    ],
    productionMethod: "Screen print, 2-color plastisol on premium fleece",
    materialEffects: "Vintage washed luxury fleece with soft hand feel",
    negativeSpaceRules:
      "Maintain 18% negative space around focal composition; avoid edge bleed",
    designerInstructions: [
      "Build apparel-scale hero artwork not logo mark",
      "Ensure typography overlaps symbol frame",
      "Use editorial cropping on headline",
    ],
    svgPrompt:
      "Premium streetwear oversized back print with architectural symbols and cropped editorial typography",
    mockupPrompt:
      "Milaene oversized hoodie back print editorial studio mockup washed black fleece",
    imagePrompt: "Faith collection editorial streetwear campaign",
    printReadinessScore: 88,
    dnaScore: 82,
    commercialScore: 79,
    campaignPotential: "High scroll-stop potential for drop campaign",
  },
  {
    designId: "bench-core-quiet-daily",
    title: "Quiet Daily",
    role: "Core Essential",
    product: "Oversized Tee",
    color: "Stone Grey",
    printArea: "Front",
    placement: "Center chest micro emblem, 12cm x 14cm",
    dimensions: "120x140mm",
    visualConcept:
      "Calm luxury restraint for daily rotation — subtle emblem with breathing room",
    designDescription:
      "Minimal chest composition with refined symbol mark, micro coordinates, and quiet editorial spacing for everyday wear",
    geometry: "micro emblem, thin rule line, coordinates",
    visualElements: ["micro emblem", "coordinates", "rule line"],
    typography: "Micro caps coordinates with subtle collection code",
    colorPalette: [
      { name: "Stone Grey", usage: "base garment", hex: "#8a8680" },
      { name: "Off White", usage: "print ink", hex: "#f0ede8" },
    ],
    productionMethod: "Screen print, single-color water-based ink",
    materialEffects: "Premium combed cotton with soft vintage wash",
    negativeSpaceRules: "Preserve 70% negative space; emblem must feel wearable daily",
    designerInstructions: [
      "Prioritize wearability over statement density",
      "Keep composition calm and rotation-friendly",
    ],
    svgPrompt:
      "Minimal luxury chest emblem with micro coordinates and quiet negative space",
    mockupPrompt:
      "Milaene oversized tee front chest micro print stone grey editorial flat lay",
    imagePrompt: "Quiet luxury daily essential streetwear",
    printReadinessScore: 84,
    dnaScore: 78,
    commercialScore: 76,
    campaignPotential: "Steady catalog essential",
  },
  {
    designId: "bench-statement-only-between-us",
    title: "Only Between Us",
    role: "Statement Piece",
    product: "Oversized Hoodie",
    color: "Deep Navy",
    printArea: "Back",
    placement: "Oversized back statement, 36cm x 44cm",
    dimensions: "360x440mm",
    visualConcept:
      "Intimate emotional tension — typography-led statement with editorial cropping",
    designDescription:
      "Layered headline typography with ghost offset, roman accent, and asymmetric frame for scroll-stop impact",
    geometry: "editorial frame, cropped headline stack, flank strikes",
    visualElements: ["cropped headline", "ghost offset", "editorial frame", "flank strikes"],
    typography:
      "Two-line statement headline with ghost layer, cropped edges, and micro subline",
    colorPalette: [
      { name: "Deep Navy", usage: "base garment", hex: "#1c2433" },
      { name: "Ivory", usage: "print ink", hex: "#f2efe6" },
    ],
    productionMethod: "Screen print, 2-color plastisol with vintage wash",
    materialEffects: "Premium fleece with subtle luxury vintage wash",
    negativeSpaceRules: "Typography must dominate focal zone with editorial tension",
    designerInstructions: [
      "Maximize scroll-stop typography hierarchy",
      "Build emotional intimacy through cropped type layers",
    ],
    svgPrompt:
      "Statement back print with layered cropped typography and editorial frame tension",
    mockupPrompt:
      "Milaene oversized hoodie back statement print deep navy editorial studio",
    imagePrompt: "Intimate editorial streetwear statement typography campaign",
    printReadinessScore: 86,
    dnaScore: 80,
    commercialScore: 81,
    campaignPotential: "High social feed scroll-stop",
  },
];

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

interface FixtureThresholds {
  overall?: number;
  emotionalImpact?: number;
  premiumFeeling?: number;
  typographyQuality?: number;
  wearability?: number;
  scrollStop?: boolean;
}

const THRESHOLDS: Record<string, FixtureThresholds> = {
  "Hero Piece": {
    overall: 90,
    emotionalImpact: 70,
    premiumFeeling: 78,
    typographyQuality: 80,
    wearability: 75,
  },
  "Core Essential": {
    overall: 82,
    wearability: 82,
    premiumFeeling: 75,
  },
  "Statement Piece": {
    overall: 86,
    scrollStop: true,
    typographyQuality: 78,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FixtureResult {
  brief: DesignStudioBrief;
  passed: boolean;
  failures: string[];
  svgValid: boolean;
  svgError?: string;
  template?: string;
  style?: string;
  score: CommercialScoreBreakdown;
  wouldBuy: boolean;
  wouldWear: boolean;
  scrollStop: boolean;
  weakest: CommercialScoreDimension[];
  iterations: number;
  approved: boolean;
}

function withSilencedLogs<T>(fn: () => T): T {
  const original = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = original;
  }
}

function resolveThresholds(role: string): FixtureThresholds {
  return THRESHOLDS[role] ?? { overall: 80 };
}

function evaluateFixture(brief: DesignStudioBrief): FixtureResult {
  const pipeline = withSilencedLogs(() =>
    generateDesignSvgWithReview(brief, { includeProductionGuides: true }),
  );

  const validation = validateGeneratedSvg(pipeline.svg, { includeProductionGuides: true });
  const score = pipeline.review.score;
  const psychology = pipeline.review.psychology;
  const critique = pipeline.review.critique;
  const thresholds = resolveThresholds(brief.role);
  const failures: string[] = [];

  if (!validation.valid) {
    failures.push(`SVG invalid: ${validation.error ?? "unknown error"}`);
  }

  if (thresholds.overall !== undefined && score.overall < thresholds.overall) {
    failures.push(`overall ${score.overall} < ${thresholds.overall}`);
  }
  if (
    thresholds.emotionalImpact !== undefined &&
    score.emotionalImpact < thresholds.emotionalImpact
  ) {
    failures.push(`emotionalImpact ${score.emotionalImpact} < ${thresholds.emotionalImpact}`);
  }
  if (
    thresholds.premiumFeeling !== undefined &&
    score.premiumFeeling < thresholds.premiumFeeling
  ) {
    failures.push(`premiumFeeling ${score.premiumFeeling} < ${thresholds.premiumFeeling}`);
  }
  if (
    thresholds.typographyQuality !== undefined &&
    score.typographyQuality < thresholds.typographyQuality
  ) {
    failures.push(`typographyQuality ${score.typographyQuality} < ${thresholds.typographyQuality}`);
  }
  if (thresholds.wearability !== undefined && score.wearability < thresholds.wearability) {
    failures.push(`wearability ${score.wearability} < ${thresholds.wearability}`);
  }
  if (thresholds.scrollStop === true && !critique.wouldStopScrolling) {
    failures.push("scrollStop = false (wouldStopScrolling)");
  }

  return {
    brief,
    passed: failures.length === 0,
    failures,
    svgValid: validation.valid,
    svgError: validation.error,
    template: pipeline.spec.template?.name ?? pipeline.spec.template?.id,
    style: pipeline.spec.style?.name ?? pipeline.spec.style?.id,
    score,
    wouldBuy: score.wouldBuy,
    wouldWear: critique.wouldWear,
    scrollStop: critique.wouldStopScrolling,
    weakest: weakestCommercialDimensions(score, 3),
    iterations: pipeline.iterations,
    approved: pipeline.approved,
  };
}

function printFixtureResult(result: FixtureResult): void {
  const { brief, score } = result;
  const weakestStr = result.weakest
    .map((dim) => `${dim}=${score[dim]}`)
    .join(", ");

  console.log("");
  console.log("─".repeat(64));
  console.log(`Fixture: ${brief.title}`);
  console.log(`  role:              ${brief.role}`);
  console.log(`  title:             ${brief.title}`);
  console.log(`  template:          ${result.template ?? "n/a"}`);
  console.log(`  style:             ${result.style ?? "n/a"}`);
  console.log(`  svg validation:    ${result.svgValid ? "valid" : `INVALID — ${result.svgError}`}`);
  console.log(`  commercial overall: ${score.overall}`);
  console.log(`  wouldBuy:          ${result.wouldBuy}`);
  console.log(`  wouldWear:         ${result.wouldWear}`);
  console.log(`  scrollStop:        ${result.scrollStop}`);
  console.log(`  weakest 3:         ${weakestStr}`);
  console.log(`  revision iterations: ${result.iterations}`);
  console.log(`  status:            ${result.approved ? "APPROVED" : "NOT APPROVED"}`);
  console.log(`  benchmark:         ${result.passed ? "PASS" : "FAIL"}`);
  if (!result.passed) {
    for (const failure of result.failures) {
      console.log(`    ✗ ${failure}`);
    }
  }
}

function aggregateWeakestGlobal(results: FixtureResult[]): CommercialScoreDimension[] {
  const totals = new Map<CommercialScoreDimension, { sum: number; count: number }>();

  for (const dim of COMMERCIAL_SCORE_DIMENSIONS) {
    totals.set(dim, { sum: 0, count: 0 });
  }

  for (const result of results) {
    for (const dim of COMMERCIAL_SCORE_DIMENSIONS) {
      const entry = totals.get(dim)!;
      entry.sum += result.score[dim];
      entry.count += 1;
    }
  }

  return [...COMMERCIAL_SCORE_DIMENSIONS]
    .map((dim) => ({
      dim,
      avg: totals.get(dim)!.sum / totals.get(dim)!.count,
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map((entry) => entry.dim);
}

const ITERATION_RECOMMENDATIONS: Partial<Record<CommercialScoreDimension, string>> = {
  emotionalImpact: "Iteration 1 — Emotional Narrative Layer (brief mood → symbol/ornament/typo selection)",
  premiumFeeling: "Iteration 3 — Premium Feeling Pass (negative space, material restraint, ornament density)",
  typographyQuality: "Iteration 2 — Hero Typography Enrichment (ghost/cropped/offset layers, focal overlap)",
  wearability: "Iteration 4 — Wearability Calibration (logo-mark penalty vs. daily-rotation score)",
  luxury: "Iteration 3 — Premium Feeling Pass (luxury perception + material restraint)",
  compositionQuality: "Composition Intelligence tuning — asymmetric tension and focal hierarchy",
  shareability: "Iteration 1 — Emotional Narrative Layer (scroll-stop storytelling hooks)",
};

function recommendNextIteration(globalWeakest: CommercialScoreDimension[]): string {
  for (const dim of globalWeakest) {
    const rec = ITERATION_RECOMMENDATIONS[dim];
    if (rec) return rec;
  }
  return "Review commercial revision loop effectiveness and template selection weights";
}

function printSummary(results: FixtureResult[]): void {
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const globalWeakest = aggregateWeakestGlobal(results);
  const globalWeakestStr = globalWeakest
    .map((dim) => {
      const avg =
        results.reduce((sum, r) => sum + r.score[dim], 0) / results.length;
      return `${dim} (avg ${Math.round(avg)})`;
    })
    .join(", ");

  console.log("");
  console.log("═".repeat(64));
  console.log("BENCHMARK SUMMARY");
  console.log("═".repeat(64));
  console.log(`  passed:  ${passed.length}/${results.length} — ${passed.map((r) => r.brief.title).join(", ") || "none"}`);
  console.log(`  failed:  ${failed.length}/${results.length} — ${failed.map((r) => r.brief.title).join(", ") || "none"}`);
  console.log(`  weakest global dimensions: ${globalWeakestStr}`);
  console.log(`  recommended next iteration: ${recommendNextIteration(globalWeakest)}`);
  console.log("");
  console.log(`  overall benchmark: ${failed.length === 0 ? "PASS" : "FAIL"}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("Milaene Design Studio — Quality Benchmark");
  console.log(`Fixtures: ${FIXTURES.length}`);
  console.log(`Run at: ${new Date().toISOString()}`);

  const results = FIXTURES.map(evaluateFixture);
  for (const result of results) {
    printFixtureResult(result);
  }
  printSummary(results);

  if (results.some((r) => !r.passed)) {
    process.exitCode = 1;
  }
}

main();
