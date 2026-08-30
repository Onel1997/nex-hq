import { z } from "zod";

export const VIDEO_IDENTITY_REVIEW_VERSION =
  "persona-video-identity-review-v1" as const;

export const videoIdentityReviewChecklistSchema = z
  .object({
    faceIdentityStable: z.boolean(),
    masterReferenceValid: z.boolean(),
    anglesSufficient: z.boolean(),
    hairstyleConsistent: z.boolean(),
    facialHairConsistent: z.boolean(),
    ageAppearanceConsistent: z.boolean(),
    bodyFrameUsable: z.boolean(),
    noIdentityConflict: z.boolean(),
    referencesSuitableForMotion: z.boolean(),
  })
  .strict();

export type VideoIdentityReviewChecklist = z.infer<
  typeof videoIdentityReviewChecklistSchema
>;

export const VIDEO_IDENTITY_REVIEW_KEYS = Object.freeze(
  Object.keys(
    videoIdentityReviewChecklistSchema.shape,
  ) as Array<keyof VideoIdentityReviewChecklist>,
);

export const videoIdentityReviewEvidenceSchema = z
  .object({
    evidenceVersion: z.literal(VIDEO_IDENTITY_REVIEW_VERSION),
    operationId: z.string().uuid(),
    workspaceId: z.string().min(1),
    personaId: z.string().min(1),
    identityLockSnapshotId: z.string().uuid(),
    identityLockVersion: z.number().int().positive(),
    identityFingerprint: z.string().min(1),
    referencePackageFingerprint: z.string().min(1),
    masterReferenceAssetId: z.string().uuid(),
    canonicalReferenceAssetIds: z.array(z.string().uuid()).length(5),
    reviewerId: z.string().uuid(),
    reviewedAt: z.string().datetime(),
    checklist: videoIdentityReviewChecklistSchema,
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().max(2_000).nullable(),
  })
  .strict();

export type VideoIdentityReviewEvidence = z.infer<
  typeof videoIdentityReviewEvidenceSchema
> & { createdAt: string };

export type SubmitVideoIdentityReviewInput = {
  operationId: string;
  expectedIdentityLockSnapshotId: string;
  expectedIdentityLockVersion: number;
  expectedIdentityFingerprint: string;
  expectedReferencePackageFingerprint: string;
  checklist: VideoIdentityReviewChecklist;
  decision: "APPROVE" | "REJECT";
  note?: string;
};

export type VideoIdentityReadinessView = {
  personaId: string;
  personaName: string;
  identityLockSnapshotId: string;
  identityLockVersion: number;
  identityFingerprint: string;
  referencePackageFingerprint: string;
  masterReferenceAssetId: string;
  canonicalReferences: Array<{
    assetId: string;
    role:
      | "front"
      | "three_quarter_left"
      | "three_quarter_right"
      | "left_profile"
      | "right_profile";
    rightsConfirmed: boolean;
  }>;
  referenceRightsConfirmed: boolean;
  referencePackageSufficientForV1: boolean;
  videoIdentityReady: boolean;
  videoUseApproved: boolean;
  currentReview: VideoIdentityReviewEvidence | null;
  canReview: boolean;
  blockers: string[];
  providerCalled: false;
};
