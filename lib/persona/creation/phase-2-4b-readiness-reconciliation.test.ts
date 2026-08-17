/**
 * Phase 2.4B — Persona readiness reconciliation invariants.
 * No OpenAI / FLUX / provider calls.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  MemoryReferencePackageRepository,
  MemoryIdentityLockRepository,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
  setReferencePackageRepositoryForTests,
  setIdentityLockRepositoryForTests,
  reconcileReferencePackageState,
  resolvePersonaReadinessFromFacts,
  resolvePersonaReadiness,
  getIdentityLockEligibility,
  REFERENCE_PACKAGE_SLOTS,
  computePersonaReadiness,
  IDENTITY_REVIEW_CHECK_KEYS,
} from "@/lib/persona";
import { getPersonaReadiness } from "@/lib/persona/services/persona-service";
import {
  buildMasterIdentityNotes,
} from "@/lib/persona/creation/master-identity-reference";
import {
  buildReferencePackageAssetNotes,
  type ReferencePackageAttempt,
} from "@/lib/persona/creation/reference-package/types";
import type { Persona, PersonaReferenceAsset, WorkspaceScope } from "@/lib/persona/domain/types";
import type { ReferencePackageSlot } from "@/lib/persona/creation/reference-package/slots";

const ROOT = process.cwd();
const WS = "ws-phase-24b";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-24b" };

function attempt(
  overrides: Partial<ReferencePackageAttempt> &
    Pick<ReferencePackageAttempt, "id" | "reference_slot" | "status">,
): ReferencePackageAttempt {
  const now = new Date().toISOString();
  return {
    workspace_id: WS,
    persona_id: "persona-24b",
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
    identity_decision: "identity_match",
    identity_distance: null,
    identity_similarity: null,
    angle_direction: "correct",
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
    persona_id: "persona-24b",
    asset_type: "portrait",
    storage_path: `workspace/${WS}/${id}.png`,
    mime_type: "image/png",
    width: 1,
    height: 1,
    file_size_bytes: 10,
    checksum: `chk-${id}`,
    is_primary: false,
    view_angle: slot.includes("profile")
      ? (slot as "left_profile" | "right_profile")
      : slot.includes("three_quarter")
        ? (slot as "three_quarter_left" | "three_quarter_right")
        : "front",
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

function masterAsset(): PersonaReferenceAsset {
  const now = new Date().toISOString();
  return {
    id: "master-1",
    workspace_id: WS,
    persona_id: "persona-24b",
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
    created_by: null,
    created_at: now,
    updated_at: now,
  };
}

function draftPersona(overrides: Partial<Persona> = {}): Persona {
  const now = new Date().toISOString();
  return {
    id: "persona-24b",
    workspace_id: WS,
    name: "North African Street Premium",
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
    personality: "calm",
    style: "street",
    notes: "",
    brand_fit_score: 0,
    approved: false,
    identity_lock_version: 1,
    identity_locked_at: null,
    image_use_approved: false,
    image_use_approved_at: null,
    image_use_approved_by: null,
    video_use_approved: false,
    video_use_approved_at: null,
    video_use_approved_by: null,
    brand_cast_approved: false,
    brand_cast_approved_at: null,
    brand_cast_approved_by: null,
    primary_reference_asset_id: "master-1",
    visual_identity_notes: "notes",
    distinguishing_features: "",
    prohibited_changes: "none",
    default_hair_style: "short",
    default_facial_hair: "",
    default_expression: "neutral",
    default_body_proportions: "lean",
    default_styling_notes: "street",
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

function fullPackage() {
  const master = masterAsset();
  const attempts = REFERENCE_PACKAGE_SLOTS.map((slot) =>
    attempt({
      id: `att-${slot}`,
      reference_slot: slot,
      status: "accepted",
      generated_asset_id: `asset-${slot}`,
    }),
  );
  const assets = [
    master,
    ...REFERENCE_PACKAGE_SLOTS.map((slot) => slotAsset(`asset-${slot}`, slot)),
  ];
  return { master, attempts, assets };
}

describe("Phase 2.4B Persona readiness reconciliation", () => {
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

  async function seedFullPackage() {
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
    const slotAssets: Record<string, string> = {};
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
    await creationRepo.createIdentityReview(scope, {
      persona_id: persona.id,
      checklist: Object.fromEntries(
        IDENTITY_REVIEW_CHECK_KEYS.map((key) => [key, true]),
      ) as Record<(typeof IDENTITY_REVIEW_CHECK_KEYS)[number], boolean>,
      all_passed: true,
      reviewer_notes: "Manual identity quality gate passed",
    });
    return { persona, master, slotAssets };
  }

  it("1. 5/5 reconciled package => referencesComplete true", () => {
    const { attempts, assets } = fullPackage();
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets,
      reconciled,
    });
    assert.equal(readiness.referencesComplete, true);
    assert.equal(readiness.referencePackageReady, true);
    assert.notEqual(readiness.legacyReport.state, "references_incomplete");
  });

  it("2. 4/5 => referencesComplete false", () => {
    const { attempts, assets, master } = fullPackage();
    const four = attempts.slice(0, 4);
    const fourAssets = [
      master,
      ...assets.filter((a) => four.some((t) => t.generated_asset_id === a.id)),
    ];
    const reconciled = reconcileReferencePackageState({
      attempts: four,
      assets: fourAssets,
    });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets: fourAssets,
      reconciled,
    });
    assert.equal(readiness.referencesComplete, false);
    assert.equal(readiness.visualStatus, "references_incomplete");
  });

  it("3. superseded/deleted history cannot downgrade complete package", () => {
    const { attempts, assets } = fullPackage();
    const superseded = slotAsset("old-front", "front", { status: "superseded" });
    const oldAtt = attempt({
      id: "att-old-front",
      reference_slot: "front",
      status: "accepted",
      generated_asset_id: "old-front",
      created_at: "2020-01-01T00:00:00.000Z",
    });
    const reconciled = reconcileReferencePackageState({
      attempts: [...attempts, oldAtt],
      assets: [...assets, superseded],
    });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets: [...assets, superseded],
      reconciled,
    });
    assert.equal(readiness.referencesComplete, true);
    assert.equal(readiness.referenceCoverage.accepted, 5);
  });

  it("4. replacement predecessor missing cannot downgrade readiness", () => {
    const { attempts, assets } = fullPackage();
    // Mark front as replacement with missing predecessor — still accepted.
    const frontAtt = attempts.find((a) => a.reference_slot === "front")!;
    frontAtt.replacement_candidate = false;
    frontAtt.replacement_for_asset_id = "gone-predecessor";
    const frontAsset = assets.find((a) => a.id === "asset-front")!;
    frontAsset.notes = buildReferencePackageAssetNotes({
      slot: "front",
      attemptId: frontAtt.id,
      masterReferenceId: "master-1",
      identityDecision: "identity_match",
      angleDirection: "correct",
      replacementForAssetId: "gone-predecessor",
    });
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets,
      reconciled,
    });
    assert.equal(readiness.referencesComplete, true);
  });

  it("5. header and Reference Package use same source", () => {
    const { attempts, assets } = fullPackage();
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets,
      reconciled,
    });
    assert.equal(
      readiness.referencePackageReady,
      reconciled.referencePackageReady,
    );
    assert.equal(
      readiness.referenceCoverage.accepted,
      reconciled.acceptedCount,
    );
  });

  it("6. Reference Package readiness does not bypass identity review", () => {
    const { attempts, assets } = fullPackage();
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets,
      reconciled,
    });
    assert.equal(readiness.referencesComplete, true);
    assert.equal(readiness.eligibleForIdentityLock, false);
    assert.ok(
      readiness.identityLockEligibility.blockingReasons.some((reason) =>
        /identity review/i.test(reason),
      ),
    );
    assert.equal(
      readiness.eligibleForIdentityLock,
      readiness.identityLockEligibility.eligibleForIdentityLock,
    );
  });

  it("7. reference package ready + not locked is represented correctly", () => {
    const { attempts, assets } = fullPackage();
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets,
      reconciled,
    });
    assert.equal(readiness.visualStatus, "reference_package_ready");
    assert.equal(readiness.identityLocked, false);
    assert.equal(readiness.legacyReport.state, "reference_package_ready");
  });

  it("8. reference package ready does not auto image-use approve", () => {
    const { attempts, assets } = fullPackage();
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets,
      reconciled,
    });
    assert.equal(readiness.imageUseApproved, false);
    assert.equal(readiness.legacyReport.image_ready, false);
  });

  it("9. identity lock requires a persisted quality review", () => {
    const { attempts, assets } = fullPackage();
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets,
      reconciled,
    });
    assert.equal(readiness.identityLocked, false);
    assert.equal(readiness.eligibleForIdentityLock, false);
  });

  it("10. video use remains separate", () => {
    const { attempts, assets } = fullPackage();
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona({
        identity_lock_status: "approved",
        image_identity_ready: true,
        image_use_approved: true,
      }),
      assets,
      reconciled,
    });
    assert.equal(readiness.imageUseApproved, true);
    assert.equal(readiness.videoUseApproved, false);
    assert.equal(readiness.legacyReport.video_ready, false);
  });

  it("11. brand cast remains separate", () => {
    const { attempts, assets } = fullPackage();
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona({
        identity_lock_status: "approved",
        image_use_approved: true,
        approved: false,
        status: "Draft",
      }),
      assets,
      reconciled,
    });
    assert.equal(readiness.brandCastApproved, false);
  });

  it("12. visualStatus = reference_package_ready before lock", () => {
    const { attempts, assets } = fullPackage();
    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets,
      reconciled,
    });
    assert.equal(readiness.visualStatus, "reference_package_ready");
  });

  it("13. legacy REFERENCES_INCOMPLETE flag cannot override reconciled 5/5", () => {
    const { attempts, assets } = fullPackage();
    // Legacy computePersonaReadiness would say incomplete (no full body).
    const legacy = computePersonaReadiness(draftPersona(), [...assets]);
    assert.equal(legacy.references_complete, false);

    const reconciled = reconcileReferencePackageState({ attempts, assets });
    const readiness = resolvePersonaReadinessFromFacts({
      persona: draftPersona(),
      assets,
      reconciled,
    });
    assert.equal(readiness.referencesComplete, true);
    assert.notEqual(readiness.legacyReport.state, "references_incomplete");
    assert.equal(readiness.legacyReport.references_complete, true);
  });

  it("14. API serialization succeeds", async () => {
    const { persona } = await seedFullPackage();
    const report = await getPersonaReadiness(scope, persona.id);
    const serialized = JSON.stringify(report);
    assert.ok(serialized.includes("reference_package_ready"));
    assert.ok(serialized.includes('"references_complete":true'));
    assert.doesNotMatch(serialized, /references_incomplete/);
  });

  it("15. exact previous unexpected-error regression is covered", () => {
    const route = readFileSync(
      join(ROOT, "app/api/persona/[id]/identity-lock/route.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    const repo = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/identity-lock/supabase-repository.ts",
      ),
      "utf8",
    );
    // UI must not dump raw response text as error message.
    assert.doesNotMatch(ui, /throw new Error\(await res\.text\(\)\)/);
    // Snapshot lookup must tolerate missing table.
    assert.match(repo, /PGRST205/);
    assert.match(route, /getIdentityLockEligibility/);
  });

  it("16. no raw JSON error rendered on successful load", () => {
    const ui = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(ui, /persona-section-error/);
    assert.match(ui, /data\?\.error/);
  });

  it("17. readiness updates after reference mutation", async () => {
    const { persona, slotAssets } = await seedFullPackage();
    const before = await resolvePersonaReadiness(scope, persona.id);
    assert.equal(before.referencesComplete, true);

    // Demote one slot asset → package no longer 5/5.
    await personaRepo.updateReferenceAsset(scope, slotAssets.front, {
      status: "rejected",
    });
    const after = await resolvePersonaReadiness(scope, persona.id);
    assert.equal(after.referencesComplete, false);
    assert.equal(after.visualStatus, "references_incomplete");
  });

  it("18. no provider calls", () => {
    const src = readFileSync(
      join(ROOT, "lib/persona/domain/persona-readiness-resolver.ts"),
      "utf8",
    );
    assert.doesNotMatch(src, /openai|flux|editFromMaster|generate/i);
  });

  it("19. no identity threshold changes", () => {
    const threshold = readFileSync(
      join(ROOT, "lib/persona/face-novelty-memory/similarity-threshold.ts"),
      "utf8",
    );
    assert.match(threshold, /FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD/);
    const identity = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/reference-package/identity-consistency.ts",
      ),
      "utf8",
    );
    assert.match(identity, /IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN/);
  });

  it("20. no discovery/FLUX/novelty changes", () => {
    const resolver = readFileSync(
      join(ROOT, "lib/persona/domain/persona-readiness-resolver.ts"),
      "utf8",
    );
    assert.doesNotMatch(resolver, /discovery|novelty|flux/i);
  });

  it("service eligibility agrees with readiness for seeded 5/5", async () => {
    const { persona } = await seedFullPackage();
    const readiness = await resolvePersonaReadiness(scope, persona.id);
    const eligibility = await getIdentityLockEligibility(scope, persona.id);
    assert.equal(readiness.eligibleForIdentityLock, eligibility.eligibleForIdentityLock);
    assert.equal(readiness.referencesComplete, true);
    assert.equal(eligibility.eligibleForIdentityLock, true);
  });
});
