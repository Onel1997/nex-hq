import { z } from "zod";

export const REFERENCE_RIGHTS_EVIDENCE_VERSION = "reference-rights-v1" as const;
export const REFERENCE_RIGHTS_CONFIRMATION_SCOPE =
  "milaene_ai_assisted_image_production" as const;

export const referenceRightsConfirmationsSchema = z
  .object({
    hasNecessaryRightsOrAuthorization: z.boolean(),
    masterIdentityReferenceAuthorized: z.boolean(),
    canonicalReferencesAuthorized: z.boolean(),
    aiAssistedImageProductionAuthorized: z.boolean(),
    workspaceBrandUseAuthorized: z.boolean(),
  })
  .strict();

export type ReferenceRightsConfirmations = z.infer<
  typeof referenceRightsConfirmationsSchema
>;

export const referenceRightsEvidencePayloadSchema = z
  .object({
    evidenceVersion: z.literal(REFERENCE_RIGHTS_EVIDENCE_VERSION),
    scope: z.literal(REFERENCE_RIGHTS_CONFIRMATION_SCOPE),
    decision: z.enum(["confirmed", "rejected"]),
    operationId: z.string().uuid(),
    workspaceId: z.string().min(1),
    personaId: z.string().min(1),
    identityLockSnapshotId: z.string().min(1),
    identityLockVersion: z.number().int().positive(),
    identityFingerprint: z.string().min(1),
    masterReferenceAssetId: z.string().min(1),
    canonicalReferenceAssetIds: z.array(z.string().min(1)).length(5),
    confirmations: referenceRightsConfirmationsSchema,
    decidedBy: z.string().min(1),
    decidedAt: z.string().min(1),
    rejectionReason: z.string().nullable(),
  })
  .strict();

export type ReferenceRightsEvidencePayload = z.infer<
  typeof referenceRightsEvidencePayloadSchema
>;

export type ReferenceRightsEvidence = ReferenceRightsEvidencePayload & {
  id: string;
  createdAt: string;
};

export type ReferenceRightsView = {
  personaId: string;
  personaName: string;
  identityLockSnapshotId: string;
  identityLockVersion: number;
  identityFingerprint: string;
  masterReferenceAssetId: string;
  canonicalReferenceAssetIds: string[];
  assetRights: Array<{
    assetId: string;
    role: "master" | "front" | "three_quarter_left" | "three_quarter_right" | "left_profile" | "right_profile";
    rightsConfirmed: boolean;
  }>;
  rightsConfirmed: boolean;
  missingRightsAssetIds: string[];
  exactAuditedConfirmation: ReferenceRightsEvidence | null;
  canConfirm: boolean;
  blockingReasons: string[];
  providerCalled: false;
};

export type SubmitReferenceRightsDecisionInput = {
  operationId: string;
  expectedIdentityLockSnapshotId: string;
  expectedIdentityLockVersion: number;
  expectedIdentityFingerprint: string;
  decision: "confirmed" | "rejected";
  confirmations: ReferenceRightsConfirmations;
  rejectionReason?: string;
};
