/**
 * Phase 2.4D — Image / Video Use Approval + Brand Cast Approval types.
 *
 * Gates stay separate; never collapse into a single generic "approved" flag.
 */

import type { LockedBrandIdentity } from "../identity-lock/types";
import type { Persona } from "@/lib/persona/domain/types";
import { z } from "zod";

export type UseApprovalGate =
  | "image_use"
  | "video_use"
  | "brand_cast";

export type VideoIdentityReadinessPolicy =
  /**
   * Product rule (current): Video Use requires identity_locked + valid lock snapshot
   * AND a current, immutable human review bound to the exact lock snapshot and
   * reference package. The boolean alone is never authority.
   */
  | "requires_current_lock_bound_human_video_review";

export const VIDEO_IDENTITY_READINESS_POLICY: VideoIdentityReadinessPolicy =
  "requires_current_lock_bound_human_video_review";

/**
 * Brand Cast official membership does NOT require video_use_approved.
 * Matches legacy canApprovePersona (image use only) and keeps Image Studio
 * unblocked while video validation remains incomplete.
 */
export const BRAND_CAST_REQUIRES_VIDEO_USE_APPROVED = false as const;

export type UseApprovalEligibility = {
  gate: UseApprovalGate;
  eligible: boolean;
  alreadyApproved: boolean;
  blockingReasons: string[];
  /** Human-readable status for UI (no DB field names). */
  statusLabel: string;
};

export type BrandModelApprovalsView = {
  identityLocked: boolean;
  imageIdentityReady: boolean;
  videoIdentityReady: boolean;
  imageUse: UseApprovalEligibility;
  videoUse: UseApprovalEligibility;
  brandCast: UseApprovalEligibility;
  videoIdentityReadinessPolicy: VideoIdentityReadinessPolicy;
  lockedIdentity: LockedBrandIdentity | null;
  eligibility: BrandModelEligibility;
  providerCalled: false;
};

/** Runtime schema shared by the Persona authority and downstream consumers. */
export const brandModelEligibilitySchema = z
  .object({
    identityLocked: z.boolean(),
    validIdentityLock: z.boolean(),
    identityReviewPassed: z.boolean(),
    referenceRightsConfirmed: z.boolean(),
    brandCastApproved: z.boolean(),
    imageUseApproved: z.boolean(),
    videoUseApproved: z.boolean(),
    imageIdentityReady: z.boolean(),
    videoIdentityReady: z.boolean(),
    imageEligible: z.boolean(),
    videoEligible: z.boolean(),
    imageBlockingReasons: z.array(z.string()),
    videoBlockingReasons: z.array(z.string()),
    lockVersion: z.number().int().positive().nullable(),
    identityFingerprint: z.string().min(1).nullable(),
  })
  .strict();

export type BrandModelEligibility = z.infer<
  typeof brandModelEligibilitySchema
>;

export type UseApprovalResult = {
  persona: Persona;
  gate: UseApprovalGate;
  alreadyApproved: boolean;
  providerCalled: false;
  auditEmitted: boolean;
  lockedIdentity: LockedBrandIdentity | null;
};

export type BrandCastMemberCard = {
  personaId: string;
  displayName: string;
  role: string;
  masterPortraitUrl: string | null;
  identityLocked: boolean;
  imageUseApproved: boolean;
  videoStatus: "approved" | "not_approved" | "not_ready";
  brandCastApproved: boolean;
};

/** Canonical Image Studio consumer eligibility projection. */
export type ImageStudioBrandModelEligibility = {
  personaId: string;
  eligible: boolean;
  identityLocked: boolean;
  imageIdentityReady: boolean;
  imageUseApproved: boolean;
  brandCastApproved: boolean;
  blockingReasons: string[];
  lockVersion: number;
  identityFingerprint: string;
};

/** Canonical Video Studio consumer eligibility projection. */
export type VideoStudioBrandModelEligibility = {
  personaId: string;
  eligible: boolean;
  identityLocked: boolean;
  videoIdentityReady: boolean;
  videoUseApproved: boolean;
  brandCastApproved: boolean;
  blockingReasons: string[];
  lockVersion: number;
  identityFingerprint: string;
};
