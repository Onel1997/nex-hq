/**
 * Phase 2.3D.2 — Reference Package live coverage after approve/reject.
 * No provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCurrentlyAcceptedUsable,
  resolveReferencePackageSlotCoverage,
  resolveSlotDisplayStatus,
  slotsNeedingGenerationFromCoverage,
} from "@/lib/persona/creation/reference-package/coverage";
import type { ReferencePackageAttempt } from "@/lib/persona/creation/reference-package/types";
import type { PersonaReferenceAsset } from "@/lib/persona/domain/types";
import { FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD } from "@/lib/persona/face-novelty-memory/similarity-threshold";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const WS = "ws-23d2";
const PERSONA = "persona-23d2";

function attempt(
  overrides: Partial<ReferencePackageAttempt> &
    Pick<ReferencePackageAttempt, "id" | "reference_slot" | "status">,
): ReferencePackageAttempt {
  const now = new Date().toISOString();
  return {
    workspace_id: WS,
    persona_id: PERSONA,
    session_id: "sess-1",
    master_reference_id: "master-1",
    effective_slot: null,
    reassigned_from: null,
    reassigned_at: null,
    reassigned_by: null,
    angle_review_source: null,
    angle_review_decision: null,
    provider: "openai",
    provider_request_id: null,
    generated_asset_id: null,
    identity_decision: null,
    identity_distance: null,
    identity_similarity: null,
    angle_direction: null,
    detected_orientation: null,
    detected_yaw_degrees: null,
    provider_direction_strategy: null,
    provider_requested_direction: null,
    profile_identity_mode: null,
    profile_prompt_version: null,
    human_identity_review: null,
    human_identity_reviewed_at: null,
    human_identity_reviewed_by: null,
    human_identity_override_reason: null,
    identity_override_version: null,
    cost_eur: null,
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
  const now = new Date().toISOString();
  return {
    workspace_id: WS,
    persona_id: PERSONA,
    asset_type: "portrait",
    storage_path: `workspace/${WS}/x.png`,
    mime_type: "image/png",
    width: 1,
    height: 1,
    file_size_bytes: 10,
    checksum: overrides.id,
    is_primary: false,
    view_angle: "front",
    framing: "head_shoulders",
    expression: "neutral",
    body_visibility: "partial",
    notes: "",
    source_type: "generated_external",
    rights_confirmed: false,
    created_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("Phase 2.3D.2 reference package coverage refresh", () => {
  it("accepted → rejected immediately removes coverage", () => {
    const att = attempt({
      id: "a-front",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "asset-front",
      identity_decision: "identity_match",
    });
    const before = resolveReferencePackageSlotCoverage({
      attempts: [att],
      assets: [asset({ id: "asset-front", status: "approved" })],
    });
    assert.equal(before.acceptedCount, 1);
    assert.equal(before.slots.find((s) => s.slot === "front")?.status, "accepted");

    const reviewOnly = resolveReferencePackageSlotCoverage({
      attempts: [att],
      assets: [asset({ id: "asset-front", status: "review" })],
    });
    assert.equal(reviewOnly.acceptedCount, 0);
    assert.equal(reviewOnly.slots.find((s) => s.slot === "front")?.status, "review");

    const after = resolveReferencePackageSlotCoverage({
      attempts: [att], // historical attempt still accepted
      assets: [asset({ id: "asset-front", status: "rejected" })],
    });
    assert.equal(after.acceptedCount, 0);
    assert.equal(after.slots.find((s) => s.slot === "front")?.status, "rejected");
    assert.equal(after.slots.find((s) => s.slot === "front")?.countsTowardCoverage, false);
  });

  it("coverage 3/5 → 2/5 → 1/5 correctly", () => {
    const attempts = [
      attempt({
        id: "1",
        reference_slot: "front",
        status: "accepted",
        generated_asset_id: "af",
      }),
      attempt({
        id: "2",
        reference_slot: "three_quarter_left",
        status: "accepted",
        generated_asset_id: "al",
      }),
      attempt({
        id: "3",
        reference_slot: "three_quarter_right",
        status: "accepted",
        generated_asset_id: "ar",
      }),
      attempt({
        id: "4",
        reference_slot: "left_profile",
        status: "mismatch",
        generated_asset_id: "alp",
        identity_decision: "identity_mismatch",
      }),
      attempt({
        id: "5",
        reference_slot: "right_profile",
        status: "mismatch",
        generated_asset_id: "arp",
        identity_decision: "identity_mismatch",
      }),
    ];
    let assets = [
      asset({ id: "af", status: "approved" }),
      asset({ id: "al", status: "approved" }),
      asset({ id: "ar", status: "approved" }),
      asset({ id: "alp", status: "rejected" }),
      asset({ id: "arp", status: "rejected" }),
    ];
    assert.equal(
      resolveReferencePackageSlotCoverage({ attempts, assets }).acceptedCount,
      3,
    );

    assets = assets.map((a) =>
      a.id === "af" ? { ...a, status: "rejected" } : a,
    );
    assert.equal(
      resolveReferencePackageSlotCoverage({ attempts, assets }).acceptedCount,
      2,
    );

    assets = assets.map((a) =>
      a.id === "al" ? { ...a, status: "rejected" } : a,
    );
    const final = resolveReferencePackageSlotCoverage({ attempts, assets });
    assert.equal(final.acceptedCount, 1);
    assert.equal(final.slots.find((s) => s.slot === "front")?.status, "rejected");
    assert.equal(
      final.slots.find((s) => s.slot === "three_quarter_left")?.status,
      "rejected",
    );
    assert.equal(
      final.slots.find((s) => s.slot === "three_quarter_right")?.status,
      "accepted",
    );
    assert.equal(
      final.slots.find((s) => s.slot === "left_profile")?.status,
      "mismatch",
    );
    assert.equal(
      final.slots.find((s) => s.slot === "right_profile")?.status,
      "mismatch",
    );
  });

  it("historical accepted attempt does not override newer rejection", () => {
    const olderAccepted = attempt({
      id: "old",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "old-asset",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const newerRejectedAttempt = attempt({
      id: "new",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "new-asset",
      created_at: "2026-08-01T00:00:00.000Z",
    });
    const coverage = resolveReferencePackageSlotCoverage({
      attempts: [olderAccepted, newerRejectedAttempt],
      assets: [
        asset({ id: "old-asset", status: "approved" }),
        asset({ id: "new-asset", status: "rejected" }),
      ],
    });
    const front = coverage.slots.find((s) => s.slot === "front")!;
    assert.equal(front.latestAttempt?.id, "new");
    assert.equal(front.status, "rejected");
    assert.equal(front.countsTowardCoverage, false);
    assert.equal(coverage.acceptedCount, 0);
  });

  it("only latest active accepted ref counts; regenerate targets non-accepted", () => {
    const attempts = [
      attempt({
        id: "1",
        reference_slot: "front",
        status: "accepted",
        generated_asset_id: "af",
      }),
      attempt({
        id: "2",
        reference_slot: "three_quarter_right",
        status: "accepted",
        generated_asset_id: "ar",
      }),
    ];
    const assets = [
      asset({ id: "af", status: "rejected" }),
      asset({ id: "ar", status: "approved" }),
    ];
    const coverage = resolveReferencePackageSlotCoverage({ attempts, assets });
    assert.equal(coverage.acceptedCount, 1);
    const needed = slotsNeedingGenerationFromCoverage(coverage);
    assert.ok(needed.includes("front"));
    assert.ok(!needed.includes("three_quarter_right"));
    assert.equal(
      isCurrentlyAcceptedUsable({
        attempt: attempts[1]!,
        asset: assets[1]!,
      }),
      true,
    );
    assert.equal(
      resolveSlotDisplayStatus({
        attempt: attempts[0]!,
        asset: assets[0]!,
      }),
      "rejected",
    );
  });

  it("UI reloads package status when referenceRevision changes", () => {
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /referenceRevision/);
    assert.match(studio, /personaId, referenceRevision/);
    assert.match(studio, /Rejected/);
  });

  it("novelty threshold unchanged; no provider path in coverage", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    const coverageSrc = readFileSync(
      join(ROOT, "lib/persona/creation/reference-package/coverage.ts"),
      "utf8",
    );
    assert.doesNotMatch(coverageSrc, /editOpenAiImageFromReference|images\.generate/);
  });
});
