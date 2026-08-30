/**
 * Canonical Persona / Brand Model eligibility rules.
 *
 * Pure domain logic only: no repositories, providers, browser state, or legacy
 * Official Brand Face registry. Durable callers must resolve LockedBrandIdentity
 * before evaluating downstream eligibility.
 */

import type { Persona } from "@/lib/persona/domain/types";
import { isPersonaIdentityLocked } from "../identity-lock/identity-lock-service";
import type { LockedBrandIdentity } from "../identity-lock/types";
import {
  isCurrentVideoIdentityReady,
  isCurrentVideoUseApproved,
} from "../video-readiness/authority";
import {
  BRAND_CAST_REQUIRES_VIDEO_USE_APPROVED,
  VIDEO_IDENTITY_READINESS_POLICY,
  type BrandModelEligibility,
  type UseApprovalEligibility,
} from "./types";

function revisionPending(persona: Persona): boolean {
  return persona.identity_lock_status === "needs_revision";
}

function isArchived(persona: Persona): boolean {
  return persona.status === "Archived";
}

function identityAuthorityBlockingReasons(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): string[] {
  const reasons: string[] = [];
  if (!isPersonaIdentityLocked(input.persona)) {
    reasons.push("Identity is not locked");
  }
  if (!input.lockedIdentity) {
    reasons.push(
      "Valid identity lock snapshot and persisted identity review are missing or unresolved",
    );
  }
  if (
    input.lockedIdentity &&
    input.lockedIdentity.personaId !== input.persona.id
  ) {
    reasons.push("Identity lock snapshot does not belong to this Persona");
  }
  if (input.lockedIdentity) {
    const lockedReferences = [
      input.lockedIdentity.masterReference,
      ...input.lockedIdentity.canonicalReferences.map((entry) => entry.reference),
    ];
    if (
      lockedReferences.length !== 6 ||
      lockedReferences.some((reference) => !reference.rights_confirmed)
    ) {
      reasons.push("Locked Brand Model reference rights are not confirmed.");
    }
  }
  if (!input.persona.image_identity_ready) {
    reasons.push("Image identity validation is not complete");
  }
  if (revisionPending(input.persona)) {
    reasons.push("Identity revision is pending");
  }
  if (isArchived(input.persona)) {
    reasons.push("Persona is archived");
  }
  return reasons;
}

export function evaluateImageUseEligibility(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): UseApprovalEligibility {
  const alreadyApproved = Boolean(input.persona.image_use_approved);
  const blockingReasons = identityAuthorityBlockingReasons(input);

  return {
    gate: "image_use",
    eligible: blockingReasons.length === 0 && !alreadyApproved,
    alreadyApproved,
    blockingReasons,
    statusLabel: alreadyApproved
      ? "Approved"
      : blockingReasons.length
        ? "Not ready"
        : "Not approved",
  };
}

export function evaluateVideoUseEligibility(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): UseApprovalEligibility {
  const alreadyApproved = isCurrentVideoUseApproved(
    input.persona,
    input.lockedIdentity,
  );
  const blockingReasons = identityAuthorityBlockingReasons(input);

  // No automated video validation exists. The independent persisted checklist
  // result must remain false until a human explicitly validates video use.
  void VIDEO_IDENTITY_READINESS_POLICY;
  if (!isCurrentVideoIdentityReady(input.persona, input.lockedIdentity)) {
    blockingReasons.push(
      "Die Video-Identitätsprüfung für den aktuellen Identity Lock ist nicht abgeschlossen.",
    );
  }

  return {
    gate: "video_use",
    eligible: blockingReasons.length === 0 && !alreadyApproved,
    alreadyApproved,
    blockingReasons,
    statusLabel: alreadyApproved
      ? "Approved"
      : blockingReasons.length
        ? "Not ready"
        : "Not approved",
  };
}

export function evaluateBrandCastEligibility(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): UseApprovalEligibility {
  const alreadyApproved = Boolean(input.persona.brand_cast_approved);
  const blockingReasons = identityAuthorityBlockingReasons(input);

  if (!input.persona.image_use_approved) {
    blockingReasons.push("Image Studio use is not approved");
  }
  if (
    BRAND_CAST_REQUIRES_VIDEO_USE_APPROVED &&
    !input.persona.video_use_approved
  ) {
    blockingReasons.push("Video Studio use is not approved");
  }

  return {
    gate: "brand_cast",
    eligible: blockingReasons.length === 0 && !alreadyApproved,
    alreadyApproved,
    blockingReasons,
    statusLabel: alreadyApproved ? "Official Brand Cast" : "Not approved",
  };
}

/** One canonical downstream derivation for Image and Video Studio consumers. */
export function evaluateBrandModelEligibility(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): BrandModelEligibility {
  const { persona, lockedIdentity } = input;
  const authorityReasons = identityAuthorityBlockingReasons(input);
  const imageBlockingReasons = [...authorityReasons];
  const videoBlockingReasons = [...authorityReasons];
  const referenceRightsConfirmed = Boolean(
    lockedIdentity &&
      [
        lockedIdentity.masterReference,
        ...lockedIdentity.canonicalReferences.map((entry) => entry.reference),
      ].length === 6 &&
      [
        lockedIdentity.masterReference,
        ...lockedIdentity.canonicalReferences.map((entry) => entry.reference),
      ].every((reference) => reference.rights_confirmed),
  );

  if (!persona.brand_cast_approved) {
    imageBlockingReasons.push("Official Brand Cast not approved");
    videoBlockingReasons.push("Official Brand Cast not approved");
  }
  if (!persona.image_use_approved) {
    imageBlockingReasons.push("Image Studio use is not approved");
  }
  const videoIdentityReady = isCurrentVideoIdentityReady(persona, lockedIdentity);
  const videoUseApproved = isCurrentVideoUseApproved(persona, lockedIdentity);
  if (!videoIdentityReady) {
    videoBlockingReasons.push(
      "Die Video-Identitätsprüfung für den aktuellen Identity Lock ist nicht abgeschlossen.",
    );
  }
  if (!videoUseApproved) {
    videoBlockingReasons.push("Die Nutzung im Video Studio ist nicht freigegeben.");
  }

  return {
    identityLocked: isPersonaIdentityLocked(persona),
    validIdentityLock: lockedIdentity != null,
    identityReviewPassed: lockedIdentity?.identityReview != null,
    referenceRightsConfirmed,
    brandCastApproved: Boolean(persona.brand_cast_approved),
    imageUseApproved: Boolean(persona.image_use_approved),
    videoUseApproved,
    imageIdentityReady: Boolean(persona.image_identity_ready),
    videoIdentityReady,
    imageEligible: imageBlockingReasons.length === 0,
    videoEligible: videoBlockingReasons.length === 0,
    imageBlockingReasons,
    videoBlockingReasons,
    lockVersion: lockedIdentity?.lockVersion ?? null,
    identityFingerprint: lockedIdentity?.identityFingerprint ?? null,
  };
}

export function isImageStudioConsumerEligible(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): boolean {
  return evaluateBrandModelEligibility(input).imageEligible;
}

export function evaluateVideoStudioConsumerEligibility(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): { eligible: boolean; blockingReasons: string[] } {
  const result = evaluateBrandModelEligibility(input);
  return {
    eligible: result.videoEligible,
    blockingReasons: result.videoBlockingReasons,
  };
}
