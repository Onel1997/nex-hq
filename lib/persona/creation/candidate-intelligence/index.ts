export {
  CANDIDATE_VARIATION_PROFILES,
  resolveCandidateVariation,
  variationFingerprint,
  type CandidateVariationProfile,
} from "./variations";

export {
  buildCandidatePrompt,
  composeProviderPrompt,
  type BuiltCandidatePrompt,
  type PromptBlocks,
} from "./prompt-builder";

export {
  assessCandidateQuality,
  qualityFieldsForCandidate,
  type CandidateQualityAssessment,
  type CandidateQualityDimensions,
} from "./quality-score";

export {
  buildDiversityReport,
  fingerprintDistance,
  type CandidateDiversityReport,
  type PairwiseDiversity,
} from "./visual-difference";

export {
  NOTES_HISTORY_KEY,
  appendCandidateNoteRevision,
  readNotesHistory,
  type CandidateNoteRevision,
} from "./notes";
