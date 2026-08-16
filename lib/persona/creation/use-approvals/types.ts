/**
 * Phase 2.4D — Image / Video Use Approval + Brand Cast Approval types.
 *
 * Gates stay separate; never collapse into a single generic "approved" flag.
 */

import type { LockedBrandIdentity } from "../identity-lock/types";
import type { Persona } from "@/lib/persona/domain/types";

export type UseApprovalGate =
  | "image_use"
  | "video_use"
  | "brand_cast";

export type VideoIdentityReadinessPolicy =
  /**
   * Product rule (current): Video Use requires identity_locked + valid lock snapshot
   * AND the persisted `video_identity_ready` checklist flag.
   * There is NO automated video validation pipeline yet — when the flag is false,
   * the gate stays BLOCKED with "Video identity validation not completed."
   */
  | "requires_video_identity_ready_flag";

export const VIDEO_IDENTITY_READINESS_POLICY: VideoIdentityReadinessPolicy =
  "requires_video_identity_ready_flag";

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
  providerCalled: false;
};

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

/** Future Image Studio consumer eligibility (no Image Studio build in this phase). */
export type ImageStudioBrandModelEligibility = {
  personaId: string;
  eligible: boolean;
  identityLocked: boolean;
  imageIdentityReady: boolean;
  imageUseApproved: boolean;
  brandCastApproved: boolean;
};

/** Future Video Studio consumer eligibility. */
export type VideoStudioBrandModelEligibility = {
  personaId: string;
  eligible: boolean;
  identityLocked: boolean;
  videoIdentityReady: boolean;
  videoUseApproved: boolean;
  brandCastApproved: boolean;
  blockingReasons: string[];
};
