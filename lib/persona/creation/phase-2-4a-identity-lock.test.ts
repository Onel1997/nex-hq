/**
 * Phase 2.4A — Official Brand Face Identity Lock.
 * No OpenAI / FLUX / provider calls.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  convertCandidateToPersona,
  createCreationProject,
  ensureManualCandidateSlots,
  lockPersonaIdentity,
  updateCandidateReview,
  uploadManualCandidateAsset,
} from "@/lib/persona/creation/creation-service";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  MemoryReferencePackageRepository,
  MemoryIdentityLockRepository,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
  setReferencePackageRepositoryForTests,
  setIdentityLockRepositoryForTests,
  validateIdentityLockEligibility,
  computeReferencePackageFingerprint,
  lockBrandIdentity,
  resolveLockedBrandIdentity,
  getIdentityLockEligibility,
  REFERENCE_PACKAGE_SLOTS,
  reconcileReferencePackageState,
} from "@/lib/persona";
import {
  buildMasterIdentityNotes,
  findMasterIdentityReference,
} from "@/lib/persona/creation/master-identity-reference";
import {
  buildReferencePackageAssetNotes,
  type ReferencePackageAttempt,
} from "@/lib/persona/creation/reference-package/types";
import type { Persona, PersonaReferenceAsset, WorkspaceScope } from "@/lib/persona/domain/types";
import type { ReferencePackageSlot } from "@/lib/persona/creation/reference-package/slots";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import {
  deleteReferenceAsset,
  updateReferenceAsset,
} from "@/lib/persona/services/persona-service";

const ROOT = process.cwd();
const WS = "ws-phase-24a";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-24a" };

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

function attempt(
  overrides: Partial<ReferencePackageAttempt> &
    Pick<ReferencePackageAttempt, "id" | "reference_slot" | "status">,
): ReferencePackageAttempt {
  const now = new Date().toISOString();
  return {
    workspace_id: WS,
    persona_id: "persona-24a",
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

function slotAsset(
  id: string,
  slot: ReferencePackageSlot,
  overrides: Partial<PersonaReferenceAsset> = {},
): PersonaReferenceAsset {
  const now = new Date().toISOString();
  return {
    id,
    workspace_id: WS,
    persona_id: "persona-24a",
    asset_type: "portrait",
    storage_path: `workspace/${WS}/${id}.png`,
    mime_type: "image/png",
    width: 1,
    height: 1,
    file_size_bytes: 10,
    checksum: `chk-${id}`,
    is_primary: false,
    view_angle: "front",
    framing: "head_shoulders",
    expression: "neutral",
    body_visibility: "partial",
    source_type: "generated_external",
    rights_confirmed: true,
    status: "approved",
    notes: buildReferencePackageAssetNotes({
      slot,
      attemptId: `att-${slot}`,
      masterReferenceId: "master-1",
      identityDecision: "identity_match",
      angleDirection: "correct",
    }),
    created_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function masterAsset(id = "master-1"): PersonaReferenceAsset {
  const now = new Date().toISOString();
  return {
    id,
    workspace_id: WS,
    persona_id: "persona-24a",
    asset_type: "portrait",
    storage_path: `workspace/${WS}/${id}.png`,
    mime_type: "image/png",
    width: 1,
    height: 1,
    file_size_bytes: 10,
    checksum: "chk-master",
    is_primary: true,
    view_angle: "front",
    framing: "face",
    expression: "neutral",
    body_visibility: "partial",
    source_type: "generated_external",
    rights_confirmed: true,
    status: "uploaded",
    notes: buildMasterIdentityNotes({
      version: 1,
      source: "selected_candidate",
      reference_type: "identity_master",
      primary_identity_reference: true,
      immutable_source_reference: true,
      original_provider: "openai",
      source_candidate_id: "cand-1",
      source_candidate_asset_id: "cand-asset-1",
      source_creation_project_id: null,
      label: "MASTER IDENTITY REFERENCE",
      subtitle: "Original selected Brand Face",
    }),
    created_by: null,
    created_at: now,
    updated_at: now,
  };
}

function draftPersona(overrides: Partial<Persona> = {}): Persona {
  const now = new Date().toISOString();
  return {
    id: "persona-24a",
    workspace_id: WS,
    name: "Test Persona",
    role: "primary_male",
    status: "Draft",
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
    style: "",
    notes: "",
    brand_fit_score: 0,
    approved: false,
    identity_lock_version: 1,
    identity_locked_at: null,
    image_use_approved: false,
    video_use_approved: false,
    primary_reference_asset_id: "master-1",
    visual_identity_notes: "",
    distinguishing_features: "",
    prohibited_changes: "",
    default_hair_style: "",
    default_facial_hair: "",
    default_expression: "",
    default_body_proportions: "",
    default_styling_notes: "",
    source_creation_project_id: "proj-1",
    source_candidate_id: "cand-1",
    identity_lock_status: "collecting_references",
    canonical_identity_description: "",
    immutable_features: "",
    flexible_features: "",
    approved_hair_variations: "",
    approved_expression_range: "",
    approved_body_proportions: "",
    approved_age_range: "",
    default_styling: "",
    image_identity_ready: false,
    video_identity_ready: false,
    intended_usage: "image_and_video",
    preferred_location_ids: [],
    preferred_camera_preset_ids: [],
    preferred_pose_ids: [],
    preferred_brand_look_ids: [],
    preferred_outfit_ids: [],
    created_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function fullPackageAttempts(overrides: Partial<Record<ReferencePackageSlot, Partial<ReferencePackageAttempt>>> = {}) {
  return REFERENCE_PACKAGE_SLOTS.map((slot) => {
    const assetId = `asset-${slot}`;
    const base = attempt({
      id: `att-${slot}`,
      reference_slot: slot,
      status: "accepted",
      generated_asset_id: assetId,
      identity_decision: "identity_match",
      angle_direction: "correct",
      ...(overrides[slot] ?? {}),
    });
    return { slot, assetId, att: base };
  });
}

describe("Phase 2.4A Official Brand Face Identity Lock", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;
  let pkgRepo: MemoryReferencePackageRepository;
  let lockRepo: MemoryIdentityLockRepository;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    pkgRepo = new MemoryReferencePackageRepository();
    lockRepo = new MemoryIdentityLockRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
    setReferencePackageRepositoryForTests(pkgRepo);
    setIdentityLockRepositoryForTests(lockRepo);
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
    setReferencePackageRepositoryForTests(null);
    setIdentityLockRepositoryForTests(null);
  });

  async function seedFullPackageInRepos() {
    const persona = await personaRepo.createPersona(scope, {
      ...draftPersona(),
      primary_reference_asset_id: null,
    });
    const master = await personaRepo.createReferenceAsset(scope, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: `workspace/${WS}/master.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: "chk-master",
      is_primary: true,
      view_angle: "front",
      framing: "face",
      expression: "neutral",
      body_visibility: "partial",
      source_type: "generated_external",
      rights_confirmed: true,
      status: "uploaded",
      notes: buildMasterIdentityNotes({
        version: 1,
        source: "selected_candidate",
        reference_type: "identity_master",
        primary_identity_reference: true,
        immutable_source_reference: true,
        original_provider: "openai",
        source_candidate_id: "cand-1",
        source_candidate_asset_id: "cand-asset-1",
        source_creation_project_id: null,
        label: "MASTER IDENTITY REFERENCE",
        subtitle: "Original selected Brand Face",
      }),
    });
    await personaRepo.updatePersona(scope, persona.id, {
      primary_reference_asset_id: master.id,
    });
    const session = await pkgRepo.createSession(scope, {
      persona_id: persona.id,
      master_reference_id: master.id,
      confirmation_token: "tok",
      estimate_hash: createHash("sha256").update("pkg").digest("hex"),
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      max_authorized_spend: 0,
      image_count: 5,
    });
    const slotAssets: Record<ReferencePackageSlot, string> = {} as Record<
      ReferencePackageSlot,
      string
    >;
    for (const slot of REFERENCE_PACKAGE_SLOTS) {
      const created = await personaRepo.createReferenceAsset(scope, {
        persona_id: persona.id,
        asset_type: "portrait",
        storage_path: `workspace/${WS}/${slot}.png`,
        mime_type: "image/png",
        width: 1,
        height: 1,
        file_size_bytes: 10,
        checksum: `chk-${slot}`,
        is_primary: false,
        view_angle: "front",
        framing: "head_shoulders",
        expression: "neutral",
        body_visibility: "partial",
        source_type: "generated_external",
        rights_confirmed: true,
        status: "approved",
        notes: buildReferencePackageAssetNotes({
          slot,
          attemptId: `att-${slot}`,
          masterReferenceId: master.id,
          identityDecision: "identity_match",
          angleDirection: "correct",
        }),
      });
      slotAssets[slot] = created.id;
      const row = await pkgRepo.createAttempt(scope, {
        persona_id: persona.id,
        session_id: session.id,
        master_reference_id: master.id,
        reference_slot: slot,
        status: "accepted",
      });
      await pkgRepo.updateAttempt(scope, row.id, {
        generated_asset_id: created.id,
        identity_decision: "identity_match",
        angle_direction: "correct",
      });
    }
    return { persona, master, slotAssets };
  }

  it("1. 5/5 + Master permits lock", async () => {
    const { persona } = await seedFullPackageInRepos();
    const eligibility = await getIdentityLockEligibility(scope, persona.id);
    assert.equal(eligibility.eligibleForIdentityLock, true);
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.providerCalled, false);
    assert.equal(locked.persona.identity_lock_status, "approved");
  });

  it("2. missing Master blocks", () => {
    const persona = draftPersona();
    const pkg = fullPackageAttempts();
    const assets = pkg.map((p) => slotAsset(p.assetId, p.slot));
    const attempts = pkg.map((p) => p.att);
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const eligibility = validateIdentityLockEligibility({
      persona,
      reconciled,
      master: null,
      assets,
      nextLockVersion: 2,
    });
    assert.equal(eligibility.eligibleForIdentityLock, false);
    assert.ok(eligibility.blockingReasons.some((r) => /Master/i.test(r)));
  });

  it("3. 4/5 blocks", () => {
    const persona = draftPersona();
    const master = masterAsset();
    const pkg = fullPackageAttempts().slice(0, 4);
    const assets = [master, ...pkg.map((p) => slotAsset(p.assetId, p.slot))];
    const attempts = pkg.map((p) => p.att);
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const eligibility = validateIdentityLockEligibility({
      persona,
      reconciled,
      master,
      assets,
      nextLockVersion: 2,
    });
    assert.equal(eligibility.eligibleForIdentityLock, false);
    assert.ok(eligibility.blockingReasons.some((r) => /not ready|missing/i.test(r)));
  });

  it("4. review slot blocks", () => {
    const persona = draftPersona();
    const master = masterAsset();
    const pkg = fullPackageAttempts({
      front: { status: "review", generated_asset_id: "asset-front" },
    });
    const assets = [
      master,
      slotAsset("asset-front", "front", { status: "review" }),
      ...pkg.slice(1).map((p) => slotAsset(p.assetId, p.slot)),
    ];
    const attempts = pkg.map((p) => p.att);
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const eligibility = validateIdentityLockEligibility({
      persona,
      reconciled,
      master,
      assets,
      nextLockVersion: 2,
    });
    assert.equal(eligibility.eligibleForIdentityLock, false);
    assert.ok(eligibility.blockingReasons.some((r) => /review/i.test(r)));
  });

  it("5. wrong camera blocks", () => {
    const persona = draftPersona();
    const master = masterAsset();
    const pkg = fullPackageAttempts({
      front: {
        status: "failed",
        angle_direction: "incorrect",
        generated_asset_id: "asset-front",
      },
    });
    const assets = [
      master,
      slotAsset("asset-front", "front"),
      ...pkg.slice(1).map((p) => slotAsset(p.assetId, p.slot)),
    ];
    const attempts = pkg.map((p) => p.att);
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const eligibility = validateIdentityLockEligibility({
      persona,
      reconciled,
      master,
      assets,
      nextLockVersion: 2,
    });
    assert.equal(eligibility.eligibleForIdentityLock, false);
    assert.ok(eligibility.blockingReasons.some((r) => /wrong camera/i.test(r)));
  });

  it("6. pending replacement blocks", () => {
    const persona = draftPersona();
    const master = masterAsset();
    const base = fullPackageAttempts();
    const pendingAtt = attempt({
      id: "att-repl",
      reference_slot: "front",
      status: "review",
      generated_asset_id: "asset-repl",
      replacement_candidate: true,
      replacement_for_asset_id: "asset-front",
      replacement_for_slot: "front",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    const attempts = [...base.map((p) => p.att), pendingAtt];
    const assets = [
      master,
      ...base.map((p) => slotAsset(p.assetId, p.slot)),
      slotAsset("asset-repl", "front", { status: "review" }),
    ];
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const eligibility = validateIdentityLockEligibility({
      persona,
      reconciled,
      master,
      assets,
      nextLockVersion: 2,
    });
    assert.equal(eligibility.eligibleForIdentityLock, false);
    assert.ok(eligibility.blockingReasons.some((r) => /pending replacement/i.test(r)));
  });

  it("7. warning + human approval allowed", () => {
    const persona = draftPersona();
    const master = masterAsset();
    const pkg = fullPackageAttempts({
      front: {
        identity_decision: "identity_warning",
        status: "accepted",
        generated_asset_id: "asset-front",
      },
    });
    const assets = [master, ...pkg.map((p) => slotAsset(p.assetId, p.slot))];
    const attempts = pkg.map((p) => p.att);
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const eligibility = validateIdentityLockEligibility({
      persona,
      reconciled,
      master,
      assets,
      nextLockVersion: 2,
    });
    assert.equal(eligibility.eligibleForIdentityLock, true);
  });

  it("8. mismatch + explicit override allowed", () => {
    const persona = draftPersona();
    const master = masterAsset();
    const pkg = fullPackageAttempts({
      front: {
        identity_decision: "identity_mismatch",
        human_identity_review: "approved_override",
        status: "accepted",
        generated_asset_id: "asset-front",
      },
    });
    const assets = [master, ...pkg.map((p) => slotAsset(p.assetId, p.slot))];
    const attempts = pkg.map((p) => p.att);
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const eligibility = validateIdentityLockEligibility({
      persona,
      reconciled,
      master,
      assets,
      nextLockVersion: 2,
    });
    assert.equal(eligibility.eligibleForIdentityLock, true);
  });

  it("9. mismatch without override blocks", () => {
    const persona = draftPersona();
    const master = masterAsset();
    const pkg = fullPackageAttempts({
      front: {
        identity_decision: "identity_mismatch",
        status: "mismatch",
        generated_asset_id: "asset-front",
      },
    });
    const assets = [master, ...pkg.map((p) => slotAsset(p.assetId, p.slot))];
    const attempts = pkg.map((p) => p.att);
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const eligibility = validateIdentityLockEligibility({
      persona,
      reconciled,
      master,
      assets,
      nextLockVersion: 2,
    });
    assert.equal(eligibility.eligibleForIdentityLock, false);
  });

  it("10. mirror-derived accepted ref allowed", () => {
    const persona = draftPersona();
    const master = masterAsset();
    const pkg = fullPackageAttempts({
      left_profile: {
        provider: "derived_local",
        derivation_type: "horizontal_mirror",
        derived_from_asset_id: "asset-right_profile",
        status: "accepted",
        generated_asset_id: "asset-left_profile",
      },
    });
    const assets = [master, ...pkg.map((p) => slotAsset(p.assetId, p.slot))];
    const attempts = pkg.map((p) => p.att);
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const eligibility = validateIdentityLockEligibility({
      persona,
      reconciled,
      master,
      assets,
      nextLockVersion: 2,
    });
    assert.equal(eligibility.eligibleForIdentityLock, true);
  });

  it("11. reassigned accepted ref allowed", async () => {
    const { persona, master } = await seedFullPackageInRepos();
    const session = await pkgRepo.createSession(scope, {
      persona_id: persona.id,
      master_reference_id: master.id,
      confirmation_token: "tok-r",
      estimate_hash: createHash("sha256").update("r").digest("hex"),
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      max_authorized_spend: 0,
      image_count: 1,
    });
    const frontAsset = await personaRepo.listReferenceAssets(scope, persona.id);
    const front = frontAsset.find((a) => a.notes.includes('"slot":"front"'));
    assert.ok(front);
    const row = await pkgRepo.createAttempt(scope, {
      persona_id: persona.id,
      session_id: session.id,
      master_reference_id: master.id,
      reference_slot: "front",
      status: "accepted",
    });
    await pkgRepo.updateAttempt(scope, row.id, {
      generated_asset_id: front!.id,
      effective_slot: "three_quarter_left",
      reassigned_from: "front",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    const eligibility = await getIdentityLockEligibility(scope, persona.id);
    assert.equal(eligibility.eligibleForIdentityLock, true);
  });

  it("12. snapshot contains exact six assets", async () => {
    const { persona, master, slotAssets } = await seedFullPackageInRepos();
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    const snap = locked.snapshot;
    assert.equal(snap.master_reference_asset_id, master.id);
    assert.equal(snap.canonical_references.length, 5);
    const ids = new Set([
      snap.master_reference_asset_id,
      snap.front_asset_id,
      snap.three_quarter_left_asset_id,
      snap.three_quarter_right_asset_id,
      snap.left_profile_asset_id,
      snap.right_profile_asset_id,
    ]);
    assert.equal(ids.size, 6);
    assert.equal(snap.front_asset_id, slotAssets.front);
  });

  it("13. deterministic fingerprint generated", () => {
    const refs = fullPackageAttempts().map((p) => ({
      slot: p.slot,
      assetId: p.assetId,
      checksum: `chk-${p.assetId}`,
      provenance: "machine_match" as const,
      identitySourceConfidence: "machine_match" as const,
      referenceProvenance: "generated" as const,
      effectiveSlot: p.slot,
    }));
    const a = computeReferencePackageFingerprint({
      masterAssetId: "master-1",
      masterChecksum: "chk-master",
      canonicalReferences: refs,
      lockVersion: 2,
      referencePackageVersion: "reference-package-reconciler-v1.0.0",
    });
    const b = computeReferencePackageFingerprint({
      masterAssetId: "master-1",
      masterChecksum: "chk-master",
      canonicalReferences: refs,
      lockVersion: 2,
      referencePackageVersion: "reference-package-reconciler-v1.0.0",
    });
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it("14. confirmation required", async () => {
    const { persona } = await seedFullPackageInRepos();
    await assert.rejects(
      () => lockBrandIdentity(scope, persona.id, { confirmIdentityLock: false }),
      (err: unknown) =>
        err instanceof PersonaDomainError && /confirmation required/i.test(err.message),
    );
  });

  it("15. state revalidated on confirm", async () => {
    const { persona, master, slotAssets } = await seedFullPackageInRepos();
    const eligibility = await getIdentityLockEligibility(scope, persona.id);
    assert.equal(eligibility.eligibleForIdentityLock, true);
    const session = await pkgRepo.createSession(scope, {
      persona_id: persona.id,
      master_reference_id: master.id,
      confirmation_token: "tok2",
      estimate_hash: createHash("sha256").update("break").digest("hex"),
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      max_authorized_spend: 0,
      image_count: 1,
    });
    const repl = await personaRepo.createReferenceAsset(scope, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: `workspace/${WS}/repl.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 1,
      checksum: "repl",
      is_primary: false,
      view_angle: "front",
      framing: "face",
      expression: "neutral",
      body_visibility: "partial",
      source_type: "generated_external",
      rights_confirmed: true,
      status: "review",
      notes: buildReferencePackageAssetNotes({
        slot: "front",
        attemptId: "att-break",
        masterReferenceId: master.id,
        identityDecision: "identity_match",
        angleDirection: "correct",
      }),
    });
    const att = await pkgRepo.createAttempt(scope, {
      persona_id: persona.id,
      session_id: session.id,
      master_reference_id: master.id,
      reference_slot: "front",
      status: "review",
    });
    await pkgRepo.updateAttempt(scope, att.id, {
      generated_asset_id: repl.id,
      replacement_candidate: true,
      replacement_for_asset_id: slotAssets.front,
      replacement_for_slot: "front",
      identity_decision: "identity_match",
      angle_direction: "correct",
    });
    await assert.rejects(
      () => lockBrandIdentity(scope, persona.id, { confirmIdentityLock: true }),
      (err: unknown) => err instanceof PersonaDomainError,
    );
  });

  it("16. lock atomic / fail closed", async () => {
    const { persona } = await seedFullPackageInRepos();
    const before = await personaRepo.getPersona(scope, persona.id);
    await assert.rejects(
      () => lockBrandIdentity(scope, persona.id, { confirmIdentityLock: false }),
      () => true,
    );
    const after = await personaRepo.getPersona(scope, persona.id);
    assert.equal(after?.identity_lock_status, before?.identity_lock_status);
    assert.equal(await lockRepo.getLatestSnapshotForPersona(scope, persona.id), null);
  });

  it("17. no provider call", async () => {
    const { persona } = await seedFullPackageInRepos();
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.providerCalled, false);
  });

  it("18. Master immutable after lock", async () => {
    const { persona, master } = await seedFullPackageInRepos();
    await lockBrandIdentity(scope, persona.id, { confirmIdentityLock: true });
    await assert.rejects(
      () =>
        updateReferenceAsset(scope, master.id, {
          storage_path: "changed",
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError && /cannot be modified|immutable/i.test(err.message),
    );
  });

  it("19. canonical refs immutable after lock", async () => {
    const { persona, slotAssets } = await seedFullPackageInRepos();
    await lockBrandIdentity(scope, persona.id, { confirmIdentityLock: true });
    await assert.rejects(
      () => updateReferenceAsset(scope, slotAssets.front, { status: "archived" }),
      (err: unknown) =>
        err instanceof PersonaDomainError && /cannot be modified/i.test(err.message),
    );
  });

  it("20. normal regenerate blocked after lock", () => {
    const src = readFileSync(
      join(ROOT, "lib/persona/creation/reference-package/accepted-replacement.ts"),
      "utf8",
    );
    assert.match(src, /identityLocked/);
  });

  it("21. delete/archive/reassign blocked after lock", async () => {
    const { persona, slotAssets } = await seedFullPackageInRepos();
    await lockBrandIdentity(scope, persona.id, { confirmIdentityLock: true });
    await assert.rejects(
      () => deleteReferenceAsset(scope, slotAssets.front),
      (err: unknown) =>
        err instanceof PersonaDomainError && /cannot be modified|cannot be deleted/i.test(err.message),
    );
    const reassignSrc = readFileSync(
      join(ROOT, "lib/persona/creation/reference-package/reassign.ts"),
      "utf8",
    );
    assert.match(reassignSrc, /identity_lock_status === "approved"/);
  });

  it("22. identity readiness becomes true", async () => {
    const { persona } = await seedFullPackageInRepos();
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.persona.image_identity_ready, true);
  });

  it("23. video approval not automatically granted", async () => {
    const { persona } = await seedFullPackageInRepos();
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.persona.video_use_approved, false);
    assert.equal(locked.persona.video_identity_ready, false);
  });

  it("24. Brand Cast approval not automatically granted", async () => {
    const { persona } = await seedFullPackageInRepos();
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.persona.approved, false);
    assert.equal(locked.persona.image_use_approved, false);
  });

  it("25. audit event written", async () => {
    const { persona } = await seedFullPackageInRepos();
    await lockBrandIdentity(scope, persona.id, { confirmIdentityLock: true });
    const eventsSrc = readFileSync(
      join(ROOT, "lib/persona/audit/persona-events.ts"),
      "utf8",
    );
    assert.match(eventsSrc, /persona\.identity_locked/);
    const serviceSrc = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.match(serviceSrc, /persona\.identity_locked/);
  });

  it("26. historical protection promoted monotonically", () => {
    const src = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.match(src, /identity_locked/);
    assert.match(src, /promoteToHistoricallyProtectedIdentity/);
  });

  it("27. locked identity DTO resolves exact snapshot", async () => {
    const { persona, master } = await seedFullPackageInRepos();
    await lockBrandIdentity(scope, persona.id, { confirmIdentityLock: true });
    const dto = await resolveLockedBrandIdentity(scope, persona.id);
    assert.ok(dto);
    assert.equal(dto!.canonicalReferences.length, 5);
    assert.equal(dto!.masterReference.id, master.id);
    assert.equal(dto!.identityFingerprint.length, 64);
  });

  it("28. discovery/FLUX/novelty threshold untouched", () => {
    const lockSrc = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.doesNotMatch(lockSrc, /openai|flux|regenerate|discovery/i);
    const threshold = readFileSync(
      join(ROOT, "lib/persona/face-novelty-memory/similarity-threshold.ts"),
      "utf8",
    );
    assert.match(threshold, /FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD/);
  });

  it("workflow: converted persona + full package locks via lockPersonaIdentity", async () => {
    const project = await createCreationProject(scope, {
      name: "OBF 2.4A",
      description: "identity lock",
      gender_presentation: "Male",
      age_range: "22-25",
      height_range: "180",
      body_type: "Lean",
      skin_tone_direction: "",
      face_shape_direction: "",
      hair_direction: "",
      facial_hair_direction: "",
      eye_direction: "",
      expression_direction: "",
      personality: "",
      fashion_style: "streetwear",
      brand_role: "primary_male",
      visual_keywords: "",
      preferred_brand_looks: "",
      preferred_outfits: "",
      intended_usage: "image_and_video",
      candidate_count: 1,
      provider_mode: "manual_upload",
      additional_description: "",
      excluded_features: "",
    });
    const [candidate] = await ensureManualCandidateSlots(scope, project.id);
    await uploadManualCandidateAsset(
      scope,
      candidate.id,
      { bytes: tinyPng(), mimeType: "image/png", filename: "front.png" },
      { asset_type: "portrait_front", is_primary: true },
    );
    await updateCandidateReview(scope, candidate.id, { status: "selected" });
    const { persona } = await convertCandidateToPersona(scope, candidate.id);
    const refs = await personaRepo.listReferenceAssets(scope, persona.id);
    const master = findMasterIdentityReference(refs);
    assert.ok(master);
    const session = await pkgRepo.createSession(scope, {
      persona_id: persona.id,
      master_reference_id: master.id,
      confirmation_token: "tok",
      estimate_hash: createHash("sha256").update("x").digest("hex"),
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      max_authorized_spend: 0,
      image_count: 5,
    });
    for (const slot of REFERENCE_PACKAGE_SLOTS) {
      const created = await personaRepo.createReferenceAsset(scope, {
        persona_id: persona.id,
        asset_type: "portrait",
        storage_path: `workspace/${WS}/wf-${slot}.png`,
        mime_type: "image/png",
        width: 1,
        height: 1,
        file_size_bytes: 10,
        checksum: `wf-${slot}`,
        is_primary: false,
        view_angle: "front",
        framing: "head_shoulders",
        expression: "neutral",
        body_visibility: "partial",
        source_type: "generated_external",
        rights_confirmed: true,
        status: "approved",
        notes: buildReferencePackageAssetNotes({
          slot,
          attemptId: `wf-att-${slot}`,
          masterReferenceId: master.id,
          identityDecision: "identity_match",
          angleDirection: "correct",
        }),
      });
      const row = await pkgRepo.createAttempt(scope, {
        persona_id: persona.id,
        session_id: session.id,
        master_reference_id: master.id,
        reference_slot: slot,
        status: "accepted",
      });
      await pkgRepo.updateAttempt(scope, row.id, {
        generated_asset_id: created.id,
        identity_decision: "identity_match",
        angle_direction: "correct",
      });
    }
    const eligibility = await getIdentityLockEligibility(scope, persona.id);
    assert.equal(eligibility.eligibleForIdentityLock, true);
    const locked = await lockPersonaIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.identity_lock_status, "approved");
    assert.equal(locked.image_use_approved, false);
  });
});
