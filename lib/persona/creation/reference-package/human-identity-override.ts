/**
 * Phase 2.3D.8 — Explicit human identity override for Stage B references.
 *
 * Machine identity_mismatch evidence is NEVER rewritten.
 * Usability may proceed only after deliberate human override + correct angle.
 */

import type { IdentityConsistencyDecision } from "./identity-consistency";
import type { AngleDirection } from "./angle-direction";
import { isAngleDirectionUsable } from "./angle-direction";

export const IDENTITY_OVERRIDE_VERSION =
  "human-identity-override-v1.0.0" as const;

export const HUMAN_IDENTITY_REVIEWS = [
  "approved_override",
  "rejected",
  "none",
] as const;

export type HumanIdentityReview = (typeof HUMAN_IDENTITY_REVIEWS)[number];

export const IDENTITY_SOURCE_CONFIDENCES = [
  "machine_match",
  "human_warning_approved",
  "human_mismatch_override",
] as const;

export type IdentitySourceConfidence =
  (typeof IDENTITY_SOURCE_CONFIDENCES)[number];

export const HUMAN_IDENTITY_OVERRIDE_REASON_DEFAULT =
  "User manually compared with Master Identity Reference and intentionally accepted the same Brand Identity despite machine identity_mismatch." as const;

export function resolveIdentitySourceConfidence(input: {
  identityDecision: IdentityConsistencyDecision | null | undefined;
  humanIdentityReview: HumanIdentityReview | null | undefined;
  assetApproved: boolean;
}): IdentitySourceConfidence | null {
  if (!input.assetApproved) return null;
  if (
    input.identityDecision === "identity_mismatch" &&
    input.humanIdentityReview === "approved_override"
  ) {
    return "human_mismatch_override";
  }
  if (
    input.identityDecision === "identity_warning" &&
    input.humanIdentityReview !== "rejected"
  ) {
    return "human_warning_approved";
  }
  if (input.identityDecision === "identity_match") {
    return "machine_match";
  }
  return null;
}

export function canProposeHumanIdentityOverride(input: {
  isMaster: boolean;
  isStageBGenerated: boolean;
  identityLocked: boolean;
  assetStatus: string;
  identityDecision: IdentityConsistencyDecision | null | undefined;
  angleDirection: AngleDirection | null | undefined;
  masterComparedInSession: boolean;
  /** Explicit prior human rejection of identity — blocks override. */
  humanIdentityReview?: HumanIdentityReview | null;
}): { ok: true } | { ok: false; reason: string } {
  if (input.isMaster) {
    return { ok: false, reason: "Master Identity Reference cannot use identity override." };
  }
  if (!input.isStageBGenerated) {
    return { ok: false, reason: "Only Stage B generated references support identity override." };
  }
  if (input.identityLocked) {
    return { ok: false, reason: "Cannot override identity after Identity Lock is finalized." };
  }
  if (input.assetStatus === "archived") {
    return { ok: false, reason: "Archived references cannot use identity override." };
  }
  // Machine-auto-rejected mismatch assets may still be overridden.
  // Explicit human rejection of identity blocks until reopened (review cleared).
  if (input.humanIdentityReview === "rejected") {
    return {
      ok: false,
      reason: "Rejected references must be explicitly reopened before identity override.",
    };
  }
  if (input.identityDecision !== "identity_mismatch") {
    return {
      ok: false,
      reason: "Human identity override applies only to machine identity_mismatch.",
    };
  }
  if (input.angleDirection !== "correct") {
    return {
      ok: false,
      reason:
        input.angleDirection === "incorrect"
          ? "Wrong camera direction cannot be overridden by identity approval."
          : "Uncertain or missing camera direction cannot be overridden by identity approval.",
    };
  }
  if (!input.masterComparedInSession) {
    return {
      ok: false,
      reason: "Compare with Master is required before identity override.",
    };
  }
  return { ok: true };
}

export function isMismatchOverrideUsable(input: {
  identityDecision: IdentityConsistencyDecision | null | undefined;
  humanIdentityReview: HumanIdentityReview | null | undefined;
  angleDirection: AngleDirection | null | undefined;
  assetStatus: string;
  attemptStatus?: string | null;
}): boolean {
  if (input.assetStatus !== "approved") return false;
  if (input.identityDecision !== "identity_mismatch") return false;
  if (input.humanIdentityReview !== "approved_override") return false;
  if (!isAngleDirectionUsable(input.angleDirection as AngleDirection)) {
    return false;
  }
  if (input.attemptStatus === "failed" || input.attemptStatus === "rejected") {
    return false;
  }
  return true;
}
