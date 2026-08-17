import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  IDENTITY_REVIEW_CHECK_KEYS,
  type IdentityReviewChecklist,
} from "@/lib/persona/domain/creation-types";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { MemoryCreationRepository } from "./memory-creation-repository";
import { setCreationRepositoryForTests } from "./creation-factory";
import { MemoryPersonaRepository } from "@/lib/persona/repositories/memory-persona-repository";
import { setPersonaRepositoryForTests } from "@/lib/persona/repositories/factory";
import {
  buildMasterIdentityNotes,
} from "./master-identity-reference";
import {
  buildReferencePackageAssetNotes,
} from "./reference-package/types";
import {
  MemoryReferencePackageRepository,
  setReferencePackageRepositoryForTests,
} from "./reference-package/repository";
import {
  REFERENCE_PACKAGE_SLOTS,
  type ReferencePackageSlot,
} from "./reference-package/slots";
import { reconcileReferencePackageState } from "./reference-package/reconcile-reference-package-state";
import {
  IDENTITY_LOCK_POLICY_VERSION,
  MemoryIdentityLockRepository,
  computeReferencePackageFingerprint,
  getIdentityLockSnapshot,
  readLegacyReconciliationReviewContext,
  resolveLockedBrandIdentity,
  setIdentityLockRepositoryForTests,
  submitLegacyIdentityReconciliation,
  getLegacyIdentityReconciliationView,
  validateIdentityPackageEvidence,
} from "./identity-lock";
import { evaluateBrandModelEligibility } from "./use-approvals/eligibility";

const WS = "workspace-reconciliation";
const OTHER_WS = "workspace-other";
const ACTOR = "owner-auth-user";
const scope: WorkspaceScope = { workspaceId: WS, actorId: ACTOR };

const approvedConfirmations = {
  masterIdentityReferenceCorrect: true,
  requiredReferenceCoverageReviewed: true,
  samePersonAcrossReferences: true,
  noObviousIdentityMismatch: true,
  acceptableForImageUse: true,
  remainOfficialBrandModelIdentity: true,
} as const;

function passingChecklist(video = false): IdentityReviewChecklist {
  return Object.fromEntries(
    IDENTITY_REVIEW_CHECK_KEYS.map((key) => [
      key,
      key === "suitable_for_video_generation" ? video : true,
    ]),
  ) as IdentityReviewChecklist;
}

describe("legacy Brand Model human reconciliation", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;
  let packageRepo: MemoryReferencePackageRepository;
  let lockRepo: MemoryIdentityLockRepository;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    packageRepo = new MemoryReferencePackageRepository();
    lockRepo = new MemoryIdentityLockRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
    setReferencePackageRepositoryForTests(packageRepo);
    setIdentityLockRepositoryForTests(lockRepo);
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
    setReferencePackageRepositoryForTests(null);
    setIdentityLockRepositoryForTests(null);
  });

  async function seedLegacyLockedIdentity() {
    const persona = await personaRepo.createPersona(scope, {
      name: "North African Street Premium",
      role: "primary_male",
      gender: "male",
      age_range: "22-25",
      height: "180",
      body_type: "lean",
      skin_tone: "medium",
      hair: "short",
      beard: "",
      eye_color: "brown",
      expression: "neutral",
      personality: "",
      style: "street premium",
      notes: "legacy fixture",
      brand_fit_score: 90,
      status: "Approved",
      identity_lock_status: "approved",
      identity_lock_version: 2,
      identity_locked_at: "2026-07-01T12:00:00.000Z",
      image_identity_ready: true,
      video_identity_ready: false,
      image_use_approved: true,
      image_use_approved_at: "2026-07-01T12:01:00.000Z",
      image_use_approved_by: ACTOR,
      video_use_approved: false,
      brand_cast_approved: true,
      brand_cast_approved_at: "2026-07-01T12:02:00.000Z",
      brand_cast_approved_by: ACTOR,
    });

    const master = await personaRepo.createReferenceAsset(scope, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: `workspace/${WS}/master.png`,
      mime_type: "image/png",
      width: 100,
      height: 100,
      file_size_bytes: 100,
      checksum: "master-checksum",
      status: "uploaded",
      is_primary: true,
      view_angle: "front",
      framing: "face",
      expression: "neutral",
      body_visibility: "partial",
      source_type: "generated_external",
      rights_confirmed: true,
      notes: buildMasterIdentityNotes({
        version: 1,
        source: "selected_candidate",
        reference_type: "identity_master",
        primary_identity_reference: true,
        immutable_source_reference: true,
        original_provider: "openai",
        source_candidate_id: "legacy-candidate",
        source_candidate_asset_id: "legacy-candidate-asset",
        source_creation_project_id: "legacy-project",
        label: "MASTER IDENTITY REFERENCE",
        subtitle: "Original selected Brand Face",
      }),
    });
    await personaRepo.updatePersona(scope, persona.id, {
      primary_reference_asset_id: master.id,
    });

    const session = await packageRepo.createSession(scope, {
      persona_id: persona.id,
      master_reference_id: master.id,
      confirmation_token: "legacy-reconciliation-fixture",
      estimate_hash: "fixture-hash",
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      max_authorized_spend: 0,
      image_count: 5,
    });
    const assetIds = new Map<ReferencePackageSlot, string>();
    for (const slot of REFERENCE_PACKAGE_SLOTS) {
      const attempt = await packageRepo.createAttempt(scope, {
        persona_id: persona.id,
        session_id: session.id,
        master_reference_id: master.id,
        reference_slot: slot,
        status: "accepted",
      });
      const asset = await personaRepo.createReferenceAsset(scope, {
        persona_id: persona.id,
        asset_type: "portrait",
        storage_path: `workspace/${WS}/${slot}.png`,
        mime_type: "image/png",
        width: 100,
        height: 100,
        file_size_bytes: 100,
        checksum: `checksum-${slot}`,
        status: "approved",
        is_primary: false,
        view_angle: "front",
        framing: "head_shoulders",
        expression: "neutral",
        body_visibility: "partial",
        source_type: "generated_external",
        rights_confirmed: true,
        notes: buildReferencePackageAssetNotes({
          slot,
          attemptId: attempt.id,
          masterReferenceId: master.id,
          identityDecision: "identity_match",
          angleDirection: "correct",
        }),
      });
      assetIds.set(slot, asset.id);
      await packageRepo.updateAttempt(scope, attempt.id, {
        generated_asset_id: asset.id,
        identity_decision: "identity_match",
        angle_direction: "correct",
      });
    }

    const attempts = await packageRepo.listAttemptsForPersona(scope, persona.id);
    const assets = await personaRepo.listReferenceAssets(scope, persona.id);
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const evidence = validateIdentityPackageEvidence({
      reconciled,
      master,
      assets,
    });
    assert.equal(
      evidence.blockingReasons.length,
      0,
      evidence.blockingReasons.join(" | "),
    );
    const fingerprint = computeReferencePackageFingerprint({
      masterAssetId: master.id,
      masterChecksum: master.checksum,
      canonicalReferences: evidence.canonicalReferences,
      lockVersion: 2,
      referencePackageVersion: reconciled.reconcilerVersion,
    });
    const historical = await lockRepo.createSnapshot(scope, {
      persona_id: persona.id,
      source_candidate_id: null,
      source_creation_project_id: null,
      master_reference_asset_id: master.id,
      master_checksum: master.checksum,
      front_asset_id: assetIds.get("front")!,
      three_quarter_left_asset_id: assetIds.get("three_quarter_left")!,
      three_quarter_right_asset_id: assetIds.get("three_quarter_right")!,
      left_profile_asset_id: assetIds.get("left_profile")!,
      right_profile_asset_id: assetIds.get("right_profile")!,
      canonical_references: evidence.canonicalReferences,
      identity_lock_version: 2,
      identity_locked_at: "2026-07-01T12:00:00.000Z",
      identity_locked_by: null,
      identity_review_id: null,
      identity_reviewed_at: null,
      identity_reviewed_by: null,
      reference_package_version: reconciled.reconcilerVersion,
      reference_package_fingerprint: fingerprint,
      provenance_counts: {
        machineMatchCount: 5,
        warningApprovedCount: 0,
        mismatchOverrideCount: 0,
        derivedReferenceCount: 0,
        reassignedCount: 0,
        replacementApprovedCount: 0,
      },
      policy_version: IDENTITY_LOCK_POLICY_VERSION,
    });
    return { persona, master, historical, assetIds };
  }

  function request(
    historical: Awaited<ReturnType<typeof seedLegacyLockedIdentity>>["historical"],
    decision: "approved" | "rejected" = "approved",
  ) {
    return {
      operationId: randomUUID(),
      expectedSnapshotId: historical.id,
      expectedLockVersion: historical.identity_lock_version,
      decision,
      acknowledgeHistoricalProvenanceMissing: true as const,
      checklist: passingChecklist(false),
      confirmations: approvedConfirmations,
      reviewerNotes:
        decision === "approved"
          ? "Current immutable identity package reviewed by owner."
          : "Identity mismatch requires repair.",
    };
  }

  it("fails closed until an explicit reconciliation review creates a new lock", async () => {
    const { persona, historical } = await seedLegacyLockedIdentity();
    assert.equal(await resolveLockedBrandIdentity(scope, persona.id), null);
    const view = await getLegacyIdentityReconciliationView(scope, persona.id);
    assert.equal(view.requiresHumanReconciliation, true);
    assert.equal(view.canReconcile, true);
    assert.equal(view.currentPackage.coverage.accepted, 5);

    const before = Date.now();
    const reconciliationRequest = request(historical);
    const result = await submitLegacyIdentityReconciliation(
      scope,
      persona.id,
      reconciliationRequest,
    );
    assert.equal(result.decision, "approved");
    assert.equal(result.review.reviewed_by, ACTOR);
    assert.ok(Date.parse(result.review.reviewed_at!) >= before);
    assert.equal(result.sourceSnapshot.id, historical.id);
    assert.equal(result.sourceSnapshot.identity_review_id, null);
    assert.equal(result.newSnapshot?.identity_lock_version, 3);
    assert.equal(result.newSnapshot?.identity_review_id, result.review.id);
    assert.equal(result.newSnapshot?.identity_reviewed_at, result.review.reviewed_at);

    const meta = readLegacyReconciliationReviewContext(result.review);
    assert.equal(meta?.kind, "legacy_identity_reconciliation");
    assert.equal(meta?.sourceIdentityLockSnapshotId, historical.id);
    assert.equal(meta?.sourceIdentityLockVersion, 2);
    assert.equal(meta?.decision, "approved");

    const preservedV2 = await lockRepo.getSnapshotByVersion(scope, persona.id, 2);
    assert.deepEqual(preservedV2, historical);
    const locked = await resolveLockedBrandIdentity(scope, persona.id);
    assert.equal(locked?.lockVersion, 3);
    const updated = await personaRepo.getPersona(scope, persona.id);
    assert.ok(updated);
    const eligibility = evaluateBrandModelEligibility({
      persona: updated!,
      lockedIdentity: locked,
    });
    assert.equal(eligibility.imageEligible, true);
    assert.equal(eligibility.videoEligible, false);
    assert.equal(updated!.image_use_approved, true);
    assert.equal(updated!.brand_cast_approved, true);
    assert.equal(updated!.video_use_approved, false);

    const retry = await submitLegacyIdentityReconciliation(
      scope,
      persona.id,
      reconciliationRequest,
    );
    assert.equal(retry.review.id, result.review.id);
    assert.equal(retry.newSnapshot?.id, result.newSnapshot?.id);
    assert.equal(await lockRepo.getSnapshotByVersion(scope, persona.id, 4), null);
  });

  it("persists a present-tense rejection without changing the historical lock", async () => {
    const { persona, historical } = await seedLegacyLockedIdentity();
    const result = await submitLegacyIdentityReconciliation(
      scope,
      persona.id,
      request(historical, "rejected"),
    );
    assert.equal(result.newSnapshot, null);
    assert.equal(
      readLegacyReconciliationReviewContext(result.review)?.decision,
      "rejected",
    );
    assert.deepEqual(
      await getIdentityLockSnapshot(scope, persona.id),
      historical,
    );
    assert.equal(await resolveLockedBrandIdentity(scope, persona.id), null);
  });

  it("blocks reconciliation when current durable evidence no longer matches", async () => {
    const { persona, historical, assetIds } = await seedLegacyLockedIdentity();
    await personaRepo.deleteReferenceAsset(scope, assetIds.get("right_profile")!);
    const view = await getLegacyIdentityReconciliationView(scope, persona.id);
    assert.equal(view.canReconcile, false);
    assert.ok(view.blockingReasons.some((reason) => /not ready|missing|differs/i.test(reason)));
    await assert.rejects(
      () =>
        submitLegacyIdentityReconciliation(
          scope,
          persona.id,
          request(historical),
        ),
      (error: unknown) =>
        error instanceof PersonaDomainError && error.code === "WORKFLOW",
    );
  });

  it("rejects cross-workspace reconciliation", async () => {
    const { persona } = await seedLegacyLockedIdentity();
    await assert.rejects(
      () =>
        getLegacyIdentityReconciliationView(
          { workspaceId: OTHER_WS, actorId: ACTOR },
          persona.id,
        ),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "UNAUTHORIZED_WORKSPACE",
    );
  });

  it("does not accept legacy Approved status or non-explicit confirmations", async () => {
    const { persona, historical } = await seedLegacyLockedIdentity();
    const locked = await resolveLockedBrandIdentity(scope, persona.id);
    const current = await personaRepo.getPersona(scope, persona.id);
    assert.equal(current?.status, "Approved");
    assert.equal(
      evaluateBrandModelEligibility({ persona: current!, lockedIdentity: locked })
        .imageEligible,
      false,
    );
    await assert.rejects(
      () =>
        submitLegacyIdentityReconciliation(scope, persona.id, {
          ...request(historical),
          confirmations: {
            ...approvedConfirmations,
            remainOfficialBrandModelIdentity: false,
          },
        }),
      (error: unknown) =>
        error instanceof PersonaDomainError && /explicitly accepted/i.test(error.message),
    );
    assert.equal(await lockRepo.getSnapshotByVersion(scope, persona.id, 3), null);
  });
});
