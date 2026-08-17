export {
  getReferenceRightsView,
  submitReferenceRightsDecision,
} from "./service";
export {
  getReferenceRightsEvidenceRepository,
  setReferenceRightsEvidenceRepositoryForTests,
  MemoryReferenceRightsEvidenceRepository,
  SupabaseReferenceRightsEvidenceRepository,
} from "./repository";
export type { ReferenceRightsEvidenceRepository } from "./repository";
export {
  REFERENCE_RIGHTS_CONFIRMATION_SCOPE,
  REFERENCE_RIGHTS_EVIDENCE_VERSION,
  referenceRightsConfirmationsSchema,
  referenceRightsEvidencePayloadSchema,
} from "./types";
export type {
  ReferenceRightsConfirmations,
  ReferenceRightsEvidence,
  ReferenceRightsView,
  SubmitReferenceRightsDecisionInput,
} from "./types";
