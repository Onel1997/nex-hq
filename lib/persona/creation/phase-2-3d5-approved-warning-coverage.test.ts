/**
 * Phase 2.3D.5 — Approved identity_warning coverage on effective slot.
 * No provider calls. No identity evidence rewrite.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isCurrentlyAcceptedUsable,
  resolveReferencePackageSlotCoverage,
  resolveSlotDisplayStatus,
} from "@/lib/persona/creation/reference-package/coverage";
import type { ReferencePackageAttempt } from "@/lib/persona/creation/reference-package/types";
import type { PersonaReferenceAsset } from "@/lib/persona/domain/types";
import { FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD } from "@/lib/persona/face-novelty-memory/similarity-threshold";
import { OPENAI_PROVIDER_CAPABILITY } from "@/lib/persona/creation/quality-modes";

const ROOT = process.cwd();
const WS = "ws-23d5";
const PERSONA = "persona-23d5";

function attempt(
  overrides: Partial<ReferencePackageAttempt> &
    Pick<ReferencePackageAttempt, "id" | "reference_slot" | "status">,
): ReferencePackageAttempt {
  const now = "2026-08-09T17:26:04.000Z";
  return {
    workspace_id: WS,
    persona_id: PERSONA,
    session_id: "sess",
    master_reference_id: "master",
    effective_slot: null,
    reassigned_from: null,
    reassigned_at: null,
    reassigned_by: null,
    angle_review_source: null,
    angle_review_decision: null,
    provider: "openai",
    provider_request_id: "req",
    generated_asset_id: null,
    identity_decision: null,
    identity_distance: null,
    identity_similarity: null,
    angle_direction: "uncertain",
    detected_orientation: null,
    detected_yaw_degrees: null,
    cost_eur: 0.04,
    error_message: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function asset(
  overrides: Partial<PersonaReferenceAsset> &
    Pick<PersonaReferenceAsset, "id" | "status">,
): PersonaReferenceAsset {
  const now = "2026-08-09T17:42:29.000Z";
  return {
    workspace_id: WS,
    persona_id: PERSONA,
    asset_type: "profile",
    storage_path: `workspace/${WS}/${overrides.id}.png`,
    mime_type: "image/png",
    width: 1,
    height: 1,
    file_size_bytes: 10,
    checksum: overrides.id,
    is_primary: false,
    view_angle: "left_profile",
    framing: "head_shoulders",
    expression: "neutral",
    body_visibility: "partial",
    notes: "",
    source_type: "generated_external",
    rights_confirmed: true,
    created_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("Phase 2.3D.5 reassigned approved warning coverage", () => {
  it("reassigned identity_warning + approved = usable Accepted on effective slot", () => {
    // Mirrors live persona 724778f9: right→left, warning, attempt status still "mismatch"
    const att = attempt({
      id: "live-reassigned",
      reference_slot: "right_profile",
      effective_slot: "left_profile",
      reassigned_from: "right_profile",
      reassigned_at: "2026-08-09T17:42:29.865Z",
      reassigned_by: "workspace-user",
      angle_review_source: "user",
      angle_review_decision: "confirmed",
      status: "mismatch", // legacy machine label for warning
      identity_decision: "identity_warning",
      identity_distance: 0.524,
      generated_asset_id: "asset-left",
      updated_at: "2026-08-09T17:42:29.865Z",
    });
    const a = asset({
      id: "asset-left",
      status: "approved",
      view_angle: "left_profile",
    });

    assert.equal(isCurrentlyAcceptedUsable({ attempt: att, asset: a }), true);
    assert.equal(
      resolveSlotDisplayStatus({ attempt: att, asset: a }),
      "accepted",
    );
    assert.equal(att.identity_decision, "identity_warning"); // evidence preserved

    const coverage = resolveReferencePackageSlotCoverage({
      attempts: [att],
      assets: [a],
    });
    const left = coverage.slots.find((s) => s.slot === "left_profile");
    const right = coverage.slots.find((s) => s.slot === "right_profile");
    assert.equal(left?.countsTowardCoverage, true);
    assert.equal(left?.status, "accepted");
    assert.equal(left?.identityDecision, "identity_warning");
    assert.equal(left?.humanReview, "approved");
    assert.equal(left?.angleManuallyReassigned, true);
    assert.equal(right?.countsTowardCoverage, false);
    assert.notEqual(right?.status, "accepted");
    assert.equal(coverage.acceptedCount, 1);
  });

  it("requested slot does not count; same asset cannot count twice", () => {
    const att = attempt({
      id: "a1",
      reference_slot: "right_profile",
      effective_slot: "left_profile",
      reassigned_from: "right_profile",
      status: "review",
      identity_decision: "identity_warning",
      generated_asset_id: "g1",
      updated_at: "2026-08-09T18:00:00.000Z",
    });
    const a = asset({ id: "g1", status: "approved" });
    const coverage = resolveReferencePackageSlotCoverage({
      attempts: [att],
      assets: [a],
    });
    assert.equal(
      coverage.slots.find((s) => s.slot === "left_profile")?.countsTowardCoverage,
      true,
    );
    assert.equal(
      coverage.slots.find((s) => s.slot === "right_profile")?.countsTowardCoverage,
      false,
    );
    assert.equal(coverage.acceptedCount, 1);
  });

  it("identity_mismatch + approved remains blocked; primary status mismatch", () => {
    const att = attempt({
      id: "bad",
      reference_slot: "left_profile",
      status: "mismatch",
      identity_decision: "identity_mismatch",
      generated_asset_id: "bad-asset",
    });
    const a = asset({ id: "bad-asset", status: "approved" });
    assert.equal(isCurrentlyAcceptedUsable({ attempt: att, asset: a }), false);
    assert.equal(
      resolveSlotDisplayStatus({ attempt: att, asset: a }),
      "mismatch",
    );
    const coverage = resolveReferencePackageSlotCoverage({
      attempts: [att],
      assets: [a],
    });
    assert.equal(
      coverage.slots.find((s) => s.slot === "left_profile")?.countsTowardCoverage,
      false,
    );
    assert.equal(
      coverage.slots.find((s) => s.slot === "left_profile")?.status,
      "mismatch",
    );
  });

  it("identity_warning without approval is review, not Accepted", () => {
    const att = attempt({
      id: "w",
      reference_slot: "left_profile",
      status: "mismatch",
      identity_decision: "identity_warning",
      generated_asset_id: "w1",
    });
    const a = asset({ id: "w1", status: "review" });
    assert.equal(isCurrentlyAcceptedUsable({ attempt: att, asset: a }), false);
    assert.equal(resolveSlotDisplayStatus({ attempt: att, asset: a }), "review");
  });

  it("UI shows Accepted + Identity warning metadata; no provider / novelty change", () => {
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /Identity:/);
    assert.match(studio, /Human review:/);
    assert.match(studio, /Angle: manually reassigned/);
    assert.match(studio, /Identity evaluation:/);
    assert.match(studio, /Human review: approved/);
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBUsesFlux, false);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
  });

  it("live-shaped fixture: warning evidence remains warning after usable", () => {
    const att = attempt({
      id: "4aac7ab8",
      reference_slot: "right_profile",
      effective_slot: "left_profile",
      reassigned_from: "right_profile",
      reassigned_at: "2026-08-09T17:42:29.865Z",
      angle_review_decision: "confirmed",
      status: "mismatch",
      identity_decision: "identity_warning",
      identity_distance: 0.5243499451360816,
      generated_asset_id: "b0dad52f",
      updated_at: "2026-08-09T17:42:29.865Z",
    });
    const a = asset({
      id: "b0dad52f",
      status: "approved",
      storage_path:
        "workspace/fa0cbbec/personas/724778f9/references/right_profile.png",
      is_primary: false,
    });
    const coverage = resolveReferencePackageSlotCoverage({
      attempts: [
        att,
        attempt({
          id: "old-left-mismatch",
          reference_slot: "left_profile",
          status: "mismatch",
          identity_decision: "identity_mismatch",
          generated_asset_id: "old",
          created_at: "2026-08-09T16:00:00.000Z",
          updated_at: "2026-08-09T16:00:00.000Z",
        }),
      ],
      assets: [a, asset({ id: "old", status: "rejected" })],
    });
    const left = coverage.slots.find((s) => s.slot === "left_profile");
    assert.equal(left?.latestAttempt?.id, "4aac7ab8");
    assert.equal(left?.status, "accepted");
    assert.equal(left?.identityDecision, "identity_warning");
    assert.equal(left?.countsTowardCoverage, true);
    assert.equal(a.is_primary, false);
  });
});
