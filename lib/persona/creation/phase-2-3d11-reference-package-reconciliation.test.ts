/**
 * Phase 2.3D.11 — Reference Package automatic state reconciliation.
 * No provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  reconcileReferencePackageState,
  deriveReferenceUsability,
  isFinalizedApprovedReplacement,
  assertReferenceAssetDeletable,
  resolveReferencePackageSlotCoverage,
} from "@/lib/persona/creation/reference-package/reconcile-reference-package-state";
import {
  buildReferencePackageAssetNotes,
  type ReferencePackageAttempt,
} from "@/lib/persona/creation/reference-package/types";
import type { PersonaReferenceAsset } from "@/lib/persona/domain/types";
import type { ReferencePackageSlot } from "@/lib/persona/creation/reference-package/slots";

const ROOT = process.cwd();
const WS = "ws-phase-23d11-reconcile";
const PERSONA = "persona-23d11";

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
    derived_from_asset_id: null,
    derivation_type: null,
    derived_at: null,
    derived_by: null,
    replacement_for_asset_id: null,
    replacement_for_slot: null,
    replacement_candidate: false,
    cost_eur: null,
    error_message: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function asset(
  overrides: Partial<PersonaReferenceAsset> &
    Pick<PersonaReferenceAsset, "id" | "status"> & { slot?: ReferencePackageSlot },
): PersonaReferenceAsset {
  const now = new Date().toISOString();
  const slot = overrides.slot ?? "front";
  const notes =
    overrides.notes ??
    buildReferencePackageAssetNotes({
      slot,
      attemptId: "att-x",
      masterReferenceId: "master-1",
      identityDecision: "identity_match",
      angleDirection: "correct",
    });
  return {
    workspace_id: WS,
    persona_id: PERSONA,
    asset_type: "portrait",
    storage_path: `workspace/${WS}/${overrides.id}.png`,
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
    source_type: "generated_external",
    rights_confirmed: true,
    created_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
    notes,
  };
}

function reconcile(
  attempts: ReferencePackageAttempt[],
  assets: PersonaReferenceAsset[],
) {
  return reconcileReferencePackageState({ attempts, assets });
}

describe("Phase 2.3D.11 reference package reconciliation", () => {
  it("1. approved match + correct camera = Accepted", () => {
    const att = attempt({
      id: "a1",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "af",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    const r = reconcile([att], [asset({ id: "af", status: "approved", slot: "front" })]);
    const front = r.slots.find((s) => s.slot === "front")!;
    assert.equal(front.state, "accepted");
    assert.equal(front.usable, true);
  });

  it("2. approved warning + human approval = Accepted", () => {
    const att = attempt({
      id: "a2",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "af",
      identity_decision: "identity_warning",
      angle_direction: "correct",
    });
    const r = reconcile([att], [asset({ id: "af", status: "approved", slot: "front" })]);
    assert.equal(r.slots.find((s) => s.slot === "front")?.state, "accepted");
  });

  it("3. approved mismatch + explicit override = Accepted", () => {
    const att = attempt({
      id: "a3",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "af",
      identity_decision: "identity_mismatch",
      human_identity_review: "approved_override",
      angle_direction: "correct",
    });
    const r = reconcile([att], [asset({ id: "af", status: "approved", slot: "front" })]);
    assert.equal(r.slots.find((s) => s.slot === "front")?.state, "accepted");
  });

  it("4. approved mismatch without override = not Accepted", () => {
    const att = attempt({
      id: "a4",
      reference_slot: "front",
      status: "mismatch",
      generated_asset_id: "af",
      identity_decision: "identity_mismatch",
      angle_direction: "correct",
    });
    const r = reconcile([att], [asset({ id: "af", status: "approved", slot: "front" })]);
    const front = r.slots.find((s) => s.slot === "front")!;
    assert.notEqual(front.state, "accepted");
    assert.equal(front.usable, false);
  });

  it("5. wrong camera never Accepted", () => {
    const att = attempt({
      id: "a5",
      reference_slot: "front",
      status: "failed",
      generated_asset_id: "af",
      identity_decision: "identity_match",
      angle_direction: "incorrect",
    });
    const r = reconcile([att], [asset({ id: "af", status: "approved", slot: "front" })]);
    const front = r.slots.find((s) => s.slot === "front")!;
    assert.notEqual(front.state, "accepted");
    assert.equal(front.usable, false);
  });

  it("6. approved replacement becomes active", () => {
    const oldAtt = attempt({
      id: "old",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "old-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    const newAtt = attempt({
      id: "new",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "new-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
      replacement_for_asset_id: "old-asset",
      replacement_for_slot: "front",
      replacement_candidate: false,
      created_at: "2026-08-02T00:00:00.000Z",
      updated_at: "2026-08-02T00:00:00.000Z",
    });
    const r = reconcile(
      [oldAtt, newAtt],
      [
        asset({ id: "old-asset", status: "superseded", slot: "front" }),
        asset({
          id: "new-asset",
          status: "approved",
          slot: "front",
          notes: buildReferencePackageAssetNotes({
            slot: "front",
            attemptId: "new",
            masterReferenceId: "master-1",
            identityDecision: "identity_match",
            angleDirection: "correct",
            replacementForAssetId: "old-asset",
            replacementForSlot: "front",
            replacementCandidate: false,
            replacementApprovedAt: "2026-08-02T00:00:00.000Z",
          }),
        }),
      ],
    );
    const front = r.slots.find((s) => s.slot === "front")!;
    assert.equal(front.activeAssetId, "new-asset");
    assert.equal(front.state, "accepted");
    assert.equal(front.replacementState, "approved");
  });

  it("7. predecessor deletion does not downgrade replacement", () => {
    const newAtt = attempt({
      id: "new",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "new-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
      replacement_for_asset_id: "deleted-predecessor",
      replacement_for_slot: "front",
      replacement_candidate: false,
    });
    const r = reconcile(
      [newAtt],
      [
        asset({
          id: "new-asset",
          status: "approved",
          slot: "front",
          notes: buildReferencePackageAssetNotes({
            slot: "front",
            attemptId: "new",
            masterReferenceId: "master-1",
            identityDecision: "identity_match",
            angleDirection: "correct",
            replacementForAssetId: "deleted-predecessor",
            replacementApprovedAt: "2026-08-02T00:00:00.000Z",
            replacementCandidate: false,
          }),
        }),
      ],
    );
    const front = r.slots.find((s) => s.slot === "front")!;
    assert.equal(front.state, "accepted");
    assert.equal(front.usable, true);
    assert.equal(front.replacementPredecessorMissing, true);
    assert.equal(front.replacementState, "predecessor_missing");
  });

  it("8. superseded history cannot cause Review", () => {
    const oldAtt = attempt({
      id: "old",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "old-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const reviewAtt = attempt({
      id: "rev",
      reference_slot: "front",
      status: "review",
      generated_asset_id: "rev-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
      replacement_candidate: true,
      replacement_for_asset_id: "old-asset",
      created_at: "2026-08-03T00:00:00.000Z",
    });
    const activeAtt = attempt({
      id: "active",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "active-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
      created_at: "2026-08-02T00:00:00.000Z",
    });
    const r = reconcile(
      [oldAtt, activeAtt, reviewAtt],
      [
        asset({ id: "old-asset", status: "superseded", slot: "front" }),
        asset({ id: "active-asset", status: "approved", slot: "front" }),
        asset({
          id: "rev-asset",
          status: "review",
          slot: "front",
          notes: buildReferencePackageAssetNotes({
            slot: "front",
            attemptId: "rev",
            masterReferenceId: "master-1",
            identityDecision: "identity_match",
            angleDirection: "correct",
            replacementCandidate: true,
            replacementForAssetId: "active-asset",
          }),
        }),
      ],
    );
    const front = r.slots.find((s) => s.slot === "front")!;
    assert.equal(front.state, "accepted");
    assert.equal(front.activeAssetId, "active-asset");
  });

  it("9. rejected old attempt cannot cause Review when approved exists", () => {
    const oldAtt = attempt({
      id: "old",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "old-asset",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const newerAtt = attempt({
      id: "new",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "new-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
      created_at: "2026-08-01T00:00:00.000Z",
    });
    const r = reconcile(
      [oldAtt, newerAtt],
      [
        asset({ id: "old-asset", status: "rejected", slot: "front" }),
        asset({ id: "new-asset", status: "approved", slot: "front" }),
      ],
    );
    assert.equal(r.slots.find((s) => s.slot === "front")?.state, "accepted");
  });

  it("10. pending replacement keeps incumbent Accepted", () => {
    const incumbentAtt = attempt({
      id: "inc",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "inc-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    const pendingAtt = attempt({
      id: "pend",
      reference_slot: "front",
      status: "review",
      generated_asset_id: "pend-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
      replacement_candidate: true,
      replacement_for_asset_id: "inc-asset",
      created_at: "2026-08-02T00:00:00.000Z",
    });
    const r = reconcile(
      [incumbentAtt, pendingAtt],
      [
        asset({ id: "inc-asset", status: "approved", slot: "front" }),
        asset({
          id: "pend-asset",
          status: "review",
          slot: "front",
          notes: buildReferencePackageAssetNotes({
            slot: "front",
            attemptId: "pend",
            masterReferenceId: "master-1",
            identityDecision: "identity_match",
            angleDirection: "correct",
            replacementCandidate: true,
            replacementForAssetId: "inc-asset",
          }),
        }),
      ],
    );
    const front = r.slots.find((s) => s.slot === "front")!;
    assert.equal(front.state, "accepted");
    assert.equal(front.usable, true);
    assert.equal(front.replacementState, "pending");
    assert.equal(r.acceptedCount, 1);
  });

  it("11. rejected replacement restores incumbent automatically", () => {
    const incumbentAtt = attempt({
      id: "inc",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "inc-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    const pendingAtt = attempt({
      id: "pend",
      reference_slot: "front",
      status: "rejected",
      generated_asset_id: "pend-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
      replacement_candidate: true,
      replacement_for_asset_id: "inc-asset",
      created_at: "2026-08-02T00:00:00.000Z",
    });
    const r = reconcile(
      [incumbentAtt, pendingAtt],
      [
        asset({ id: "inc-asset", status: "approved", slot: "front" }),
        asset({ id: "pend-asset", status: "rejected", slot: "front" }),
      ],
    );
    const front = r.slots.find((s) => s.slot === "front")!;
    assert.equal(front.activeAssetId, "inc-asset");
    assert.equal(front.state, "accepted");
  });

  it("12. reassigned approved ref resolves effective slot correctly", () => {
    const att = attempt({
      id: "re",
      reference_slot: "three_quarter_left",
      effective_slot: "three_quarter_right",
      status: "accepted",
      generated_asset_id: "ar",
      identity_decision: "identity_match",
      angle_direction: "correct",
      reassigned_from: "three_quarter_left",
    });
    const notes = buildReferencePackageAssetNotes({
      slot: "three_quarter_right",
      requestedSlot: "three_quarter_left",
      effectiveSlot: "three_quarter_right",
      attemptId: "re",
      masterReferenceId: "master-1",
      identityDecision: "identity_match",
      angleDirection: "correct",
      reassignedFrom: "three_quarter_left",
    });
    const r = reconcile(
      [att],
      [asset({ id: "ar", status: "approved", notes, slot: "three_quarter_right" })],
    );
    const tqr = r.slots.find((s) => s.slot === "three_quarter_right")!;
    assert.equal(tqr.state, "accepted");
    assert.equal(r.slots.find((s) => s.slot === "three_quarter_left")?.state, "missing");
  });

  it("13. one asset cannot count twice", () => {
    const att = attempt({
      id: "shared",
      reference_slot: "front",
      effective_slot: "three_quarter_left",
      status: "accepted",
      generated_asset_id: "shared-asset",
      identity_decision: "identity_match",
      angle_direction: "correct",
      reassigned_from: "front",
    });
    const notes = buildReferencePackageAssetNotes({
      slot: "three_quarter_left",
      effectiveSlot: "three_quarter_left",
      requestedSlot: "front",
      attemptId: "shared",
      masterReferenceId: "master-1",
      identityDecision: "identity_match",
      angleDirection: "correct",
      reassignedFrom: "front",
    });
    const r = reconcile([att], [asset({ id: "shared-asset", status: "approved", notes })]);
    assert.equal(r.acceptedCount, 1);
  });

  it("14. maximum one active asset per slot with audit on duplicates", () => {
    const a1 = attempt({
      id: "1",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "a1",
      identity_decision: "identity_match",
      angle_direction: "correct",
      updated_at: "2026-08-01T00:00:00.000Z",
    });
    const a2 = attempt({
      id: "2",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "a2",
      identity_decision: "identity_match",
      angle_direction: "correct",
      updated_at: "2026-08-02T00:00:00.000Z",
    });
    const r = reconcile(
      [a1, a2],
      [
        asset({ id: "a1", status: "approved", slot: "front" }),
        asset({ id: "a2", status: "approved", slot: "front" }),
      ],
    );
    const front = r.slots.find((s) => s.slot === "front")!;
    assert.equal(front.usable, true);
    assert.ok(r.auditEvents.includes("reference_package.multiple_active_reconciled"));
  });

  it("15. deleting current active accepted asset is blocked", () => {
    const att = attempt({
      id: "a",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "af",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    const ref = asset({ id: "af", status: "approved", slot: "front" });
    const reconciled = reconcile([att], [ref]);
    const gate = assertReferenceAssetDeletable({
      asset: ref,
      isMaster: false,
      reconciled,
    });
    assert.equal(gate.ok, false);
  });

  it("16. Master deletion blocked", () => {
    const master = asset({ id: "master", status: "approved" });
    const reconciled = reconcile([], [master]);
    const gate = assertReferenceAssetDeletable({
      asset: master,
      isMaster: true,
      reconciled,
    });
    assert.equal(gate.ok, false);
  });

  it("17. all five accepted = 5/5", () => {
    const slots = [
      "front",
      "three_quarter_left",
      "three_quarter_right",
      "left_profile",
      "right_profile",
    ] as const;
    const attempts: ReferencePackageAttempt[] = [];
    const assets: PersonaReferenceAsset[] = [];
    for (const slot of slots) {
      const id = `a-${slot}`;
      attempts.push(
        attempt({
          id: `att-${slot}`,
          reference_slot: slot,
          status: "accepted",
          generated_asset_id: id,
          identity_decision: "identity_match",
          angle_direction: "correct",
        }),
      );
      assets.push(asset({ id, status: "approved", slot }));
    }
    const r = reconcile(attempts, assets);
    assert.equal(r.acceptedCount, 5);
    assert.equal(r.referencePackageReady, true);
  });

  it("18. one missing = 4/5", () => {
    const attempts = [
      attempt({
        id: "1",
        reference_slot: "front",
        status: "accepted",
        generated_asset_id: "af",
        identity_decision: "identity_match",
        angle_direction: "correct",
      }),
      attempt({
        id: "2",
        reference_slot: "three_quarter_left",
        status: "accepted",
        generated_asset_id: "al",
        identity_decision: "identity_match",
        angle_direction: "correct",
      }),
      attempt({
        id: "3",
        reference_slot: "three_quarter_right",
        status: "accepted",
        generated_asset_id: "ar",
        identity_decision: "identity_match",
        angle_direction: "correct",
      }),
      attempt({
        id: "4",
        reference_slot: "left_profile",
        status: "accepted",
        generated_asset_id: "lp",
        identity_decision: "identity_match",
        angle_direction: "correct",
      }),
    ];
    const assets = [
      asset({ id: "af", status: "approved", slot: "front" }),
      asset({ id: "al", status: "approved", slot: "three_quarter_left" }),
      asset({ id: "ar", status: "approved", slot: "three_quarter_right" }),
      asset({ id: "lp", status: "approved", slot: "left_profile" }),
    ];
    const r = reconcile(attempts, assets);
    assert.equal(r.acceptedCount, 4);
    assert.equal(r.referencePackageReady, false);
  });

  it("19. legacy coverage wrapper matches reconciler", () => {
    const att = attempt({
      id: "a",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "af",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    const input = {
      attempts: [att],
      assets: [asset({ id: "af", status: "approved", slot: "front" })],
    };
    const r1 = reconcileReferencePackageState(input);
    const r2 = resolveReferencePackageSlotCoverage(input);
    assert.equal(r1.acceptedCount, r2.acceptedCount);
    assert.equal(r1.referencePackageReady, r2.referencePackageReady);
  });

  it("20. deriveReferenceUsability respects effective slot", () => {
    const att = attempt({
      id: "x",
      reference_slot: "front",
      effective_slot: "three_quarter_left",
      status: "accepted",
      generated_asset_id: "x",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    const notes = buildReferencePackageAssetNotes({
      slot: "three_quarter_left",
      effectiveSlot: "three_quarter_left",
      attemptId: "x",
      masterReferenceId: "m",
      identityDecision: "identity_match",
      angleDirection: "correct",
    });
    const a = asset({ id: "x", status: "approved", notes });
    assert.equal(
      deriveReferenceUsability({ slot: "front", attempt: att, asset: a }),
      false,
    );
    assert.equal(
      deriveReferenceUsability({
        slot: "three_quarter_left",
        attempt: att,
        asset: a,
      }),
      true,
    );
  });

  it("21–23. no provider/threshold/flux/discovery changes in reconciler", () => {
    const src = readFileSync(
      join(ROOT, "lib/persona/creation/reference-package/reconcile-reference-package-state.ts"),
      "utf8",
    );
    assert.doesNotMatch(src, /openai|flux|discovery|novelty|FLUX/i);
    assert.doesNotMatch(src, /IDENTITY_CONSISTENCY_MATCH|EUCLIDEAN_DUPLICATE/);
  });

  it("24. isFinalizedApprovedReplacement detects orphan approved replacement", () => {
    const a = asset({
      id: "rep",
      status: "approved",
      notes: buildReferencePackageAssetNotes({
        slot: "front",
        attemptId: "n",
        masterReferenceId: "m",
        identityDecision: "identity_match",
        replacementForAssetId: "gone",
        replacementApprovedAt: "2026-08-02T00:00:00.000Z",
        replacementCandidate: false,
      }),
    });
    assert.equal(isFinalizedApprovedReplacement(a, null), true);
  });
});
