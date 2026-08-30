/**
 * Phase 2.3D.6 — Real post-generation angle validation from landmarks.
 * No paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildSyntheticLandmarks68,
  estimateOrientationFromLandmarks,
  isAngleDirectionUsable,
  isCurrentlyAcceptedUsable,
  validateAngleDirectionFromOrientation,
  validateAngleDirectionFromPrompt,
  buildReferencePackageAnglePrompt,
} from "@/lib/persona/creation/reference-package";
import { FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD } from "@/lib/persona/face-novelty-memory/similarity-threshold";
import { OPENAI_PROVIDER_CAPABILITY } from "@/lib/persona/creation/quality-modes";
import type { ReferencePackageAttempt } from "@/lib/persona/creation/reference-package/types";
import type { PersonaReferenceAsset } from "@/lib/persona/domain/types";

const ROOT = process.cwd();

describe("Phase 2.3D.6 real image angle validation", () => {
  it("actual image-right output fails three_quarter_left", () => {
    const points = buildSyntheticLandmarks68({
      yawToward: "right",
      strength: "three_quarter",
    });
    const orientation = estimateOrientationFromLandmarks({
      points,
      detectionConfidence: 0.9,
    });
    assert.equal(orientation.detected_orientation, "image_right");
    assert.ok((orientation.detected_yaw_degrees ?? 0) > 0);

    const result = validateAngleDirectionFromOrientation({
      slot: "three_quarter_left",
      orientation,
      promptValidation: validateAngleDirectionFromPrompt({
        slot: "three_quarter_left",
        prompt: buildReferencePackageAnglePrompt("three_quarter_left"),
      }),
    });
    assert.equal(result.angle_direction, "incorrect");
    assert.equal(result.detected_orientation, "image_right");
    assert.equal(isAngleDirectionUsable(result.angle_direction), false);
  });

  it("actual image-left output passes three_quarter_left", () => {
    const points = buildSyntheticLandmarks68({
      yawToward: "left",
      strength: "three_quarter",
    });
    const orientation = estimateOrientationFromLandmarks({
      points,
      detectionConfidence: 0.9,
    });
    assert.equal(orientation.detected_orientation, "image_left");
    assert.ok((orientation.detected_yaw_degrees ?? 0) < 0);

    const result = validateAngleDirectionFromOrientation({
      slot: "three_quarter_left",
      orientation,
      promptValidation: validateAngleDirectionFromPrompt({
        slot: "three_quarter_left",
        prompt: buildReferencePackageAnglePrompt("three_quarter_left"),
      }),
    });
    assert.equal(result.angle_direction, "correct");
    assert.equal(isAngleDirectionUsable(result.angle_direction), true);
  });

  it("profile direction checks work", () => {
    const left = estimateOrientationFromLandmarks({
      points: buildSyntheticLandmarks68({
        yawToward: "left",
        strength: "profile",
      }),
      detectionConfidence: 0.95,
    });
    assert.ok(
      left.detected_orientation === "profile_left" ||
        left.detected_orientation === "image_left",
    );
    const leftCheck = validateAngleDirectionFromOrientation({
      slot: "left_profile",
      orientation: left,
    });
    assert.equal(leftCheck.angle_direction, "correct");

    const right = estimateOrientationFromLandmarks({
      points: buildSyntheticLandmarks68({
        yawToward: "right",
        strength: "profile",
      }),
      detectionConfidence: 0.95,
    });
    const rightOnLeft = validateAngleDirectionFromOrientation({
      slot: "left_profile",
      orientation: right,
    });
    assert.equal(rightOnLeft.angle_direction, "incorrect");
  });

  it("frontal detection works", () => {
    const orientation = estimateOrientationFromLandmarks({
      points: buildSyntheticLandmarks68({
        yawToward: "center",
        strength: "frontal",
      }),
      detectionConfidence: 0.99,
    });
    assert.equal(orientation.detected_orientation, "frontal");
    const ok = validateAngleDirectionFromOrientation({
      slot: "front",
      orientation,
    });
    assert.equal(ok.angle_direction, "correct");
    const bad = validateAngleDirectionFromOrientation({
      slot: "front",
      orientation: estimateOrientationFromLandmarks({
        points: buildSyntheticLandmarks68({
          yawToward: "right",
          strength: "three_quarter",
        }),
        detectionConfidence: 0.9,
      }),
    });
    assert.equal(bad.angle_direction, "incorrect");
  });

  it("uncertain landmarks fail closed", () => {
    const orientation = estimateOrientationFromLandmarks({
      points: [{ x: 0, y: 0 }], // too few
      detectionConfidence: 0.9,
    });
    assert.equal(orientation.detected_orientation, "uncertain");
    const result = validateAngleDirectionFromOrientation({
      slot: "three_quarter_left",
      orientation,
    });
    assert.equal(result.angle_direction, "uncertain");
    assert.equal(isAngleDirectionUsable(result.angle_direction), false);
  });

  it("identity_match cannot override wrong angle", () => {
    const attempt = {
      id: "a",
      workspace_id: "w",
      persona_id: "p",
      session_id: "s",
      master_reference_id: "m",
      reference_slot: "three_quarter_left" as const,
      effective_slot: null,
      reassigned_from: null,
      reassigned_at: null,
      reassigned_by: null,
      angle_review_source: null,
      angle_review_decision: null,
      provider: "openai" as const,
      provider_request_id: "r",
      generated_asset_id: "g",
      status: "review" as const,
      identity_decision: "identity_match" as const,
      identity_distance: 0.1,
      identity_similarity: 0.9,
      angle_direction: "incorrect" as const,
      detected_orientation: "image_right" as const,
      detected_yaw_degrees: 38,
      provider_direction_strategy: "canonical" as const,
      provider_requested_direction: "three_quarter_left" as const,
      profile_identity_mode: null,
      profile_prompt_version: null,
      human_identity_review: null,
      human_identity_reviewed_at: null,
      human_identity_reviewed_by: null,
      human_identity_override_reason: null,
      identity_override_version: null,
    derived_from_asset_id: null,
    derivation_type: null,
    derived_at: null,
    derived_by: null,
    replacement_for_asset_id: null,
    replacement_for_slot: null,
    replacement_candidate: false,
      cost_eur: 0.04,
      error_message: "Wrong camera direction",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    } satisfies ReferencePackageAttempt;
    const asset = {
      id: "g",
      workspace_id: "w",
      persona_id: "p",
      asset_type: "three_quarter" as const,
      storage_path: "x",
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 1,
      checksum: "c",
      is_primary: false,
      view_angle: "three_quarter_left" as const,
      framing: "head_shoulders" as const,
      expression: "neutral",
      body_visibility: "partial",
      notes: "",
      source_type: "generated_external" as const,
      rights_confirmed: true,
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      status: "approved" as const,
    } satisfies PersonaReferenceAsset;

    assert.equal(
      isCurrentlyAcceptedUsable({ attempt, asset }),
      false,
    );
  });

  it("no provider / Master / novelty unchanged; UI shows wrong direction", () => {
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBUsesFlux, false);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /Falsche Kamerarichtung/);
    assert.match(studio, /Winkel neu zuordnen/);
    assert.match(studio, /Ablehnen/);
  });
});
