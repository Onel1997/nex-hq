import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { CompositionOverrides, LibraryArtworkSpec, LibraryEngineOptions } from "@/lib/design/design-library/types";
import { composeFromBrief, enrichArtworkSpec } from "@/lib/design/design-library/composition/engine";
import { selectBestArtwork } from "@/lib/design/design-library/quality";
import { renderArtwork } from "@/lib/design/design-library/composition";
import { serializeVectorSvg } from "@/lib/design/vector-engine/serialize";
import {
  scoreCommercialDesign,
  passesCommercialGate,
  weakestCommercialDimensions,
  COMMERCIAL_APPROVAL_THRESHOLD,
} from "@/lib/design/commercial-design-director/commercial-score";
import { evaluateBuyerPsychology } from "@/lib/design/commercial-design-director/buyer-psychology";
import { evaluateBuyerCuriosity } from "@/lib/design/design-knowledge/buyer-curiosity";
import { evaluateBrandDna } from "@/lib/design/commercial-design-director/brand-dna";
import { evaluateStreetwearAppeal } from "@/lib/design/commercial-design-director/streetwear";
import { evaluateTrendFit } from "@/lib/design/commercial-design-director/trend-fit";
import { evaluateCollectionFit } from "@/lib/design/commercial-design-director/collection-fit";
import { evaluateCommercialTypography } from "@/lib/design/commercial-design-director/typography";
import { evaluateEmotionalImpact } from "@/lib/design/commercial-design-director/emotion";
import { buildDesignCritique, type DesignCritique } from "@/lib/design/commercial-design-director/critique";
import type { RevisionTask } from "@/lib/design/commercial-design-director/revision";
import {
  applyRevisionTasks,
  buildRevisionTasks,
  buildImageStudioRevisionBrief,
  selectRevisionOverrides,
  MAX_COMMERCIAL_REVISION_ITERATIONS,
} from "@/lib/design/commercial-design-director/revision";
import type { CommercialScoreBreakdown } from "@/lib/design/commercial-design-director/commercial-score";
import type { BuyerPsychologyProfile } from "@/lib/design/commercial-design-director/buyer-psychology";
import type { BrandDnaAssessment } from "@/lib/design/commercial-design-director/brand-dna";

export interface CommercialDesignReview {
  score: CommercialScoreBreakdown;
  psychology: BuyerPsychologyProfile;
  brandDna: BrandDnaAssessment;
  critique: DesignCritique;
  revisionTasks: RevisionTask[];
  iteration: number;
  approved: boolean;
}

export interface CommercialPipelineResult {
  svg: string;
  spec: LibraryArtworkSpec;
  review: CommercialDesignReview;
  iterations: number;
  approved: boolean;
  imageStudioBlueprint: string;
}

export interface CommercialDirectorInput {
  brief: DesignStudioBrief;
  spec: LibraryArtworkSpec;
  svg: string;
  iteration?: number;
}

function resolveArtworkSpec(
  brief: DesignStudioBrief,
  overrides?: CompositionOverrides,
): LibraryArtworkSpec {
  if (overrides) {
    return enrichArtworkSpec(composeFromBrief(brief, overrides));
  }
  return selectBestArtwork(brief);
}

function renderSvgFromSpec(
  spec: LibraryArtworkSpec,
  brief: DesignStudioBrief,
  options: LibraryEngineOptions,
): string {
  const { layers, defs } = renderArtwork(spec);
  return serializeVectorSvg({
    title: brief.title,
    designId: brief.designId,
    artboard: spec.artboard,
    layers,
    defs,
    includeProductionGuides: options.includeProductionGuides ?? true,
  });
}

function logCommercialReview(
  review: CommercialDesignReview,
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): void {
  const status = review.approved ? "APPROVED" : "REVISION REQUIRED";
  console.log(
    `[COMMERCIAL DESIGN DIRECTOR] ${status} — score ${review.score.overall}/${COMMERCIAL_APPROVAL_THRESHOLD} · iteration ${review.iteration}`,
  );
  console.log(
    `[COMMERCIAL DESIGN DIRECTOR] KPI wouldBuy=${review.score.wouldBuy} wouldWear=${review.psychology.wouldWear} scrollStop=${review.psychology.wouldStopScrolling}`,
  );
  if (review.critique.weaknesses.length > 0) {
    console.log(`[COMMERCIAL DESIGN DIRECTOR] Weakness: ${review.critique.weaknesses[0]}`);
  }
  if (spec.heroTypographyDirection) {
    const typo = evaluateCommercialTypography(spec);
    console.log(
      `[COMMERCIAL DESIGN DIRECTOR] Hero typography: ${spec.heroTypographyDirection.direction} · share ${Math.round(typo.compositionShare * 100)}% · score ${typo.score}`,
    );
  }
  const curiosity = evaluateBuyerCuriosity(brief, spec);
  console.log(
    `[COMMERCIAL DESIGN DIRECTOR] Buyer curiosity: scrollStop=${curiosity.scrollStopPotential} desire=${curiosity.desireSignal} hooks=${curiosity.hookHits.slice(0, 2).join(", ") || "none"}`,
  );
}

/** Critique a single design — does not create graphics. */
export function runCommercialDesignReview(input: CommercialDirectorInput): CommercialDesignReview {
  const iteration = input.iteration ?? 1;
  const score = scoreCommercialDesign({
    brief: input.brief,
    spec: input.spec,
    svg: input.svg,
  });
  const psychology = evaluateBuyerPsychology(input.brief, input.spec, score);
  const buyerCuriosity = evaluateBuyerCuriosity(input.brief, input.spec);
  const brandDna = evaluateBrandDna(input.brief, input.spec);
  const streetwear = evaluateStreetwearAppeal(input.brief, input.spec);
  const trendFit = evaluateTrendFit(input.brief, input.spec);
  const collectionFit = evaluateCollectionFit(input.brief, input.spec);
  const emotion = evaluateEmotionalImpact(input.brief, input.spec, score, psychology);
  const weakest = weakestCommercialDimensions(score);

  const critique = buildDesignCritique({
    commercialScore: score,
    psychology,
    brandDna,
    streetwear,
    trendFit,
    collectionFit,
    emotion,
    weakestDimensions: weakest,
    buyerCuriosity,
  });

  const revisionTasks = critique.approved
    ? []
    : buildRevisionTasks(critique, score, iteration - 1, input.spec);

  const review: CommercialDesignReview = {
    score,
    psychology,
    brandDna,
    critique,
    revisionTasks,
    iteration,
    approved: passesCommercialGate(score),
  };

  logCommercialReview(review, input.brief, input.spec);
  return review;
}

/**
 * Full commercial pipeline with revision loop.
 * Optimizes for: "Would a human buy this shirt?"
 * Max 5 refinement iterations before returning best effort.
 */
export function runCommercialDesignPipeline(
  brief: DesignStudioBrief,
  options: LibraryEngineOptions = {},
): CommercialPipelineResult {
  let currentBrief = brief;
  let best: CommercialPipelineResult | null = null;
  let pendingTasks: RevisionTask[] = [];
  let lastSpec: LibraryArtworkSpec | undefined;

  for (let i = 0; i < MAX_COMMERCIAL_REVISION_ITERATIONS; i++) {
    const overrides =
      i === 0
        ? options.compositionOverrides
        : selectRevisionOverrides(pendingTasks, i, lastSpec);

    const spec = resolveArtworkSpec(currentBrief, overrides);
    const svg = renderSvgFromSpec(spec, currentBrief, options);
    const review = runCommercialDesignReview({
      brief: currentBrief,
      spec,
      svg,
      iteration: i + 1,
    });

    const imageStudioBlueprint = buildImageStudioBlueprint(currentBrief, review);

    const result: CommercialPipelineResult = {
      svg,
      spec,
      review,
      iterations: i + 1,
      approved: review.approved,
      imageStudioBlueprint,
    };

    lastSpec = spec;

    if (!best || review.score.overall > best.review.score.overall) {
      best = result;
    }

    if (review.approved) {
      console.log(
        `[COMMERCIAL DESIGN DIRECTOR] Design approved after ${i + 1} iteration(s) — score ${review.score.overall}`,
      );
      return result;
    }

    pendingTasks = review.revisionTasks;
    if (i < MAX_COMMERCIAL_REVISION_ITERATIONS - 1) {
      currentBrief = applyRevisionTasks(currentBrief, pendingTasks);
      console.log(
        `[COMMERCIAL DESIGN DIRECTOR] Revision ${i + 2}/${MAX_COMMERCIAL_REVISION_ITERATIONS}: ${pendingTasks[0]?.action ?? "re-compose"}`,
      );
    }
  }

  console.log(
    `[COMMERCIAL DESIGN DIRECTOR] Max iterations reached — returning best score ${best!.review.score.overall}`,
  );
  return { ...best!, approved: false };
}

/** Blueprint package for Premium Image Studio after Design Studio completes. */
export function buildImageStudioBlueprint(
  brief: DesignStudioBrief,
  review: CommercialDesignReview,
): string {
  const base = buildImageStudioRevisionBrief(brief, review.critique, review.revisionTasks);
  const deliverables = [
    "",
    "IMAGE STUDIO DELIVERABLES:",
    "• Premium artwork concept visualization",
    "• Premium apparel product mockup (oversized tee/hoodie)",
    "• Campaign hero image",
    "• Social media asset (4:5 and 1:1)",
    "",
    "CREATIVE DIRECTOR REVIEW REQUIRED before approval.",
    `Commercial score: ${review.score.overall}/100`,
    `Milaene DNA: ${review.brandDna.score}/100`,
    `Mood: ${review.critique.strengths[0] ?? "editorial streetwear"}`,
  ];
  return `${base}\n${deliverables.join("\n")}`;
}

export {
  MAX_COMMERCIAL_REVISION_ITERATIONS,
} from "@/lib/design/commercial-design-director/revision";
export { COMMERCIAL_APPROVAL_THRESHOLD } from "@/lib/design/commercial-design-director/commercial-score";
