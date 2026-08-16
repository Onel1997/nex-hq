/**
 * Phase 2.4D — Pure eligibility rules for use / Brand Cast approvals.
 * No provider calls. Authorization metadata only.
 */

import type { Persona } from "@/lib/persona/domain/types";
import { isPersonaIdentityLocked } from "../identity-lock/identity-lock-service";
import type { LockedBrandIdentity } from "../identity-lock/types";
import {
  BRAND_CAST_REQUIRES_VIDEO_USE_APPROVED,
  VIDEO_IDENTITY_READINESS_POLICY,
  type UseApprovalEligibility,
} from "./types";

function revisionPending(persona: Persona): boolean {
  return persona.identity_lock_status === "needs_revision";
}

function isArchivedOrDeleted(persona: Persona): boolean {
  return persona.status === "Archived";
}

export function evaluateImageUseEligibility(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): UseApprovalEligibility {
  const { persona, lockedIdentity } = input;
  const alreadyApproved = Boolean(persona.image_use_approved);
  const blockingReasons: string[] = [];

  if (!isPersonaIdentityLocked(persona)) {
    blockingReasons.push("Identity is not locked");
  }
  if (!lockedIdentity) {
    blockingReasons.push("Valid identity lock snapshot is missing or unresolved");
  }
  if (!(persona.image_identity_ready || isPersonaIdentityLocked(persona))) {
    blockingReasons.push("Image identity is not ready");
  }
  if (revisionPending(persona)) {
    blockingReasons.push("Identity revision is pending");
  }
  if (isArchivedOrDeleted(persona)) {
    blockingReasons.push("Persona is archived");
  }

  return {
    gate: "image_use",
    eligible: blockingReasons.length === 0 && !alreadyApproved,
    alreadyApproved,
    blockingReasons,
    statusLabel: alreadyApproved ? "Approved" : blockingReasons.length ? "Not ready" : "Not approved",
  };
}

export function evaluateVideoUseEligibility(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): UseApprovalEligibility {
  const { persona, lockedIdentity } = input;
  const alreadyApproved = Boolean(persona.video_use_approved);
  const blockingReasons: string[] = [];

  if (!isPersonaIdentityLocked(persona)) {
    blockingReasons.push("Identity is not locked");
  }
  if (!lockedIdentity) {
    blockingReasons.push("Valid identity lock snapshot is missing or unresolved");
  }
  // Actual product rule: requires persisted video_identity_ready (checklist flag).
  // No automated video validation pipeline exists — do not fake readiness.
  void VIDEO_IDENTITY_READINESS_POLICY;
  if (!persona.video_identity_ready) {
    blockingReasons.push("Video identity validation not completed.");
  }
  if (revisionPending(persona)) {
    blockingReasons.push("Identity revision is pending");
  }
  if (isArchivedOrDeleted(persona)) {
    blockingReasons.push("Persona is archived");
  }

  return {
    gate: "video_use",
    eligible: blockingReasons.length === 0 && !alreadyApproved,
    alreadyApproved,
    blockingReasons,
    statusLabel: alreadyApproved
      ? "Approved"
      : !persona.video_identity_ready
        ? "Not ready"
        : blockingReasons.length
          ? "Not ready"
          : "Not approved",
  };
}

export function evaluateBrandCastEligibility(input: {
  persona: Persona;
  lockedIdentity: LockedBrandIdentity | null;
}): UseApprovalEligibility {
  const { persona, lockedIdentity } = input;
  const alreadyApproved = Boolean(
    persona.brand_cast_approved || (persona.approved && persona.status === "Approved"),
  );
  const blockingReasons: string[] = [];

  if (!isPersonaIdentityLocked(persona)) {
    blockingReasons.push("Identity is not locked");
  }
  if (!lockedIdentity) {
    blockingReasons.push("Valid identity lock snapshot is missing or unresolved");
  }
  if (!persona.image_use_approved) {
    blockingReasons.push("Image Studio use is not approved");
  }
  if (BRAND_CAST_REQUIRES_VIDEO_USE_APPROVED && !persona.video_use_approved) {
    blockingReasons.push("Video Studio use is not approved");
  }
  if (isArchivedOrDeleted(persona)) {
    blockingReasons.push("Persona is archived");
  }
  if (revisionPending(persona)) {
    blockingReasons.push("Identity revision is pending");
  }

  return {
    gate: "brand_cast",
    eligible: blockingReasons.length === 0 && !alreadyApproved,
    alreadyApproved,
    blockingReasons,
    statusLabel: alreadyApproved ? "Official Brand Cast" : "Not approved",
  };
}

/** Image Studio query contract — all four gates required. */
export function isImageStudioConsumerEligible(persona: Persona): boolean {
  return (
    isPersonaIdentityLocked(persona) &&
    Boolean(persona.image_identity_ready || isPersonaIdentityLocked(persona)) &&
    Boolean(persona.image_use_approved) &&
    Boolean(
      persona.brand_cast_approved ||
        (persona.approved && persona.status === "Approved"),
    )
  );
}

/** Video Studio query contract — does not fake video readiness. */
export function evaluateVideoStudioConsumerEligibility(persona: Persona): {
  eligible: boolean;
  blockingReasons: string[];
} {
  const blockingReasons: string[] = [];
  if (!isPersonaIdentityLocked(persona)) {
    blockingReasons.push("Identity is not locked");
  }
  if (!persona.video_identity_ready) {
    blockingReasons.push("Video identity validation not completed.");
  }
  if (!persona.video_use_approved) {
    blockingReasons.push("Video Studio use is not approved");
  }
  if (
    !(
      persona.brand_cast_approved ||
      (persona.approved && persona.status === "Approved")
    )
  ) {
    blockingReasons.push("Official Brand Cast not approved");
  }
  return { eligible: blockingReasons.length === 0, blockingReasons };
}
