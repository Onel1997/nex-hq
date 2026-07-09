export {
  COMMERCIAL_APPROVAL_THRESHOLD,
  COMMERCIAL_SCORE_DIMENSIONS,
  scoreCommercialDesign,
  passesCommercialGate,
  weakestCommercialDimensions,
  type CommercialScoreBreakdown,
  type CommercialScoreDimension,
  type CommercialScoreInput,
} from "@/lib/design/commercial-design-director/commercial-score";

export {
  BUYER_PSYCHOLOGY_DIMENSIONS,
  evaluateBuyerPsychology,
  type BuyerPsychologyDimension,
  type BuyerPsychologyProfile,
} from "@/lib/design/commercial-design-director/buyer-psychology";

export {
  evaluateBrandDna,
  type BrandDnaAssessment,
} from "@/lib/design/commercial-design-director/brand-dna";

export {
  evaluateStreetwearAppeal,
  type StreetwearAssessment,
} from "@/lib/design/commercial-design-director/streetwear";

export {
  evaluateTrendFit,
  type TrendFitAssessment,
} from "@/lib/design/commercial-design-director/trend-fit";

export {
  evaluateCollectionFit,
  type CollectionFitAssessment,
} from "@/lib/design/commercial-design-director/collection-fit";

export {
  evaluateEmotionalImpact,
  type EmotionalAssessment,
} from "@/lib/design/commercial-design-director/emotion";

export {
  buildDesignCritique,
  type DesignCritique,
} from "@/lib/design/commercial-design-director/critique";

export {
  MAX_COMMERCIAL_REVISION_ITERATIONS,
  buildRevisionTasks,
  applyRevisionTasks,
  selectRevisionOverrides,
  buildImageStudioRevisionBrief,
  type RevisionTask,
  type RevisionTarget,
} from "@/lib/design/commercial-design-director/revision";

export {
  runCommercialDesignReview,
  runCommercialDesignPipeline,
  buildImageStudioBlueprint,
  type CommercialDesignReview,
  type CommercialPipelineResult,
  type CommercialDirectorInput,
} from "@/lib/design/commercial-design-director/director";
